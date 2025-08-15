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

// export type ContentPart =
// 	| { text: string } 
// 	| {
// 		inlineData: {
// 			mimeType: string;
// 			data: string; 
// 		};
// 	};

// export interface CallGeminiMessageContents {
// 	prompt: string; 
// 	contents?: ContentPart[]; 
// }
export type ContentPart =
	| { text: string }
	| {
		inlineData: {
			mimeType: string;
			data: string; // base64 编码的数据
		};
	};

export interface CallGeminiMessageContents {
	prompt?: string; // 可选，用于纯文本
	contents?: ContentPart[]; // 支持多部分输入（文本+图像）
}

export interface NapcatMessage {
	type: 'text' | 'image';
	sender: {
		nickname: string;
	};
	content: string; // 文本内容 或 图片 URL
}