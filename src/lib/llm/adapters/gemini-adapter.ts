/**
 * Gemini adapter using @google/genai SDK.
 * Wraps generateContent into the shared GenerateResult interface.
 */

import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { HEAVY_TIMEOUT_MS } from "../core/config";
import { recordFailure, recordSuccess } from "../providers/circuit-breaker";

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

  // Fallback exhausted or spiky models (e.g. 3.8-flash 503s) to GEMINI_MODEL env or gemini-3.5-flash-lite
  const targetModel =
    opts.model === "gemini-3.8-flash"
      ? (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite")
      : (opts.model || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite");

  const timeoutMs = opts.timeoutMs ?? HEAVY_TIMEOUT_MS;
  const { promise: timeoutPromise, reject: rejectTimeout } = Promise.withResolvers<never>();
  const timer = setTimeout(() => rejectTimeout(new Error(`gemini/${targetModel} timed out after ${timeoutMs}ms`)), timeoutMs);

  const start = Date.now();
  const ai = getAiClient(apiKey);
  try {
    const result = await Promise.race([
      ai.models.generateContent({
        model: targetModel,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          ...(opts.jsonSchema ? { responseMimeType: "application/json" } : {}),
        },
      }),
      timeoutPromise,
    ]);
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    const text = result.text ?? "";

    console.log(
      `[LLM] gemini/${targetModel} ok ${latencyMs}ms`,
    );
    recordSuccess("gemini", targetModel);
    return { text, provider: "gemini", model: targetModel, latencyMs };
  } catch (err: unknown) {
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    const errorObj = err as { status?: number; statusCode?: number; message?: string; headers?: Record<string, string>; response?: { headers?: Record<string, string> } };

    const statusCode: number | undefined =
      errorObj?.status ?? errorObj?.statusCode ?? undefined;
    const retryAfter = parseRetryAfter(errorObj);

    console.warn(
      `[LLM] gemini/${targetModel} FAIL ${latencyMs}ms status=${statusCode} ${errorObj?.message}`,
    );
    recordFailure("gemini", targetModel, statusCode, retryAfter, errorObj?.message);
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
