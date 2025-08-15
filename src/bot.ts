import { ProxyAgent, request } from 'undici'; // 导入 request
import WebSocket from 'ws';
import { MarkdownAnalysis, MarkdownDetector } from './markdown-detector';
import { MarkdownRenderer } from './markdown-renderer';
import { NapCatAPI } from './napcat-api';
import { BotConfig, CallGeminiMessageContents, ContentPart, GroupMessageEvent } from './types';

export class QQBot {
	private renderer: MarkdownRenderer;
	private napcatAPI: NapCatAPI;
	private config: BotConfig;
	private ws: WebSocket | null = null;
	private isRunning: boolean = false;
	private dispatcher: ProxyAgent | null = null;
	constructor(config: BotConfig) {
		this.config = config;
		this.renderer = new MarkdownRenderer();
		this.napcatAPI = new NapCatAPI(config);

		if (!config.geminiApiKey || !config.geminiModel) {
			console.warn('未配置 Gemini API 密钥或模型，Gemini 功能将不可用。');
		}
		console.log('初始化代理...');
		if (this.config.httpProxy) {
			this.dispatcher = new ProxyAgent({ uri: this.config.httpProxy });
		}
	}

	private connectWebSocket(): void {
		const wsUrl = `ws://${this.config.napcatHost}:${this.config.napcatWebSocketPort}`;
		console.log(`连接到 WebSocket: ${wsUrl}`);

		// 如果有访问令牌，添加到头部
		const headers: any = {};
		if (this.config.accessToken) {
			headers['Authorization'] = `Bearer ${this.config.accessToken}`;
		}

		this.ws = new WebSocket(wsUrl, { headers });

		this.ws.on('open', () => {
			console.log('WebSocket 连接已建立！');
			console.log(`监控 ${this.config.targets.length} 个目标:`);
			this.config.targets.forEach((target, index) => {
				console.log(`  ${index + 1}. 群组 ${target.groupId} 中用户 ${target.userId}`);
			});
		});

		this.ws.on('message', async (data: WebSocket.Data) => {
			try {
				const message = JSON.parse(data.toString());
				await this.handleWebSocketMessage(message);
			} catch (error) {
				console.error('处理 WebSocket 消息失败:', error);
				console.error('原始消息:', data.toString());
			}
		});

		this.ws.on('close', (code, reason) => {
			console.log(`WebSocket 连接已断开，状态码: ${code}, 原因: ${reason.toString()}`);
			if (this.isRunning) {
				console.log('5秒后尝试重新连接...');
				setTimeout(() => {
					if (this.isRunning) {
						this.connectWebSocket();
					}
				}, 5000);
			}
		});

		this.ws.on('error', (error) => {
			console.error('WebSocket 错误:', error);
		});
	}

