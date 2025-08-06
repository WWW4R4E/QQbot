export class MarkdownDetector {
  private static readonly MARKDOWN_PATTERNS = [
    /#{1,6}\s+.+/,                    // 标题 # ## ### 等
    /\*\*[^*]+\*\*/,                  // 粗体 **text**
    /\*[^*]+\*/,                      // 斜体 *text*
    /~~[^~]+~~/,                      // 删除线 ~~text~~
    /```[\s\S]*?```/,                 // 代码块 ```code```
    /`[^`]+`/,                        // 行内代码 `code`
    /\[([^\]]+)\]\(([^)]+)\)/,        // 链接 [text](url)
    /!\[([^\]]*)\]\(([^)]+)\)/,       // 图片 ![alt](url)
    /^\s*[-*+]\s+/m,                  // 无序列表 - * +
    /^\s*\d+\.\s+/m,                  // 有序列表 1. 2. 3.
    /^\s*>\s+/m,                      // 引用 >
    /^\s*\|.*\|.*\|/m,               // 表格 |col1|col2|
    /^\s*---+\s*$/m,                  // 分割线 ---
  ];

  static isMarkdown(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    // 检查是否包含任何 markdown 语法
    return this.MARKDOWN_PATTERNS.some(pattern => pattern.test(text));
  }

  static getMarkdownFeatures(text: string): string[] {
    const features: string[] = [];
    
    if (/#{1,6}\s+.+/.test(text)) features.push('标题');
    if (/\*\*[^*]+\*\*/.test(text)) features.push('粗体');
    if (/\*[^*]+\*/.test(text)) features.push('斜体');
    if (/```[\s\S]*?```/.test(text)) features.push('代码块');
    if (/`[^`]+`/.test(text)) features.push('行内代码');
    if (/\[([^\]]+)\]\(([^)]+)\)/.test(text)) features.push('链接');
    if (/!\[([^\]]*)\]\(([^)]+)\)/.test(text)) features.push('图片');
    if (/^\s*[-*+]\s+/m.test(text)) features.push('列表');
    if (/^\s*>\s+/m.test(text)) features.push('引用');
    if (/^\s*\|.*\|.*\|/m.test(text)) features.push('表格');

    return features;
  }
}