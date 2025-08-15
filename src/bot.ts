import { ProxyAgent, request } from 'undici'; // 导入 request
import WebSocket from 'ws';
import { MarkdownAnalysis, MarkdownDetector } from './markdown-detector';
import { MarkdownRenderer } from './markdown-renderer';
import { NapCatAPI } from './napcat-api';
import { BotConfig, GroupMessageEvent } from './types';

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

			// 检查是否以“小幻梦”开头
			// if (cleanedMessage.startsWith('小幻梦')) {
			// const prompt = cleanedMessage.substring('小幻梦'.length).trim();
			// 	console.log(`检测到“小幻梦”开头消息，准备调用 Gemini API，prompt: ${prompt}`);

			// if (prompt) {
			// const geminiResponse = await this.callGeminiAPI(prompt);
			const geminiResponse = await this.callGeminiAPI(cleanedMessage);
			if (geminiResponse) {
				console.log('Gemini API 响应:', geminiResponse);
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
			// } else {
			// 	console.log('“小幻梦”后没有有效内容，跳过 Gemini 处理。');
			// 	await this.napcatAPI.sendGroupMessage(
			// 		groupEvent.group_id,
			// 		`[CQ:reply,id=${groupEvent.message_id}]您好，请在“小幻梦”后输入您的问题。`
			// 	);
			// 	return;
			// }
			// }
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

	private async callGeminiAPI(prompt: string): Promise<string | null> {
		if (!this.config.geminiApiKey || !this.config.geminiModel) {
			console.error('Gemini API 密钥或模型未配置。');
			return null;
		}

		const API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
		const headers = {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${this.config.geminiApiKey}`
		};
		const body = JSON.stringify({
			"model": this.config.geminiModel,
			"messages": [
				{ "role": "user", "content": prompt }
			]
		});

		try {
			const { statusCode, headers: responseHeaders, body: responseBody } = await request(API_URL, {
				method: 'POST',
				headers: headers,
				body: body,
				dispatcher: this.dispatcher!,
			});

			if (statusCode === 200) {
				const responseJson: any = await responseBody.json();
				if (responseJson && responseJson.choices && Array.isArray(responseJson.choices)) {
					return responseJson.choices[0]?.message?.content?.trim() || null;
				} else {
					console.warn('Gemini API 响应中未找到有效内容:', JSON.stringify(responseJson, null, 2));
					return null;
				}
			} else {
				const errorText = await responseBody.text();
				console.error(`Gemini API 请求失败: 状态码 ${statusCode}, 错误信息: ${errorText}`);
				return null;
			}
		} catch (error) {
			console.error('调用 Gemini API 失败:', error);
			return null;
		}
	}

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
