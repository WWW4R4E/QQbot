import * as dotenv from 'dotenv';
import { QQBot } from './bot';
import { BotConfig } from './types';

// 加载环境变量
dotenv.config();

function loadConfig(): BotConfig {
  const config: BotConfig = {
    napcatHost: process.env.NAPCAT_HOST || '127.0.0.1',
    napcatPort: parseInt(process.env.NAPCAT_PORT || '3001'),
    napcatWebSocketPort: parseInt(process.env.NAPCAT_WEBSOCKET_PORT || '3002'),
    accessToken: process.env.NAPCAT_ACCESS_TOKEN,
    targetGroupId: parseInt(process.env.TARGET_GROUP_ID || '0'),
    targetUserId: parseInt(process.env.TARGET_USER_ID || '0'),
  };

  // 验证必要的配置
  if (!config.targetGroupId || !config.targetUserId) {
    console.error('错误: 请在 .env 文件中设置 TARGET_GROUP_ID 和 TARGET_USER_ID');
    process.exit(1);
  }

	
  return config;
}

async function main() {
  try {
    const config = loadConfig();
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