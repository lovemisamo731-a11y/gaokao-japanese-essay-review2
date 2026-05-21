import { getEnv } from "./http.js";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

export async function callOpenAI(body: Record<string, unknown>, apiKeyName = "OPENAI_API_KEY") {
  const apiKey = getEnv(apiKeyName);
  if (!apiKey) {
    throw new Error(`${apiKeyName} 未配置。`);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as OpenAIResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI API 请求失败。");
  }

  return payload;
}

export function extractOutputText(response: OpenAIResponse): string {
  if (response.output_text) return response.output_text;

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("模型没有返回文本。");
  }

  return text;
}
