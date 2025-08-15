# QQ Markdown 转图片机器人

一个自动将 QQ 群聊中的 Markdown 消息转换为图片的机器人，基于 NapCat 框架。支持 Gemini AI 对话功能。

![版本](https://img.shields.io/badge/version-1.0.0-blue)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green)

## ✨ 功能特性

- 🎯 **智能识别** - 自动检测群聊中的 Markdown 语法
- 🖼️ **图片渲染** - 将 Markdown 内容渲染为美观的图片
- 💬 **回复支持** - 支持回复功能，自动识别 `[CQ:reply,id=xxx]` 标签
- 🤖 **AI对话** - 集成 Gemini AI，通过艾特机器人进行智能对话
- 🎯 **多目标监听** - 支持监听多个群组和用户组合
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
NAPCAT_WEBSOCKET_PORT=3002
# NAPCAT_ACCESS_TOKEN=your_access_token_here

# 监听目标配置
# 新格式：支持多个群组和用户的组合，格式为 groupId1:userId1,groupId2:userId2
# 示例：监听群组123456中的用户789012和群组456789中的用户012345
TARGETS=123456:789012,456789:012345

# Gemini API 配置
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-1.5-flash

# 代理配置 (如果需要)
# 如果您的网络需要通过代理访问外部服务，请取消注释并配置
# HTTPS_PROXY=http://127.0.0.1:7890
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

| 变量名                  | 说明                 | 示例值                  | 必需 |
| ----------------------- | -------------------- | ----------------------- | ---- |
| `NAPCAT_HOST`           | NapCat 服务主机      | `127.0.0.1`             | ✅    |
| `NAPCAT_WEBSOCKET_PORT` | WebSocket 端口       | `3002`                  | ✅    |
| `NAPCAT_ACCESS_TOKEN`   | 访问令牌             | `your_token`            | ❌    |
| `TARGETS`               | 监控的群组和用户组合 | `123456:789012`         | ✅    |
| `GEMINI_API_KEY`        | Gemini API 密钥      | `AIzaSy...`             | ❌    |
| `GEMINI_MODEL`          | Gemini 模型          | `gemini-1.5-flash`      | ❌    |
| `HTTPS_PROXY`           | HTTPS 代理地址       | `http://127.0.0.1:7890` | ❌    |

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
    "port": 3002
  },
  "wsReverse": {
    "enable": false
  }
}
```

## 🤖 AI 对话功能

本机器人集成了 Gemini AI 对话功能：

1. 在群聊中艾特机器人（@机器人）
2. 输入您想要询问的问题
3. 机器人会自动调用 Gemini API 并返回答案

如果回答中包含 Markdown 格式，机器人会自动将其渲染为图片发送。

## 📝 支持的 Markdown 语法

- **标题** (`# ## ###`)
- **粗体** (`**text**` 或 `__text__`)
- **斜体** (`*text*` 或 `_text_`)
- **删除线** (`~~text~~`)
- **列表** (`- item` 或 `1. item`)
- **代码块** (`` `code` `` 或 `````)
- **链接** (`[text](url)`)
- **图片** (`![alt](url)`)
- **引用** (`> text`)
- **表格** (`|col1|col2|`)
- **分割线** (`---`)

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
- TARGETS 配置是否正确

### Q: 图片渲染失败？
A: 可能的原因：
- Puppeteer 依赖缺失（第一次运行会自动下载 Chromium）
- 系统缺少必要的字体
- 内存不足

### Q: Gemini 功能无法使用？
A: 检查以下配置：
- GEMINI_API_KEY 是否正确配置
- 网络连接是否正常（可能需要代理）
- GEMINI_MODEL 是否正确

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
