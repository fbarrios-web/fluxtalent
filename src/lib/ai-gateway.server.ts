// Server-only helper for Lovable AI Gateway
const BASE = "https://ai.gateway.lovable.dev/v1";

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
