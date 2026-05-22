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
      ? "大作文30分，按新题型六档：26-30要点全、准确流畅、表达丰富；20-25要点全、表达恰当；15-19写出大部分/部分要点、语言通顺；10-14部分要点、基本通顺；5-9少部分要点、欠通顺；0-4要点很少、表达不通或字数严重不足。训练字数通常280-320字，少于规定字数要明显扣分；用词/书写错误每处约0.5分，影响交际语法错误每处约1分，语法类常见封顶约5分，标点格式封顶约2分。"
      : "小应用文10分：9-10要点齐全、语言准确通顺、格式基本无误；4-8写出部分或大部分要点，但表达不够顺或有语法问题；0-3要点很少、表达不通顺或字数严重不足。训练字数通常80-120字，少于80字要扣分；用词/书写错误每处约0.5分，影响表达语法错误每处约1分，格式和标点错误有封顶扣分。";

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
1. 分数必须贴近真实高考训练阅卷，不要给人情分；短文、要点不足、明显语法/助词错误不能进入高分档。
2. corrections、polish、modelEssay 只能基于上方“学生作文”生成，严禁使用示例作文、模板作文或其他题材内容。
3. corrections 按错误类型分组，尤其关注助词错误、语法错误、表达不自然、文体问题、格式问题。
4. 每条 corrections.items.original 必须是学生作文中真实出现的完整句或短句；wrong 必须是 original 中实际出现的具体错误片段。
5. polish 的 original 必须逐字来自学生作文，不允许改成其他作文主题。
6. modelEssay 是“修改后的范文”，必须保留学生原意和主题，表达自然，但不要超过普通高考日语优秀作文水平。
7. 小作文要特别检查便条、邮件、通知、留言格式。
`;
}

function buildFastReviewPrompt(body: Required<ReviewRequest>) {
  const maxScore = body.essayType === "major" ? 30 : 10;
  const typeName = body.essayType === "major" ? "大作文" : `${body.minorType || "应用文"}类小作文`;
  const rubric =
    body.essayType === "major"
      ? "大作文30分六档：26-30优秀；20-25要点全表达恰当；15-19部分要点语言通顺；10-14部分要点基本通顺；5-9少量要点欠通顺；0-4很少要点/严重不足。训练字数280-320字，短文必须明显扣分。"
      : "小应用文10分三档：9-10要点齐全语言准确格式基本无误；4-8部分要点或表达不够顺；0-3要点很少/表达不通/字数严重不足。训练字数80-120字，少于80字扣分。";

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

只返回 JSON 对象，不要 Markdown。必须严格遵守：
- 只能批改下方“学生作文”，不得引用示例作文、模板作文或其他题材内容。
- corrections.items.original 必须是学生作文中实际出现的完整句或短句；wrong 必须是 original 中实际出现的片段。
- polish.original 必须逐字来自学生作文。
- modelEssay 必须保留学生作文原主题和原意，不得换成“春天/公园/勉强会”等无关内容。
- 分数按高考训练口径从严；短文、要点不足、语法/助词问题明显时不能给高分。

字段必须完全如下：
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

function toNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampScore(score: unknown, max: unknown) {
  const maxNumber = Math.max(0, toNumber(max, 0));
  const scoreNumber = toNumber(score, 0);
  return Math.round(Math.min(Math.max(scoreNumber, 0), maxNumber) * 10) / 10;
}

function countJapaneseChars(text: string) {
  return (text.match(/[\u3040-\u30ff\u3400-\u9fff々〆〤ー]/g) || []).length;
}

function scoreCapByLength(essay: string, essayType: "major" | "minor") {
  const length = countJapaneseChars(essay);

  if (essayType === "minor") {
    if (length < 40) return 3;
    if (length < 60) return 6;
    if (length < 80) return 8;
    if (length > 160) return 8.5;
    return 10;
  }

  if (length < 80) return 9;
  if (length < 140) return 14;
  if (length < 200) return 19;
  if (length < 260) return 24;
  if (length > 380) return 27;
  return 30;
}

function sentenceBelongsToEssay(sentence: unknown, essay: string) {
  if (typeof sentence !== "string") return false;
  const compactSentence = sentence.replace(/\s+/g, "");
  const compactEssay = essay.replace(/\s+/g, "");
  if (!compactSentence) return false;
  if (compactEssay.includes(compactSentence)) return true;
  return compactSentence.length >= 8 && compactEssay.includes(compactSentence.slice(0, 8));
}

function normalizeReviewResult(result: any, body: Required<ReviewRequest>) {
  const essayType = body.essayType;
  const maxTotal = essayType === "major" ? 30 : 10;
  const lengthCap = scoreCapByLength(body.essay, essayType);
  const rubric = Array.isArray(result.rubric)
    ? result.rubric.map((item: any) => {
        const max = Math.max(0, toNumber(item?.max, 0));
        return {
          ...item,
          max,
          score: clampScore(item?.score, max),
        };
      })
    : [];

  const total = Math.min(
    maxTotal,
    lengthCap,
    Math.round(rubric.reduce((sum: number, item: any) => sum + toNumber(item.score, 0), 0) * 10) / 10
  );
  const level =
    essayType === "major"
      ? total >= 26
        ? "优秀"
        : total >= 20
          ? "良好"
          : total >= 15
            ? "中等"
            : "需加强"
      : total >= 9
        ? "优秀"
        : total >= 4
          ? "中等"
          : "需加强";

  const corrections = Array.isArray(result.corrections)
    ? result.corrections
        .map((group: any) => ({
          ...group,
          items: Array.isArray(group?.items)
            ? group.items.filter((item: any) => sentenceBelongsToEssay(item?.original, body.essay))
            : [],
        }))
        .filter((group: any) => group.items.length)
    : [];
  const polish = Array.isArray(result.polish)
    ? result.polish.filter((item: any) => sentenceBelongsToEssay(item?.original, body.essay))
    : [];

  return {
    ...result,
    score: {
      ...result.score,
      total,
      max: maxTotal,
      level,
    },
    rubric,
    corrections,
    polish,
  };
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

  return normalizeReviewResult(JSON.parse(extractJsonObject(text)), body);
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
