export function getEnv(name: string): string {
  const netlifyValue = globalThis.Netlify?.env.get(name);
  if (netlifyValue) return netlifyValue;
  return process.env[name] ?? "";
}

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("请求体必须是 JSON。");
  }
}

export function methodNotAllowed() {
  return json({ error: "Method not allowed" }, { status: 405 });
}
