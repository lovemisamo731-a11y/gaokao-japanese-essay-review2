import type { Config, Context } from "@netlify/functions";
import { extractOutputText, callOpenAI } from "./_shared/openai.js";
import { getEnv, json, methodNotAllowed, readJson } from "./_shared/http.js";
import { mockReview } from "./_shared/mock.js";

type ReviewRequest = {
  essayType?: "major" | "minor";
  minorType?: string;
  prompt?: string;
  essay?: string;
  studentName?: string;
};

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "rubric", "corrections", "polish", "modelEssay"],
  properties: {
    score: {
      type: "object",
      additionalProperties: false,
      required: ["total", "max", "level", "summary", "majorIssues"],
      properties: {
        total: { type: "number" },
        max: { type: "number" },
        level: { type: "string" },
        summary: { type: "string" },
        majorIssues: { type: "array", items: { type: "string" } },
      },
    },
    rubric: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "max", "score", "reason"],
        properties: {
          name: { type: "string" },
          max: { type: "number" },
          score: { type: "number" },
          reason: { type: "string" },
        },
      },
    },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "badge", "items"],
        properties: {
          category: { type: "string" },
          badge: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["original", "wrong", "problem", "fix", "explain"],
              properties: {
                original: { type: "string" },
                wrong: { type: "string" },
                problem: { type: "string" },
                fix: { type: "string" },
                explain: { type: "string" },
              },
            },
          },
        },
      },
    },
    polish: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "polished", "point", "reusable"],
        properties: {
          original: { type: "string" },
          polished: { type: "string" },
          point: { type: "string" },
          reusable: { type: "string" },
        },
      },
    },
    modelEssay: {
      type: "object",
      additionalProperties: false,
      required: ["title", "essay", "explanation", "improvements"],
      properties: {
        title: { type: "string" },
        essay: { type: "string" },
        explanation: { type: "string" },
        improvements: { type: "array", items: { type: "string" } },
      },
    },
  },
};

function buildPrompt(body: Required<ReviewRequest>) {
  const maxScore = body.essayType === "major" ? 30 : 10;
  const typeName = body.essayType === "major" ? "大作文" : `${body.minorType || "应用文"}类小作文`;
  const rubric =
    body.essayType === "major"
      ? "大作文30分：内容完整度6、结构逻辑5、语法准确性7、助词使用4、词汇与表达4、文体统一与自然度2、字数与格式2。"
      : "小作文10分：信息点完整3、应用文格式2、语法准确性2、助词使用1、表达得体自然1、文体统一1。";

  return `
你是中国高考日语作文阅卷老师，正在给老师提供作文批改结果。请全程用中文解释，日语只用于原句、修改句、润色句和范文。

作文类型：${typeName}
满分：${maxScore}
评分标准：${rubric}
学生：${body.studentName || "未填写"}

题目/要求：
${body.prompt}

学生作文：
${body.essay}

请严格返回 JSON，不要输出 Markdown。要求：
1. 分数要符合高考日语水平，不要过松。
2. corrections 按错误类型分组，尤其关注助词错误、语法错误、表达不自然、文体问题、格式问题。
3. 每条 corrections.items 的 wrong 必须是 original 中实际出现的具体错误片段，前端会用它红色标注。
4. modelEssay 是“修改后的范文”，保留学生原意，表达自然，但不要超过普通高考日语优秀作文水平。
5. 小作文要特别检查便条、邮件、通知、留言格式。
`;
}

