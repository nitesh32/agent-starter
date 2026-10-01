import "dotenv/config";
import OpenAI from "openai";
import pLimit from "p-limit";
import type { z } from "zod";
import { config } from "./config.js";

export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;
export interface ChatOpts {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  label?: string;
}

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "missing",
  defaultHeaders: {
    "HTTP-Referer": process.env.APP_URL || "https://agentdate.onrender.com",
    "X-Title": "AgentDate",
  },
});

const limit = pLimit(config.concurrency);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryable(e: any): boolean {
  const s = e?.status;
  return s === 429 || s >= 500 || e?.name === "APIConnectionTimeoutError" || e?.name === "APIConnectionError";
}

async function callOnce(model: string, messages: ChatMessage[], opts: ChatOpts): Promise<string> {
  const t = Date.now();
  const res = await client.chat.completions.create(
    { model, messages, temperature: opts.temperature ?? 0.8, max_tokens: opts.maxTokens },
    { timeout: opts.timeoutMs ?? 60_000, maxRetries: 0 },
  );
  console.log(
    `[llm] ${opts.label ?? "-"} ${model} ${Date.now() - t}ms in=${res.usage?.prompt_tokens} out=${res.usage?.completion_tokens}`,
  );
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("empty LLM response");
  return text;
}

async function withRetry(model: string, messages: ChatMessage[], opts: ChatOpts): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callOnce(model, messages, opts);
    } catch (e) {
      if (attempt >= 2 || !retryable(e)) throw e;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

async function complete(model: string, messages: ChatMessage[], opts: ChatOpts): Promise<string> {
  return limit(async () => {
    try {
      return await withRetry(model, messages, opts);
    } catch (e) {
      if (model === config.models.fallback) throw e;
      console.warn(`[llm] ${model} failed (${(e as Error).message}); falling back to ${config.models.fallback}`);
      return withRetry(config.models.fallback, messages, opts);
    }
  });
}

export function chat(messages: ChatMessage[]): Promise<string>;
export function chat(model: string, messages: ChatMessage[], opts?: ChatOpts): Promise<string>;
export function chat(a: string | ChatMessage[], b?: ChatMessage[], opts: ChatOpts = {}): Promise<string> {
  if (Array.isArray(a)) return complete(process.env.OPENROUTER_MODEL || config.models.date, a, {});
  return complete(a, b!, opts);
}

function extractJSON(raw: string): unknown {
  const s = raw.replace(/```(?:json)?/gi, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? s.slice(start, end + 1) : s);
}

export async function chatJSON<T extends z.ZodTypeAny>(
  model: string,
  messages: ChatMessage[],
  schema: T,
  opts: ChatOpts = {},
): Promise<z.output<T>> {
  const msgs: ChatMessage[] = [
    { role: "system", content: "Respond with a single valid JSON object only. No prose, no markdown fences." },
    ...messages,
  ];
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await complete(model, msgs, { temperature: 0.4, ...opts });
    try {
      return schema.parse(extractJSON(raw));
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      msgs.push(
        { role: "assistant", content: raw },
        { role: "user", content: `That JSON was invalid: ${lastErr.slice(0, 1500)}\nReturn the corrected JSON only.` },
      );
    }
  }
  throw new Error(`LLM returned invalid JSON: ${lastErr.slice(0, 300)}`);
}
