/**
 * Shared LLM generate() function used by every route.
 *
 * Features:
 * - Task-based model priority lists (live turns vs heavy tasks)
 * - Circuit breaker per provider+model
 * - AbortController timeouts (3s TTFT for live, 20s for heavy)
 * - Hedging for live turns: fire second provider at 1.5s if no response
 * - JSON mode with Zod validation and one retry on same provider
 * - Structured logging: provider, model, latency, failure reason
 */

import { z } from "zod";
import {
  LIVE_TURN_MODELS,
  HEAVY_TASK_MODELS,
  LIVE_TTFT_MS,
  HEDGE_FIRE_MS,
  HEAVY_TIMEOUT_MS,
  PROVIDERS,
  type ModelConfig,
} from "./core/config";
import { isOpen } from "./providers/circuit-breaker";
import { geminiGenerate } from "./adapters/gemini-adapter";
import { openaiCompatGenerate } from "./adapters/openai-compat-adapter";
import type { GenerateOptions, GenerateResult } from "./adapters/gemini-adapter";

export type TaskType = "live" | "heavy";

export interface LLMGenerateOptions {
  task: TaskType;
  system: string;
  /** Plain text prompt (user turn content) */
  prompt: string;
  /** If provided, parse/validate LLM output with this Zod schema */
  jsonSchema?: z.ZodTypeAny;
}

export interface AttemptLog {
  provider: string;
  model: string;
  outcome: "success" | "error" | "circuit_broken" | "disabled";
  latencyMs: number;
  error?: string;
}

export interface ExtendedGenerateResult extends GenerateResult {
  attempts: AttemptLog[];
}

// ─── Environment Outage Simulation ──────────────────────────────────────────

export function getDisabledProviders(): Set<string> {
  const envStr = process.env.LLM_DISABLE_PROVIDERS || "";
  return new Set(
    envStr
      .toLowerCase()
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
  );
}

// ─── Startup Table Logger ───────────────────────────────────────────────────

let loggedStartupTable = false;
export function logLLMStartupTable() {
  if (loggedStartupTable) return;
  loggedStartupTable = true;
  const disabled = getDisabledProviders();

  console.log("\n=== LLM PROVIDER & MODEL REGISTRY ===");
  const rows = [
    ...LIVE_TURN_MODELS.map((m) => ({ task: "live", ...m })),
    ...HEAVY_TASK_MODELS.map((m) => ({ task: "heavy", ...m })),
  ].map((m) => {
    const provConfig = PROVIDERS[m.provider];
    const hasKey = provConfig ? !!process.env[provConfig.envKey] : false;
    const isDis = disabled.has(m.provider);
    const cb = isOpen(m.provider, m.id);
    return {
      Task: m.task,
      "Model ID": m.id,
      Provider: m.provider,
      Configured: hasKey ? "YES" : "NO (Missing Key)",
      Status: isDis ? "DISABLED (env)" : cb ? "CIRCUIT_OPEN" : "ACTIVE",
    };
  });
  console.table(rows);
  console.log("======================================\n");
}

// Only log in development when explicitly enabled via LLM_VERBOSE=true
if (process.env.NODE_ENV !== "production" && process.env.LLM_VERBOSE === "true" && !process.env.NEXT_PHASE) {
  try { logLLMStartupTable(); } catch {}
}
// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Generate text using the best available LLM for the given task.
 * Returns ExtendedGenerateResult with attempts[]. Throws if ALL providers fail.
 */