function buildFastReviewPrompt(body: Required<ReviewRequest>) {
  const maxScore = body.essayType === "major" ? 30 : 10;
  const typeName = body.essayType === "major" ? "大作文" : `${body.minorType || "应用文"}类小作文`;
  const rubric =
    body.essayType === "major"
      ? "内容6、结构5、语法7、助词4、词汇表达4、文体自然2、字数格式2。"
      : "信息点3、格式2、语法2、助词1、表达得体1、文体1。";

  return `/no_think
你是中国高考日语作文阅卷老师。请用中文批改，日语只用于原句、修改句、润色句和范文。

作文类型：${typeName}
满分：${maxScore}
评分标准：${rubric}
学生：${body.studentName || "未填写"}

题目/要求：
${body.prompt}

学生作文：
${body.essay}

只返回 JSON 对象，不要 Markdown。字段必须完全如下：
{
  "score": { "total": 数字, "max": ${maxScore}, "level": "优秀/良好/中等/需加强", "summary": "80字内", "majorIssues": ["最多3条"] },
  "rubric": [{ "name": "评分项", "max": 数字, "score": 数字, "reason": "20字内" }],
  "corrections": [{ "category": "错误类型", "badge": "标签", "items": [{ "original": "原句", "wrong": "原句中实际出现的错误片段", "problem": "问题", "fix": "修改句", "explain": "40字内" }] }],
  "polish": [{ "original": "原句", "polished": "润色句", "point": "提升点", "reusable": "可复用表达" }],
  "modelEssay": { "title": "修改后的范文", "essay": "保留原意的高考水平日语范文", "explanation": "60字内", "improvements": ["最多3条"] }
}
数量限制：corrections 最多3组，每组最多2条；polish 最多3条；范文不要超过学生原文长度的1.5倍。`;
}

async function reviewWithOpenAI(body: Required<ReviewRequest>) {
  const model = getEnv("OPENAI_MODEL") || "gpt-5.2";
  const response = await callOpenAI({
    model,
    input: buildPrompt(body),
    text: {
      format: {
        type: "json_schema",
        name: "japanese_essay_review",
        strict: true,
        schema: reviewSchema,
      },
    },
    max_output_tokens: 4500,
  });

  return JSON.parse(extractOutputText(response));
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const source = fenced?.[1]?.trim() || trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型没有返回可解析的 JSON。");
  }

  return source.slice(start, end + 1);
}

async function reviewWithDashScope(body: Required<ReviewRequest>) {
  const apiKey = getEnv("DASHSCOPE_API_KEY");
  if (!apiKey) throw new Error("DASHSCOPE_API_KEY 未配置。");

  const model = getEnv("DASHSCOPE_REVIEW_MODEL") || getEnv("DASHSCOPE_MODEL") || "qwen-plus";
  const endpoint =
    getEnv("DASHSCOPE_BASE_URL") || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是中国高考日语作文阅卷老师。关闭思考，快速批改。必须只返回一个 JSON 对象，不要 Markdown，不要解释 JSON 以外的文字。",
        },
        {
          role: "user",
          content: buildFastReviewPrompt(body),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      enable_thinking: false,
    }),
  });

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
    message?: string;
  };

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || payload.message || "DashScope 批改请求失败。");
  }

  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("DashScope 批改没有返回文本。");

  return JSON.parse(extractJsonObject(text));
}

function streamJsonWhileWaiting(work: () => Promise<unknown>) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(" "));
        }, 5000);

        try {
          const data = await work();
          controller.enqueue(encoder.encode(JSON.stringify(data)));
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ error: error instanceof Error ? error.message : "AI 批改失败。" })
            )
          );
        } finally {
          clearInterval(keepAlive);
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return methodNotAllowed();

  try {
    const body = await readJson<ReviewRequest>(req);
    if (!body.prompt || !body.essay) {
      return json({ error: "缺少题目要求或作文文本。" }, { status: 400 });
    }

    const normalized: Required<ReviewRequest> = {
      essayType: body.essayType || "major",
      minorType: body.minorType || "",
      prompt: body.prompt,
      essay: body.essay,
      studentName: body.studentName || "",
    };

    const provider = (getEnv("REVIEW_PROVIDER") || getEnv("OCR_PROVIDER") || "openai").toLowerCase();
    if (provider === "mock") {
      return json(mockReview(normalized.essayType, normalized.minorType));
    }

    if (provider === "dashscope" || provider === "qwen") {
      return streamJsonWhileWaiting(() => reviewWithDashScope(normalized));
    }

    if (!getEnv("OPENAI_API_KEY")) {
      return json(mockReview(normalized.essayType, normalized.minorType));
    }

    return json(await reviewWithOpenAI(normalized));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "AI 批改失败。" }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/review",
  method: ["POST"],
};
