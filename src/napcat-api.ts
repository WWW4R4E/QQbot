import WebSocket from 'ws';
import * as fs from 'fs';
import { BotConfig, SendGroupMsgResponse } from './types';

export class NapCatAPI {
  private config: BotConfig;
  private ws: WebSocket | null = null;
  private messageId: number = 1;
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor(config: BotConfig) {
    this.config = config;
    // 延迟连接，给主 WebSocket 连接一些时间建立
    setTimeout(() => {
      this.connect();
    }, 2000);
  }

  private connect(): void {
    const wsUrl = `ws://${this.config.napcatHost}:${this.config.napcatPort}`;
    const headers: any = {};
    
    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    }

    this.ws = new WebSocket(wsUrl, { headers });

    this.ws.on('open', () => {
      console.log('NapCat API WebSocket 连接已建立');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString());
        this.handleResponse(response);
      } catch (error) {
        console.error('解析 API 响应失败:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('NapCat API WebSocket 连接已断开');
      // 清理所有等待的请求
      this.pendingRequests.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error('WebSocket 连接已断开'));
      });
      this.pendingRequests.clear();
    });

    this.ws.on('error', (error) => {
      console.error('NapCat API WebSocket 错误:', error);
    });
  }

  private handleResponse(response: any): void {
    // 如果没有 echo 字段，或者有 post_type 字段，说明这是一个事件消息，不是 API 响应
    if (!response.echo || response.post_type) {
      return;
    }
    
    const echo = response.echo;
    console.log('收到 API 响应:', JSON.stringify(response, null, 2));
    
    if (this.pendingRequests.has(echo)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(echo)!;
      clearTimeout(timeout);
      this.pendingRequests.delete(echo);
      
      if (response.status === 'ok' || response.retcode === 0) {
        resolve(response);
      } else {
        console.error('API 请求失败，响应:', response);
        reject(new Error(response.msg || response.message || response.wording || `请求失败，状态: ${response.status || response.retcode}`));
      }
    }
  }

  private sendRequest(action: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket 连接未建立'));
        return;
      }

      const echo = `${action}_${this.messageId++}_${Date.now()}`;
      const message = {
        action,
        params,
        echo
      };

      console.log('发送 API 请求:', JSON.stringify(message, null, 2));

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(echo);
        reject(new Error('请求超时'));
      }, 10000); // 10秒超时

      this.pendingRequests.set(echo, { resolve, reject, timeout });
      this.ws!.send(JSON.stringify(message));
    });
  }

  async sendGroupMessage(groupId: number, message: string): Promise<SendGroupMsgResponse> {
    try {
      const response = await this.sendRequest('send_group_msg', {
        group_id: groupId,
        message: message
      });
      
      return response;
    } catch (error) {
      console.error('发送群消息失败:', error);
      throw error;
    }
  }

  async uploadGroupImage(groupId: number, imagePath: string): Promise<string> {
    try {
      // WebSocket API 不直接支持文件上传，使用本地文件路径
      // 或者可以使用 base64 编码
      const fileBuffer = fs.readFileSync(imagePath);
      const base64Data = fileBuffer.toString('base64');
      
      const response = await this.sendRequest('upload_group_file', {
        group_id: groupId,
        file: `base64://${base64Data}`
      });

      return response.data.file_id;
    } catch (error) {
      console.error('上传群文件失败:', error);
      throw error;
    }
  }

  async sendGroupImageMessage(groupId: number, imagePath: string): Promise<SendGroupMsgResponse> {
    try {
      // 读取文件并转换为 base64
      const fileBuffer = fs.readFileSync(imagePath);
      const base64Data = fileBuffer.toString('base64');
      const message = `[CQ:image,file=base64://${base64Data}]`;
      
      return await this.sendGroupMessage(groupId, message);
    } catch (error) {
      console.error('发送群图片消息失败:', error);
      throw error;
    }
  }

  async sendGroupImageFromBuffer(groupId: number, imageBuffer: Buffer, filename: string = 'markdown.png', replyId?: string): Promise<SendGroupMsgResponse> {
    try {
      // 直接使用 Buffer 转换为 base64，不需要临时文件
      const base64Data = imageBuffer.toString('base64');
      let message = `[CQ:image,file=base64://${base64Data}]`;
      
      // 如果有回复 ID，在前面添加回复标签
      if (replyId) {
        message = `[CQ:reply,id=${replyId}]${message}`;
      }
      
      return await this.sendGroupMessage(groupId, message);
    } catch (error) {
      console.error('发送群图片消息失败:', error);
      throw error;
    }
  }

  async getGroupMessageHistory(groupId: number, count: number = 20): Promise<any> {
    try {
      const response = await this.sendRequest('get_group_msg_history', {
        group_id: groupId,
        count: count
      });
      
      return response;
    } catch (error) {
      console.error('获取群消息历史失败:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.sendRequest('get_status');
      return response.status === 'ok';
    } catch (error) {
      console.error('NapCat 连接测试失败:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}