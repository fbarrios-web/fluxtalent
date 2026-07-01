// Server-only helper for Lovable AI Gateway
const BASE = "https://ai.gateway.lovable.dev/v1";

// Retry helper: exponential backoff on 429 (rate limit) and 5xx (transient).
// Non-retriable errors (4xx other than 429) throw immediately.
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  let lastErr: any;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      // Retriable: 429 (rate limit) and 5xx
      if (res.status === 429 || res.status >= 500) {
        if (attempt === maxRetries) return res;
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        const backoff = retryAfter > 0
          ? retryAfter * 1000
          : Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 500);
        await new Promise(r => setTimeout(r, backoff));
        attempt++;
        continue;
      }
      return res; // non-retriable error surface
    } catch (e) {
      lastErr = e;
      if (attempt === maxRetries) throw e;
      await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)));
      attempt++;
    }
  }
  throw lastErr ?? new Error("AI gateway: retries exhausted");
}

export async function aiJSON<T = any>(opts: {
  system?: string;
  user: string | Array<any>;
  model?: string;
  schema?: { name: string; description: string; parameters: any };
}): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const messages: any[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.user });

  const body: any = {
    model: opts.model ?? "google/gemini-3-flash-preview",
    messages,
  };
  if (opts.schema) {
    body.tools = [{ type: "function", function: opts.schema }];
    body.tool_choice = { type: "function", function: { name: opts.schema.name } };
  } else {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  const toolCall = choice?.message?.tool_calls?.[0];
  const raw = toolCall ? toolCall.function.arguments : choice?.message?.content;
  if (!raw) throw new Error("AI: empty response");
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("AI: invalid JSON");
  }
}

export async function aiText(opts: { system?: string; user: string; model?: string }): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const messages: any[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.user });
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({ model: opts.model ?? "google/gemini-3-flash-preview", messages }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function aiGenerateImage(opts: {
  prompt: string;
  size?: string;
  model?: string;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const model = opts.model ?? "openai/gpt-image-2";
  const isGemini = model.startsWith("google/");
  const body: any = isGemini
    ? {
        model,
        messages: [{ role: "user", content: opts.prompt }],
        modalities: ["image", "text"],
      }
    : {
        model,
        prompt: opts.prompt,
        size: opts.size ?? "1024x1024",
        quality: "low",
        n: 1,
      };
  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI image ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json
    ?? data?.data?.[0]?.image?.b64_json
    ?? data?.images?.[0]?.b64_json;
  if (!b64) throw new Error("AI image: empty response");
  return b64 as string;
}
