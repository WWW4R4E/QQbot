export interface OneBot11Event {
	time: number;
	self_id: number;
	post_type: 'message' | 'notice' | 'request' | 'meta_event';
}

export interface GroupMessageEvent extends OneBot11Event {
	post_type: 'message';
	message_type: 'group';
	sub_type: 'normal';
	message_id: number;
	group_id: number;
	user_id: number;
	anonymous?: any;
	message: string;
	raw_message: string;
	font: number;
	sender: {
		user_id: number;
		nickname: string;
		card?: string;
		sex: 'male' | 'female' | 'unknown';
		age: number;
		area?: string;
		level?: string;
		role: 'owner' | 'admin' | 'member';
		title?: string;
	};
}

export interface SendGroupMsgResponse {
	status: 'ok' | 'failed';
	retcode: number;
	data: {
		message_id: number;
	};
}

export interface BotTarget {
	groupId: number;
	userId: number;
}

export interface BotConfig {
	napcatHost: string;
	napcatWebSocketPort: number;
	accessToken?: string;
	targets: BotTarget[];
	geminiApiKey?: string;
	geminiModel?: string;
	httpProxy?: string;
}