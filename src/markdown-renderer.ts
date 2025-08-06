import puppeteer, { Browser } from 'puppeteer';
import MarkdownIt from 'markdown-it';
import * as fs from 'fs';
import * as path from 'path';

export class MarkdownRenderer {
  private md: MarkdownIt;
  private browser?: Browser;

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    });
  }

  async init(): Promise<void> {
    // 尝试使用系统已安装的 Chrome 浏览器
    const launchOptions: any = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };

    // 在 Windows 上尝试常见的 Chrome 安装路径
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Users\\' + require('os').userInfo().username + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];

    // 查找可用的浏览器
    for (const chromePath of possiblePaths) {
      if (require('fs').existsSync(chromePath)) {
        launchOptions.executablePath = chromePath;
        console.log(`使用浏览器: ${chromePath}`);
        break;
      }
    }

    this.browser = await puppeteer.launch(launchOptions);
  }

  async destroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private generateHTML(markdownContent: string): string {
    const htmlContent = this.md.render(markdownContent);
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Preview</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: white;
    }
    
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 10px; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 8px; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.875em; }
    h6 { font-size: 0.85em; color: #6a737d; }
    
    p { margin-bottom: 16px; }
    
    code {
      background: #f6f8fa;
      border-radius: 3px;
      font-size: 85%;
      margin: 0;
      padding: 0.2em 0.4em;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }
    
    pre {
      background: #f6f8fa;
      border-radius: 6px;
      font-size: 85%;
      line-height: 1.45;
      overflow: auto;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    pre code {
      background: transparent;
      border: 0;
      display: inline;
      line-height: inherit;
      margin: 0;
      max-width: auto;
      overflow: visible;
      padding: 0;
      word-wrap: normal;
    }
    
    blockquote {
      border-left: 4px solid #dfe2e5;
      margin: 0 0 16px 0;
      padding: 0 16px;
      color: #6a737d;
    }
    
    ul, ol {
      margin-bottom: 16px;
      padding-left: 2em;
    }
    
    li {
      margin-bottom: 4px;
    }
    
    table {
      border-collapse: collapse;
      margin-bottom: 16px;
      width: 100%;
    }
    
    table th, table td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
    }
    
    table th {
      background: #f6f8fa;
      font-weight: 600;
    }
    
    table tr:nth-child(2n) {
      background: #f6f8fa;
    }
    
    a {
      color: #0366d6;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    strong {
      font-weight: 600;
    }
    
    em {
      font-style: italic;
    }
    
    del {
      text-decoration: line-through;
    }
    
    hr {
      border: none;
      border-top: 1px solid #eaecef;
      height: 1px;
      margin: 24px 0;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
  }

  async renderToImage(markdownContent: string): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    const page = await this.browser.newPage();
    
    try {
      const html = this.generateHTML(markdownContent);
      
      await page.setContent(html, { waitUntil: 'networkidle2' });
      await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
      
      // 获取内容的实际高度
      const bodyHeight = await page.evaluate(() => {
        return document.body.scrollHeight;
      });
      
      // 设置页面高度为内容高度
      await page.setViewport({ 
        width: 800, 
        height: Math.max(600, bodyHeight), 
        deviceScaleFactor: 2 
      });
      
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
        omitBackground: false
      });
      
      return screenshot as Buffer;
    } finally {
      await page.close();
    }
  }

  async saveToFile(markdownContent: string, outputPath: string): Promise<string> {
    const imageBuffer = await this.renderToImage(markdownContent);
    
    // 确保目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, imageBuffer);
    return outputPath;
  }
}