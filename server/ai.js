/**
 * Thin OpenAI-compatible chat client.
 *
 * Configure with:
 *   OPENAI_API_KEY   required to enable AI tutoring
 *   OPENAI_BASE_URL  default https://api.openai.com/v1
 *   OPENAI_MODEL     default gpt-4o-mini
 *
 * The key is only ever read on the server. When it is missing the app falls
 * back to the built-in curriculum engine instead of failing.
 */

const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function aiStatus() {
  return { enabled: Boolean(API_KEY), model: API_KEY ? MODEL : null, baseUrl: API_KEY ? BASE_URL : null };
}

export class AIError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AIError";
    this.status = status;
  }
}

/**
 * Send a chat completion request. Throws AIError on failure so callers can
 * fall back gracefully and report the real reason.
 */
export async function aiChat(messages, options = {}) {
  if (!API_KEY) throw new AIError("AI service is not configured", 0);
  const { temperature = 0.6, maxTokens = 1400, json = false, timeout = 45000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AIError(`AI provider returned ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`, res.status);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") throw new AIError("AI provider returned an empty response", 502);
    return text.trim();
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err?.name === "AbortError") throw new AIError("AI request timed out", 504);
    throw new AIError(`AI request failed: ${err?.message || err}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

export function parseJsonLoose(text) {
  if (!text) return null;
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function aiJson(messages, options = {}) {
  const text = await aiChat(messages, { ...options, json: true });
  const parsed = parseJsonLoose(text);
  if (!parsed) throw new AIError("AI returned malformed JSON", 502);
  return parsed;
}
