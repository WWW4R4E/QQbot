import * as dotenv from 'dotenv';
import { QQBot } from './bot';
import { BotConfig, BotTarget } from './types';

dotenv.config();

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
		geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash', 
		httpProxy: process.env.HTTP_PROXY, 
	};

	if (targets.length === 0) {
		console.error('错误: 请在 .env 文件中设置 TARGETS (格式: groupId1:userId1,groupId2:userId2) 或者 TARGET_GROUP_ID 和 TARGET_USER_ID');
		console.error('示例: TARGETS=123456:789012,456789:012345');
		process.exit(1);
	}

	// console.log(`已配置 ${targets.length} 个监听目标:`);
	// targets.forEach((target, index) => {
	// 	console.log(`  ${index + 1}. 群组 ${target.groupId} 中的用户 ${target.userId}`);
	// });

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