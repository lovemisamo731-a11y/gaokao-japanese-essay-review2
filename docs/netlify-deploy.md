# Netlify 上线配置

这份配置用于把“高考日语作文批改助手”部署成可访问的网站，并启用真实 AI 批改与 OCR。

## 一、推荐部署方式

推荐使用 Git 连接 Netlify：

1. 将项目推送到 GitHub / GitLab / Bitbucket。
2. 在 Netlify 新建站点，选择对应仓库。
3. Netlify 会读取项目根目录的 `netlify.toml`，一般不需要在后台手动改构建配置。

## 二、Netlify 构建设置

如果 Netlify 后台需要手动填写，使用下面这组配置：

| 项目 | 值 |
|---|---|
| Base directory | 留空 |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Node version | `20` |

项目中的 `netlify.toml` 已经包含这些设置。

## 三、必须配置的环境变量

在 Netlify 后台进入：

Site configuration → Environment variables

添加：

| 变量名 | 示例值 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` | `sk-proj_xxx` | 必填，真实作文批改和 OpenAI OCR 使用 |
| `OPENAI_MODEL` | `gpt-5.2` | 批改模型 |
| `OCR_PROVIDER` | `openai` | OCR 方案，推荐先用 `openai` |
| `OCR_MODEL` | `gpt-5.2` | OCR 模型 |

如果使用 Google Cloud Vision 做 OCR，再额外添加：

| 变量名 | 示例值 | 说明 |
|---|---|---|
| `OCR_PROVIDER` | `google` | 切换到 Google Vision |
| `GOOGLE_VISION_API_KEY` | `xxx` | Google Vision API Key |

如果使用国内模型做 OCR，推荐阿里云百炼 / 通义千问 OCR：

| 变量名 | 示例值 | 说明 |
|---|---|---|
| `OCR_PROVIDER` | `dashscope` | 切换到阿里云百炼 OCR |
| `DASHSCOPE_API_KEY` | `sk-xxx` | 阿里云百炼 API Key |
| `DASHSCOPE_OCR_MODEL` | `qwen-vl-ocr-latest` | OCR 模型，可不填，默认使用该值 |
| `DASHSCOPE_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | 可不填，默认使用北京地域接口 |

不要把真实 API Key 写入前端代码、`netlify.toml` 或提交到仓库。

## 四、当前接口

上线后前端会调用同域接口：

| 路径 | 方法 | 作用 |
|---|---|---|
| `/api/ocr` | POST | 识别上传的手写作文图片 |
| `/api/review` | POST | 生成评分、错误纠正、句子润色和修改范文 |

这两个接口由 `netlify/functions` 提供，不需要单独部署服务器。

## 五、上线后验证

发布成功后，按这个顺序检查：

1. 打开 Netlify 提供的网址，例如 `https://xxx.netlify.app`。
2. 点击“填入 OCR 示例”。
3. 点击“识别手写日语”，确认作文文本能进入校对区。
4. 点击“开始批改”。
5. 确认结果区出现：
   - 评分总览
   - 错误纠正
   - 句子润色
   - 修改范文

如果没有配置 `OPENAI_API_KEY`，接口会返回演示数据；配置后会调用真实 AI。

## 六、生产环境建议

上线给老师试用前，建议再补：

- 教师访问密码或简单登录。
- 图片大小限制，例如 5MB。
- 接口频率限制，避免被滥用。
- 页面隐私提示：学生作文仅用于本次批改，不默认保存。
- 准备 20-30 篇真实作文样例，用老师人工分数校准 AI 评分。

## 七、常见问题

### 本地 `file://` 打开为什么不能真实批改？

因为 `file://` 页面无法使用 Netlify Functions。真实批改需要通过 Netlify 部署地址，或本地使用 `npm run dev`。

### 为什么 Publish directory 是 `dist`？

上线只需要 `index.html`、`styles.css`、`script.js`。构建时会复制这三个文件到 `dist`，避免把源码、配置文件和文档作为静态资源发布出去。

### 没有 OpenAI Key 能不能演示？

可以。未配置 `OPENAI_API_KEY` 时，`/api/review` 会返回内置演示批改结果；OCR 可以把 `OCR_PROVIDER` 设置成 `mock` 跑通演示流程。
