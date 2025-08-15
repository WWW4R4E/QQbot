export interface MarkdownAnalysis {
	isMarkdown: boolean;
	syntaxHighlight?: string;
}

export interface MarkdownDetectionOptions {
	minLength?: number;
}

export class MarkdownDetector {
	private static readonly MARKDOWN_PATTERNS = [
		/#{1,6}\s+.+/,                    // 标题 # ## ### 等
		/\*\*[^*]+?\*\*/g,                // 粗体 **text**
		/(?<!\*)\*(?!\*)[^*]+?\*(?!\*)/g, // 斜体 *text* (避免与粗体冲突)
		/~~[^~]+?~~/g,                    // 删除线 ~~text~~
		/```[\s\S]*?```/g,                // 代码块 ```code```
		/(?<!`)`(?!`)[^`]+?`(?!`)/g,      // 行内代码 `code` (避免与代码块冲突)
		/\[([^\]]+?)\]\(([^)]+?)\)/g,     // 链接 [text](url)
		/!\[([^\]]*)\]\(([^)]+?)\)/g,     // 图片 ![alt](url)
		/^\s*[-*+]\s+/gm,                 // 无序列表 - * +
		/^\s*\d+\.\s+/gm,                 // 有序列表 1. 2. 3.
		/^\s*>\s+/gm,                     // 引用 >
		/^\s*\|.*?\|.*?\|/gm,            // 表格 |col1|col2|
		/^\s*-{3,}\s*$/gm,                // 分割线 ---
	];

	private static readonly CQ_CODE_PATTERN = /\[CQ:[^\]]+\]/g;
	

	static analyzeMarkdown(text: string): MarkdownAnalysis {
		// 如果包含 CQ 码，则不检测为 Markdown
		if (this.CQ_CODE_PATTERN.test(text)) {
			return {
				isMarkdown: false,
			};
		}
		
		const features: string[] = [];

		// 检查各种markdown语法
		this.MARKDOWN_PATTERNS.forEach((pattern, index) => {
			const matches = text.match(pattern);
			if (matches) {
				// 添加对应的特性
				switch (index) {
					case 0: features.push('标题'); break;
					case 1: features.push('粗体'); break;
					case 2: features.push('斜体'); break;
					case 3: features.push('删除线'); break;
					case 4: features.push('代码块'); break;
					case 5: features.push('行内代码'); break;
					case 6: features.push('链接'); break;
					case 7: features.push('图片'); break;
					case 8: features.push('列表'); break;
					case 9: features.push('列表'); break;
					case 10: features.push('引用'); break;
					case 11: features.push('表格'); break;
					case 12: features.push('分割线'); break;
				}
			}
		});
		const isMarkdown = features.length > 0;

		return {
			isMarkdown,
		};
	}



}