export async function generate(opts: LLMGenerateOptions): Promise<ExtendedGenerateResult> {
  const models = opts.task === "live" ? LIVE_TURN_MODELS : HEAVY_TASK_MODELS;
  const timeoutMs = opts.task === "live" ? LIVE_TTFT_MS : HEAVY_TIMEOUT_MS;
  const disabled = getDisabledProviders();
  const attempts: AttemptLog[] = [];

  // Filter out disabled & circuit-broken models
  const available = models.filter((m) => {
    if (disabled.has(m.provider)) {
      attempts.push({ provider: m.provider, model: m.id, outcome: "disabled", latencyMs: 0, error: "Disabled by LLM_DISABLE_PROVIDERS" });
      return false;
    }
    if (isOpen(m.provider, m.id)) {
      attempts.push({ provider: m.provider, model: m.id, outcome: "circuit_broken", latencyMs: 0, error: "Circuit open" });
      return false;
    }
    return true;
  });

  if (available.length === 0) {
    const errMessage = disabled.size > 0
      ? `[LLM] All providers disabled (${Array.from(disabled).join(",")}) or circuit-broken. No models available.`
      : "[LLM] All providers are circuit-broken. No models available.";
    throw new Error(errMessage);
  }

  if (opts.task === "live") {
    const res = await generateWithHedging(available, opts, timeoutMs, attempts);
    return { ...res, attempts };
  } else {
    const res = await generateSequential(available, opts, timeoutMs, attempts);
    return { ...res, attempts };
  }
}

// ─── Sequential fallback (heavy tasks) ───────────────────────────────────────

async function generateSequential(
  models: ModelConfig[],
  opts: LLMGenerateOptions,
  timeoutMs: number,
  attempts: AttemptLog[],
): Promise<GenerateResult> {
  let lastError: Error | null = null;

  for (const model of models) {
    const start = Date.now();
    try {
      const result = await callModel(model, opts, timeoutMs);

      // Validate JSON if schema provided
      if (opts.jsonSchema) {
        const validated = await validateAndRetry(result, model, opts, timeoutMs);
        attempts.push({ provider: model.provider, model: model.id, outcome: "success", latencyMs: Date.now() - start });
        return validated;
      }

      attempts.push({ provider: model.provider, model: model.id, outcome: "success", latencyMs: Date.now() - start });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ provider: model.provider, model: model.id, outcome: "error", latencyMs: Date.now() - start, error: message });
      lastError = err instanceof Error ? err : new Error(message);
      console.warn(`[LLM] Sequential: ${model.provider}/${model.id} failed, trying next. ${message}`);
    }
  }

  throw lastError ?? new Error("[LLM] All sequential providers failed");
}

// ─── Hedging (live turns: cross-provider) ───────────────────────────────────

