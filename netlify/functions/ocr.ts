import type { Config, Context } from "@netlify/functions";
import { extractOutputText, callOpenAI } from "./_shared/openai.js";
import { getEnv, json, methodNotAllowed, readJson } from "./_shared/http.js";
import { mockOcrText } from "./_shared/mock.js";

type OcrRequest = {
  imageDataUrl?: string;
  essayType?: "major" | "minor";
  minorType?: string;
};

function stripDataUrl(dataUrl: string) {
  return dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

async function ocrWithOpenAI(imageDataUrl: string) {
  const model = getEnv("OCR_MODEL") || getEnv("OPENAI_MODEL") || "gpt-5.2";
  const response = await callOpenAI({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "请只识别图片中的日语手写作文正文。保留原有日语文字、标点和换行。不要批改，不要解释，不要输出中文说明。",
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
            detail: "high",
          },
        ],
      },
    ],
    max_output_tokens: 1600,
  });

  return extractOutputText(response);
}

async function ocrWithGoogleVision(imageDataUrl: string) {
  const apiKey = getEnv("GOOGLE_VISION_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_VISION_API_KEY 未配置。");

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: stripDataUrl(imageDataUrl) },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["ja"] },
        },
      ],
    }),
  });

  const payload = (await response.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string }; error?: { message?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok || payload.error || payload.responses?.[0]?.error) {
    throw new Error(payload.error?.message || payload.responses?.[0]?.error?.message || "Google Vision OCR 请求失败。");
  }

  return payload.responses?.[0]?.fullTextAnnotation?.text?.trim() || "";
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return methodNotAllowed();

  try {
    const body = await readJson<OcrRequest>(req);
    if (!body.imageDataUrl) {
      return json({ error: "缺少 imageDataUrl。" }, { status: 400 });
    }

    const provider = (getEnv("OCR_PROVIDER") || "openai").toLowerCase();
    if (provider === "mock") {
      return json({ text: mockOcrText(body.essayType || "major"), provider: "mock" });
    }

    if (provider === "google") {
      return json({ text: await ocrWithGoogleVision(body.imageDataUrl), provider: "google" });
    }

    return json({ text: await ocrWithOpenAI(body.imageDataUrl), provider: "openai" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "OCR 识别失败。" }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/ocr",
  method: ["POST"],
};