	private async handleWebSocketMessage(message: any): Promise<void> {
		// 检查是否为群消息事件
		if (message.post_type !== 'message' || message.message_type !== 'group') {
			return;
		}
		const groupEvent = message as GroupMessageEvent;
		const selfId = message.self_id; // 获取机器人自身的 QQ 号

		// 检查是否为目标群组的消息
		const matchedTarget = this.config.targets.find(target =>
			groupEvent.group_id === target.groupId
		);

		if (!matchedTarget) {
			return;
		}
		// console.log(`收到群组消息 (群组: ${groupEvent.group_id}, 用户: ${groupEvent.user_id}): ${groupEvent.raw_message}`);

		// 检查是否艾特了机器人
		const atMeMatch = groupEvent.raw_message.match(/\[CQ:at,qq=(\d+)\]/);
		const isAtMe = atMeMatch && parseInt(atMeMatch[1]) === selfId;

		if (isAtMe) {
			console.log(`机器人被艾特了！`);
			// 移除艾特标签和回复标签，只保留实际消息内容
			let cleanedMessage = groupEvent.raw_message
				.replace(/\[CQ:at,qq=\d+\]/g, '')
				.replace(/\[CQ:reply,id=\d+\]/g, '')
				.trim();

			// 解析消息中的 CQ:reply 标签
			const replyMatch = groupEvent.raw_message.match(/\[CQ:reply,id=(\d+)\]/);
			const replyId = replyMatch ? replyMatch[1] : null;

			// 如果有引用消息，获取被引用的消息内容
			let fullPrompt: CallGeminiMessageContents | undefined;

			if (replyId && !isNaN(parseInt(replyId, 10))) {
				const targetMessageId = parseInt(replyId, 10);
				const referencedMessage = await this.napcatAPI.getMessageById(targetMessageId);

				if (referencedMessage) {
					const { sender, content, type } = referencedMessage;
					const userNickname = sender.nickname;

					// 构建 prompt 头部
					const contextPrompt = `引用 "${userNickname}" 的消息：\n当前消息：\n${cleanedMessage}\n\n`;

					if (type === 'text') {
						// 纯文本引用
						fullPrompt = {
							prompt: `${contextPrompt}引用内容：\n${content}`,
						};
					} else if (type === 'image') {
						// 图片引用：下载 -> 转 base64 -> 构造 inlineData
						const imageData = await this.downloadImageAsBase64(content);
						if (imageData) {
							fullPrompt = {
								contents: [
									{ text: contextPrompt + "请结合上方的引用图片内容进行回答。" },
									{
										inlineData: {
											mimeType: imageData.mimeType,
											data: imageData.base64,
										},
									},
								],
							};
						} else {
							// 下载失败，降级为文本提示
							fullPrompt = {
								prompt: `${contextPrompt}引用内容：[图片，但加载失败]`,
							};
						}
					}
				} else {
					console.warn('无法获取被引用的消息，ID:', targetMessageId);
					// 降级：不设置 fullPrompt，走普通流程
				}
			}

			// 如果没有引用消息，则使用原始消息作为 prompt
			if (!fullPrompt) {
				fullPrompt = { prompt: cleanedMessage };
			}
			if (fullPrompt === undefined) {
				return;
			}
			const geminiResponse = await this.callGeminiAPI(fullPrompt);
			if (geminiResponse) {
				console.log('Gemini API 响应');
				const geminiMarkdownAnalysis: MarkdownAnalysis = MarkdownDetector.analyzeMarkdown(geminiResponse);
				if (geminiMarkdownAnalysis.isMarkdown) {
					console.log('Gemini 响应包含 Markdown 语法，准备渲染为图片...');
					try {
						const imageBuffer = await this.renderer.renderToImage(geminiResponse);
						await this.napcatAPI.sendGroupImageFromBuffer(
							groupEvent.group_id,
							imageBuffer,
							`gemini_markdown_${Date.now()}.png`,
							String(groupEvent.message_id)
						);
						console.log('已发送 Gemini Markdown 图片回复。');
					} catch (renderError) {
						console.error('渲染 Gemini Markdown 为图片失败:', renderError);
						await this.napcatAPI.sendGroupMessage(
							groupEvent.group_id,
							`[CQ:reply,id=${groupEvent.message_id}]抱歉，渲染 Gemini 回复时出错了 😕`
						);
					}
				} else {
					console.log('Gemini 响应不包含 Markdown 语法，正常发送文本。');
					await this.napcatAPI.sendGroupMessage(
						groupEvent.group_id,
						`[CQ:reply,id=${groupEvent.message_id}]${geminiResponse}`
					);
					console.log('已发送 Gemini 文本回复。');
				}
				return;
			} else {
				console.warn('Gemini API 未返回有效响应。');
				await this.napcatAPI.sendGroupMessage(
					groupEvent.group_id,
					`[CQ:reply,id=${groupEvent.message_id}]抱歉，小幻梦暂时无法回答您的问题。`
				);
				return;
			}
		}

		// 解析消息中的 CQ:reply 标签
		const replyMatch = groupEvent.raw_message.match(/\[CQ:reply,id=(\d+)\]/);
		const replyId = replyMatch ? replyMatch[1] : null;

		// 移除 CQ:reply 标签，只保留实际的 Markdown 内容
		const cleanMessage = groupEvent.raw_message.replace(/\[CQ:reply,id=\d+\]/g, '').trim();

		// 检查是否包含 Markdown 语法
		const markdownAnalysis: MarkdownAnalysis = MarkdownDetector.analyzeMarkdown(cleanMessage);
		if (!markdownAnalysis.isMarkdown) {
			return;
		}
		console.log('消息包含 Markdown 语法，开始处理');
		if (replyId) {
			console.log(`检测到回复消息 ID: ${replyId}`);
		}

		try {
			// 渲染 Markdown 为图片
			console.log('开始渲染 Markdown...');
			const imageBuffer = await this.renderer.renderToImage(cleanMessage);

			// 发送图片到群聊（包含回复）
			console.log('发送图片到群聊...');
			const result = await this.napcatAPI.sendGroupImageFromBuffer(
				groupEvent.group_id,
				imageBuffer,
				`markdown_${Date.now()}.png`,
				replyId || undefined
			);

			console.log('图片发送成功');
		} catch (error) {
			console.error('处理 Markdown 消息失败:', error);

			// 可选：发送错误提示消息
			const errorMessage = replyId
				? `[CQ:reply,id=${replyId}]处理 Markdown 消息时出错了 😕`
				: '处理 Markdown 消息时出错了 😕';

			await this.napcatAPI.sendGroupMessage(
				groupEvent.group_id,
				errorMessage
			);
		}
	}