async function generateWithHedging(
  availableModels: ModelConfig[],
  opts: LLMGenerateOptions,
  timeoutMs: number,
  attempts: AttemptLog[],
): Promise<GenerateResult> {
  if (availableModels.length === 0) throw new Error("[LLM] No models available for hedging");

  const primary = availableModels[0];

  // Re-order remaining models so first hedge is a DIFFERENT provider than primary
  const diffProviderHedge = availableModels.slice(1).find((m) => m.provider !== primary.provider);
  const remaining = availableModels.slice(1).filter((m) => m !== diffProviderHedge);
  const orderedModels: ModelConfig[] = [
    primary,
    ...(diffProviderHedge ? [diffProviderHedge, ...remaining] : availableModels.slice(1)),
  ];

  return new Promise<GenerateResult>((resolve, reject) => {
    let settled = false;
    let nextIndexToDispatch = 0;
    let activeDispatches = 0;
    let hedgeTimer: NodeJS.Timeout | null = null;
    let masterTimer: NodeJS.Timeout | null = null;

    function cleanup() {
      if (hedgeTimer) {
        clearTimeout(hedgeTimer);
        hedgeTimer = null;
      }
      if (masterTimer) {
        clearTimeout(masterTimer);
        masterTimer = null;
      }
    }

    function settle(result: GenerateResult) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function failAll(err: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

    function dispatchNext(): boolean {
      if (settled || nextIndexToDispatch >= orderedModels.length) {
        return false;
      }
      const model = orderedModels[nextIndexToDispatch++];
      activeDispatches++;
      const mStart = Date.now();

      callModel(model, opts, timeoutMs)
        .then(async (res) => {
          if (settled) return;
          // Validate JSON schema if required
          if (opts.jsonSchema) {
            const parsed = tryParseAndValidate(res.text, opts.jsonSchema);
            if (!parsed.ok) {
              const errMsg = `JSON validation failed for ${model.provider}/${model.id}: ${parsed.error}`;
              console.warn(`[LLM] ${errMsg}`);
              attempts.push({
                provider: model.provider,
                model: model.id,
                outcome: "error",
                latencyMs: Date.now() - mStart,
                error: errMsg,
              });
              activeDispatches--;
              // Cascade to next model
              if (!dispatchNext() && activeDispatches === 0) {
                failAll(new Error(errMsg));
              }
              return;
            }
          }

          attempts.push({
            provider: model.provider,
            model: model.id,
            outcome: "success",
            latencyMs: Date.now() - mStart,
          });
          settle(res);
        })
        .catch((err: unknown) => {
          if (settled) return;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(`[LLM] Hedge attempt failed for ${model.provider}/${model.id} (${Date.now() - mStart}ms): ${errMsg}`);
          attempts.push({
            provider: model.provider,
            model: model.id,
            outcome: "error",
            latencyMs: Date.now() - mStart,
            error: errMsg,
          });
          activeDispatches--;

          // Cascade to next model if available
          if (!dispatchNext() && activeDispatches === 0) {
            failAll(err instanceof Error ? err : new Error(errMsg));
          }
        });

      return true;
    }

    // 1. Dispatch primary model at t = 0
    dispatchNext();

    // 2. Hedging timer: dispatch cross-provider hedge at HEDGE_FIRE_MS if primary still in flight
    if (orderedModels.length > 1) {
      hedgeTimer = setTimeout(() => {
        if (!settled && nextIndexToDispatch < orderedModels.length) {
          const nextModel = orderedModels[nextIndexToDispatch];
          console.log(`[LLM] Hedging: firing ${nextModel.provider}/${nextModel.id} after ${HEDGE_FIRE_MS}ms (cross-provider race)`);
          dispatchNext();
        }
      }, HEDGE_FIRE_MS);
    }

    // 3. Master safety deadline: abort after timeout budget to prevent any UI hang
    const masterTimeoutMs = Math.max(timeoutMs * 2, 8000);
    masterTimer = setTimeout(() => {
      if (!settled) {
        failAll(new Error(`[LLM] Master hedging timeout (${masterTimeoutMs}ms) exceeded.`));
      }
    }, masterTimeoutMs);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callModel(
  model: ModelConfig,
  opts: LLMGenerateOptions,
  timeoutMs: number,
): Promise<GenerateResult> {
  const callOpts: GenerateOptions = {
    system: opts.system,
    prompt: opts.prompt,
    model: model.id,
    jsonSchema: opts.jsonSchema,
    timeoutMs,
  };

  if (model.provider === "gemini") {
    return geminiGenerate(callOpts);
  } else {
    return openaiCompatGenerate(model.provider, callOpts);
  }
}

async function validateAndRetry(
  result: GenerateResult,
  model: ModelConfig,
  opts: LLMGenerateOptions,
  timeoutMs: number,
): Promise<GenerateResult> {
  const parsed = tryParseAndValidate(result.text, opts.jsonSchema!);
  if (parsed.ok) return result;

  console.warn(
    `[LLM] JSON validation failed for ${model.provider}/${model.id}, retrying once. ${parsed.error}`,
  );

  const retry = await callModel(model, opts, timeoutMs);
  const retryParsed = tryParseAndValidate(retry.text, opts.jsonSchema!);
  if (retryParsed.ok) return retry;

  throw new Error(
    `[LLM] JSON schema validation failed after retry: ${retryParsed.error}`,
  );
}

export function tryParseAndValidate<T>(
  text: string,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; error: string } {
  let cleanText = text.trim();
  // Strip markdown code fences if present (e.g. ```json ... ```)
  cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let json: unknown;
  try {
    json = JSON.parse(cleanText);
  } catch {
    return { ok: false, error: "Not valid JSON" };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data };
}
