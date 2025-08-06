# QQ Markdown 转图片机器人

一个自动将 QQ 群聊中的 Markdown 消息转换为图片的机器人，基于 NapCat 框架。

![版本](https://img.shields.io/badge/version-1.0.0-blue)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green)

## ✨ 功能特性

- 🎯 **智能识别** - 自动检测群聊中的 Markdown 语法
- 🖼️ **图片渲染** - 将 Markdown 内容渲染为美观的图片
- 💬 **回复支持** - 支持回复功能，自动识别 `[CQ:reply,id=xxx]` 标签
- 🚀 **高性能** - 基于 Puppeteer 的高质量渲染引擎
- 🔧 **易配置** - 简单的环境变量配置

## 📦 快速开始

### 1. 克隆项目
```bash
git clone <your-repository-url>
cd QQbot
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境
复制 `.env.example` 为 `.env` 并填写配置：
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
# NapCat 配置
NAPCAT_HOST=127.0.0.1
NAPCAT_WEBSOCKET_PORT=3001
NAPCAT_ACCESS_TOKEN=your_access_token

# 机器人配置
TARGET_GROUP_ID=你的群组ID
TARGET_USER_ID=你的用户ID
```

### 4. 运行程序
```bash
# 构建项目
npm run build

# 启动机器人
npm start

# 或者开发模式（自动重启）
npm run dev
```

## ⚙️ 配置说明

| 变量名 | 说明 | 示例值 | 必需 |
|--------|------|---------|------|
| `NAPCAT_HOST` | NapCat 服务主机 | `127.0.0.1` | ✅ |
| `NAPCAT_WEBSOCKET_PORT` | WebSocket 端口 | `3001` | ✅ |
| `NAPCAT_ACCESS_TOKEN` | 访问令牌 | `your_token` | ✅ |
| `TARGET_GROUP_ID` | 监控的群组 ID | `123456789` | ✅ |
| `TARGET_USER_ID` | 监控的用户 ID | `987654321` | ✅ |

## 🔧 NapCat 配置

确保你的 NapCat 配置启用了 WebSocket 支持：

```json
{
  "http": {
    "enable": false
  },
  "ws": {
    "enable": true,
    "host": "127.0.0.1",
    "port": 3001
  },
  "wsReverse": {
    "enable": false
  }
}
```

## 📝 支持的 Markdown 语法

- **标题** (`# ## ###`)
- **粗体** (`**text**` 或 `__text__`)
- **斜体** (`*text*` 或 `_text_`)
- **列表** (`- item` 或 `1. item`)
- **代码块** (`` `code` `` 或 `````)
- **链接** (`[text](url)`)
- **图片** (`![alt](url)`)

## 🛠️ 开发说明

### 项目结构
```
src/
├── index.ts              # 入口文件
├── bot.ts                # 机器人核心逻辑
├── napcat-api.ts         # NapCat API 封装
├── markdown-detector.ts  # Markdown 检测器
├── markdown-renderer.ts  # Markdown 渲染器
└── types.ts              # 类型定义
```

### 开发命令
```bash
npm run dev        # 开发模式
npm run build      # 构建项目
npm run lint       # 代码检查
npm run typecheck  # 类型检查
```

## 🐛 常见问题

### Q: 机器人没有响应？
A: 检查以下配置：
- NapCat 是否正常运行
- WebSocket 端口是否正确
- TARGET_GROUP_ID 和 TARGET_USER_ID 是否正确

### Q: 图片渲染失败？
A: 可能的原因：
- Puppeteer 依赖缺失（第一次运行会自动下载 Chromium）
- 系统缺少必要的字体
- 内存不足

### Q: 如何获取群组 ID 和用户 ID？
A: 
- 群组 ID: 在群聊中发送消息，查看 NapCat 日志
- 用户 ID: 查看个人资料或通过 NapCat API 获取

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

⭐ 如果这个项目对你有帮助，请给个 Star！