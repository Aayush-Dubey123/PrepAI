/**
 * Gemini adapter using @google/genai SDK.
 * Wraps generateContent into the shared GenerateResult interface.
 */

import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { HEAVY_TIMEOUT_MS } from "./config";
import { recordFailure, recordSuccess } from "./circuit-breaker";

export interface GenerateOptions {
  system: string;
  /** Either a plain string or structured messages (ignored for Gemini — merged into prompt) */
  prompt: string;
  model: string;
  /** If provided, request JSON output and validate against this schema */
  jsonSchema?: z.ZodTypeAny;
  stream?: boolean;
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
}

let cachedAiClient: GoogleGenAI | null = null;
let lastApiKey: string | null = null;

function getAiClient(apiKey: string): GoogleGenAI {
  if (!cachedAiClient || lastApiKey !== apiKey) {
    cachedAiClient = new GoogleGenAI({ apiKey });
    lastApiKey = apiKey;
  }
  return cachedAiClient;
}

export async function geminiGenerate(
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const timeoutMs = opts.timeoutMs ?? HEAVY_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();
  const ai = getAiClient(apiKey);
  try {
    const result = await ai.models.generateContent({
      model: opts.model,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        ...(opts.jsonSchema ? { responseMimeType: "application/json" } : {}),
      },
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    const text = result.text ?? "";

    console.log(
      `[LLM] gemini/${opts.model} ok ${latencyMs}ms`,
    );
    recordSuccess("gemini", opts.model);
    return { text, provider: "gemini", model: opts.model, latencyMs };
  } catch (err: unknown) {
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    const errorObj = err as { status?: number; statusCode?: number; message?: string; headers?: Record<string, string>; response?: { headers?: Record<string, string> } };

    const statusCode: number | undefined =
      errorObj?.status ?? errorObj?.statusCode ?? undefined;
    const retryAfter = parseRetryAfter(errorObj);

    console.warn(
      `[LLM] gemini/${opts.model} FAIL ${latencyMs}ms status=${statusCode} ${errorObj?.message}`,
    );
    recordFailure("gemini", opts.model, statusCode, retryAfter, errorObj?.message);
    throw err;
  }
}

function parseRetryAfter(err: { headers?: Record<string, string>; response?: { headers?: Record<string, string> } } | undefined): number | undefined {
  const header =
    err?.headers?.["retry-after"] ??
    err?.response?.headers?.["retry-after"];
  if (!header) return undefined;
  const seconds = parseInt(header, 10);
  return isNaN(seconds) ? undefined : seconds * 1000;
}
