import WebSocket from 'ws';
import { MarkdownDetector } from './markdown-detector';
import { MarkdownRenderer } from './markdown-renderer';
import { NapCatAPI } from './napcat-api';
import { GroupMessageEvent, BotConfig } from './types';

export class QQBot {
  private renderer: MarkdownRenderer;
  private napcatAPI: NapCatAPI;
  private config: BotConfig;
  private ws: WebSocket | null = null;
  private isRunning: boolean = false;

  constructor(config: BotConfig) {
    this.config = config;
    this.renderer = new MarkdownRenderer();
    this.napcatAPI = new NapCatAPI(config);
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
    
    // 检查是否为配置中的任一目标
    const isTargetMessage = this.config.targets.some(target => 
      groupEvent.group_id === target.groupId && groupEvent.user_id === target.userId
    );

    if (!isTargetMessage) {
      return;
    }

    // 找到匹配的目标配置
    const matchedTarget = this.config.targets.find(target => 
      groupEvent.group_id === target.groupId && groupEvent.user_id === target.userId
    );

    console.log('收到目标用户 WebSocket 消息:', JSON.stringify(message, null, 2));
    console.log(`收到目标用户消息 (群组: ${groupEvent.group_id}, 用户: ${groupEvent.user_id}): ${groupEvent.raw_message}`);

    // 解析消息中的 CQ:reply 标签
    const replyMatch = groupEvent.raw_message.match(/\[CQ:reply,id=(\d+)\]/);
    const replyId = replyMatch ? replyMatch[1] : null;
    
    // 移除 CQ:reply 标签，只保留实际的 Markdown 内容
    const cleanMessage = groupEvent.raw_message.replace(/\[CQ:reply,id=\d+\]/g, '').trim();

    // 检查是否包含 Markdown 语法
    if (!MarkdownDetector.isMarkdown(cleanMessage)) {
      console.log('消息不包含 Markdown 语法，跳过处理');
      return;
    }

    const features = MarkdownDetector.getMarkdownFeatures(cleanMessage);
    console.log(`检测到 Markdown 特性: ${features.join(', ')}`);
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
      
      console.log('图片发送成功:', result);
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