	private async downloadImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
		try {
			const response = await fetch(imageUrl);
			if (!response.ok) throw new Error(`下载图片失败: ${response.status}`);

			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// 简单判断 MIME 类型
			const uint8Array = new Uint8Array(arrayBuffer.slice(0, 4));
			let mimeType = 'image/jpeg';
			if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4e && uint8Array[3] === 0x47) {
				mimeType = 'image/png';
			} else if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46) {
				mimeType = 'image/gif';
			}

			return {
				base64: buffer.toString('base64'),
				mimeType,
			};
		} catch (error) {
			console.error('下载或转换图片失败:', error);
			return null;
		}
	}
	private async callGeminiAPI(message: CallGeminiMessageContents): Promise<string | null> {
		const MODEL = this.config.geminiModel;
		const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${this.config.geminiApiKey}`;

		// 构建 contents 数组
		const contents = [
			{
				role: "user",
				parts: [] as ContentPart[],
			},
		];

		// 处理 prompt 文本
		if (message.prompt) {
			contents[0].parts.push({ text: message.prompt });
		}

		// 处理 contents（如图像）
		if (message.contents && message.contents.length > 0) {
			contents[0].parts.push(...message.contents);
		}

		// 如果没有任何内容，返回 null
		if (contents[0].parts.length === 0) {
			console.warn("callGeminiAPI: 没有提供任何内容（prompt 或 contents）");
			return null;
		}

		const body = JSON.stringify({
			contents,
			// 可选参数
			// generationConfig: { ... }
			// safetySettings: { ... }
		});

		const headers = {
			"Content-Type": "application/json",
		};

		try {
			const { statusCode, headers: responseHeaders, body: responseBody } = await request(API_URL, {
				method: "POST",
				headers,
				body,
				dispatcher: this.dispatcher!,
			});

			if (statusCode === 200) {
				const responseJson: any = await responseBody.json();
				const text = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text;
				return text?.trim() || null;
			} else {
				const errorText = await responseBody.text();
				console.error(`Gemini API 请求失败: 状态码 ${statusCode}, 错误信息: ${errorText}`);
				return null;
			}
		} catch (error) {
			console.error("调用 Gemini API 失败:", error);
			return null;
		}
	}
	// private async callGeminiAPI(message: CallGeminiMessageContents): Promise<string | null> {

	// 	const API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
	// 	const headers = {
	// 		"Content-Type": "application/json",
	// 		"Authorization": `Bearer ${this.config.geminiApiKey}`
	// 	};
	// 	const body = JSON.stringify({
	// 		"model": this.config.geminiModel,
	// 		// "contents": message.prompt
	// 		"messages": [
	// 			{ "role": "user", "content": message}
	// 		]
	// 	});

	// 	try {
	// 		const { statusCode, headers: responseHeaders, body: responseBody } = await request(API_URL, {
	// 			method: 'POST',
	// 			headers: headers,
	// 			body: body,
	// 			dispatcher: this.dispatcher!,
	// 		});

	// 		if (statusCode === 200) {
	// 			const responseJson: any = await responseBody.json();
	// 			if (responseJson && responseJson.choices && Array.isArray(responseJson.choices)) {
	// 				return responseJson.choices[0]?.message?.content?.trim() || null;
	// 			} else {
	// 				console.warn('Gemini API 响应中未找到有效内容:', JSON.stringify(responseJson, null, 2));
	// 				return null;
	// 			}
	// 		} else {
	// 			const errorText = await responseBody.text();
	// 			console.error(`Gemini API 请求失败: 状态码 ${statusCode}, 错误信息: ${errorText}`);
	// 			return null;
	// 		}
	// 	} catch (error) {
	// 		console.error('调用 Gemini API 失败:', error);
	// 		return null;
	// 	}
	// }

	async start(): Promise<void> {
		try {
			// 初始化 Markdown 渲染器
			console.log('初始化 Markdown 渲染器...');
			await this.renderer.init();

			// 直接启动 WebSocket 连接（跳过 HTTP API 测试）
			console.log('启动 WebSocket 连接...');
			this.isRunning = true;
			this.connectWebSocket();

		} catch (error) {
			console.error('启动服务失败:', error);
			process.exit(1);
		}
	}

	async stop(): Promise<void> {
		console.log('正在关闭服务...');
		this.isRunning = false;

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		// 关闭 NapCat API 连接
		await this.napcatAPI.close();

		await this.renderer.destroy();
		console.log('服务已关闭');
	}
}