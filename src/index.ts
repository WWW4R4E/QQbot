import * as dotenv from 'dotenv';
import { QQBot } from './bot';
import { BotConfig, BotTarget } from './types';

dotenv.config();

// 调试用：打印代理环境变量，确认是否被正确加载
console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY);

function parseTargets(envValue: string): BotTarget[] {
  if (!envValue) return [];
  
  return envValue.split(',').map(target => {
    const [groupId, userId] = target.split(':');
    if (!groupId || !userId) {
      throw new Error(`Invalid target format: ${target}. Expected format: groupId:userId`);
    }
    return {
      groupId: parseInt(groupId),
      userId: parseInt(userId)
    };
  });
}

function loadConfig(): BotConfig {
  const targetsEnv = process.env.TARGETS || (process.env.TARGET_GROUP_ID && process.env.TARGET_USER_ID 
    ? `${process.env.TARGET_GROUP_ID}:${process.env.TARGET_USER_ID}` 
    : '');
  
  const targets = parseTargets(targetsEnv);
  
  const config: BotConfig = {
    napcatHost: process.env.NAPCAT_HOST || '127.0.0.1',
    napcatWebSocketPort: parseInt(process.env.NAPCAT_WEBSOCKET_PORT || '3002'),
    accessToken: process.env.NAPCAT_ACCESS_TOKEN,
    targets: targets,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash', // 默认使用 Gemini 1.5 Flash
    httpProxy: process.env.HTTP_PROXY, // 修改为 HTTP_PROXY
  };

  if (targets.length === 0) {
    console.error('错误: 请在 .env 文件中设置 TARGETS (格式: groupId1:userId1,groupId2:userId2) 或者 TARGET_GROUP_ID 和 TARGET_USER_ID');
    console.error('示例: TARGETS=123456:789012,456789:012345');
    process.exit(1);
  }

  console.log(`已配置 ${targets.length} 个监听目标:`);
  targets.forEach((target, index) => {
    console.log(`  ${index + 1}. 群组 ${target.groupId} 中的用户 ${target.userId}`);
  });

  return config;
}

async function main() {
  try {
    const config = loadConfig();

    // 添加 Gemini API 连接测试
    if (config.geminiApiKey && config.geminiModel) {
      console.log('正在测试 Gemini API 连接...');
      try {
        const { request, Agent } = await import('undici');
        const API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.geminiApiKey}`
        };
        const body = JSON.stringify({
          "model": config.geminiModel,
          "messages": [
            {"role": "user", "content": "Hello, Gemini!"}
          ]
        });

        let dispatcher;
        if (config.httpProxy) {
          console.log('正在设置 HTTP 代理:', config.httpProxy);
          dispatcher = new Agent({
            connect: {
              // @ts-ignore
              baseUrl: config.httpProxy,
            },
          });
        }

        const { statusCode, headers: responseHeaders, body: responseBody } = await request(API_URL, {
          method: 'POST',
          headers: headers,
          body: body,
          dispatcher: dispatcher,
        });

        if (statusCode === 200) {
          const responseJson = await responseBody.json();
          console.log('Gemini API 测试成功:', JSON.stringify(responseJson, null, 2));
        } else {
          const errorText = await responseBody.text();
          console.error(`Gemini API 测试失败: 状态码 ${statusCode}, 错误信息: ${errorText}`);
          console.error('请检查您的网络连接、代理设置和 API 密钥。');
        }
      } catch (error) {
        console.error('Gemini API 测试失败:', error);
        console.error('请检查您的网络连接、代理设置和 API 密钥。');
      }
    } else {
      console.warn('未配置 Gemini API 密钥或模型，跳过 Gemini API 连接测试。');
    }

    const bot = new QQBot(config);

    // 处理优雅关闭
    process.on('SIGINT', async () => {
      console.log('\\n收到 SIGINT 信号，正在关闭...');
      await bot.stop();
    });

    process.on('SIGTERM', async () => {
      console.log('\\n收到 SIGTERM 信号，正在关闭...');
      await bot.stop();
    });

    // 启动机器人
    await bot.start();
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
});