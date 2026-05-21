# 高考日语作文批改助手

这是一个最快落地版本：静态前端 + Netlify Functions 后端。

## 功能

- 上传学生手写作文图片
- `/api/ocr` 识别日语手写文本
- 老师校对 OCR 文本
- `/api/review` 生成评分、错误纠正、句子润色和修改后的范文

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

填入：

```bash
OPENAI_API_KEY=sk-proj_xxx
OPENAI_MODEL=gpt-5.2
OCR_PROVIDER=openai
OCR_MODEL=gpt-5.2
```

3. 启动

```bash
npm run dev
```

打开 Netlify Dev 给出的本地地址，通常是 `http://localhost:8888`。

## OCR 方案

默认 `OCR_PROVIDER=openai`，只需要 OpenAI Key。

如果要用 Google Cloud Vision：

```bash
OCR_PROVIDER=google
GOOGLE_VISION_API_KEY=xxx
```

如果只想跑通演示：

```bash
OCR_PROVIDER=mock
```

## API 数据格式

见 [docs/api-schema.json](./docs/api-schema.json)。

## 部署到 Netlify

详细上线配置见 [docs/netlify-deploy.md](./docs/netlify-deploy.md)。

核心配置：

```bash
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
Node version: 20
```

在 Netlify 环境变量中添加 `.env.example` 里的变量。

前端不保存 API Key，所有密钥只在 Netlify Functions 中读取。
