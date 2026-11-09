/**
 * TTS proxy route (Sarvam Bulbul v3).
 *
 * - Strip markdown, code blocks, URLs, emojis before synthesis
 * - Hash-based cache key (sha256 of text+voice) — safe for large inputs
 * - Per-user and global daily character budgets, configurable via env
 *   (charged only for characters Sarvam actually synthesised; cache hits are free)
 * - Per-chunk request timeout
 * - Multiple free-tier keys (SARVAM_API_KEYS=key1,key2): a key that reports quota
 *   exhaustion is skipped until the next UTC day, and the next key is tried
 * - Fallback to browser SpeechSynthesis with { fallback: true, cause, reason }, where
 *   `cause` tells quota exhaustion apart from timeouts and provider errors
 * - Returns JSON on every error path
 *
 * Shared state (audio cache, daily budgets, blocked keys) lives in Redis when REDIS_URL is
 * reachable, so it holds across server instances and restarts; otherwise it falls back to
 * per-process memory. The provider quota is still the real limit, which is why quota responses
 * from Sarvam are classified and logged as `quota_exhausted`.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { logEvalLatency } from "@/src/eval/analytics/logger";
import { logEvent } from "@/src/lib/security/audit";
import { checkTtsLimit } from "@/src/lib/security/rate-limit";
import { key as redisKey, withRedis } from "@/src/lib/core/redis";

// ─── Config ───────────────────────────────────────────────────────────────────

const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const SARVAM_API = "https://api.sarvam.ai/text-to-speech";
const MAX_CHUNK_CHARS = 400;                                          // Sarvam Bulbul v3 safe limit
const MAX_TEXT_CHARS = 2000;                                          // Per-request input cap
const GLOBAL_DAILY_CHARS = envInt("SARVAM_GLOBAL_DAILY_CHARS", 200_000);
const USER_DAILY_CHARS = envInt("SARVAM_USER_DAILY_CHARS", 5_000);
const CHUNK_TIMEOUT_MS = envInt("SARVAM_TIMEOUT_MS", 8_000);
const RATE_LIMIT_COOLDOWN_MS = 60_000;                                // short pause after a per-minute 429
const CACHE_MAX_ENTRIES = 500;

/** Why a request fell back to browser speech. Returned to the client and logged. */
type FallbackCause =
  | "quota_exhausted"   // Sarvam says the key's quota/credits are used up, or the local daily cap is reached
  | "rate_limited"      // per-minute limit (Sarvam 429 without quota wording, or our own TTS rate limiter)
  | "timeout"           // a chunk didn't return within SARVAM_TIMEOUT_MS
  | "provider_error"    // 5xx, malformed response, network failure
  | "auth_error"        // every configured key was rejected (401/403 without quota wording)
  | "not_configured"    // no key set
  | "empty_text";       // nothing left to speak after preprocessing

// ─── Zod schema ───────────────────────────────────────────────────────────────

const TTSRequestSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_CHARS),
  speaker: z.string().optional().default("ritu"),
});

// ─── Audio cache: in-process L1 + shared Redis L2 (hash → base64 audio chunks) ─
//
// Redis makes a phrase synthesised once (greeting, fallback questions, repeated prompts) free
// for every instance and after restarts, which directly saves Sarvam free-tier quota.

const ttsCache = new Map<string, string[]>();
const CACHE_TTL_SEC = envInt("TTS_CACHE_TTL_SEC", 7 * 24 * 3600);

function cacheKey(text: string, speaker: string): string {
  return createHash("sha256")
    .update(`${speaker}:${text}`)
    .digest("hex");
}

function rememberLocally(hash: string, audios: string[]) {
  ttsCache.set(hash, audios);
  if (ttsCache.size > CACHE_MAX_ENTRIES) {
    const firstKey = ttsCache.keys().next().value;
    if (firstKey) ttsCache.delete(firstKey);
  }
}

async function getCachedAudio(hash: string): Promise<{ audios: string[]; tier: "memory" | "redis" } | null> {
  const local = ttsCache.get(hash);
  if (local) return { audios: local, tier: "memory" };
  const raw = await withRedis((r) => r.get(redisKey("tts", "audio", hash)), () => null);
  if (!raw) return null;
  try {
    const audios = JSON.parse(raw) as string[];
    if (!Array.isArray(audios) || audios.length === 0) return null;
    rememberLocally(hash, audios);
    return { audios, tier: "redis" };
  } catch {
    return null;
  }
}

async function cacheAudio(hash: string, audios: string[]): Promise<void> {
  rememberLocally(hash, audios);
  await withRedis(
    (r) => r.set(redisKey("tts", "audio", hash), JSON.stringify(audios), "EX", CACHE_TTL_SEC).then(() => undefined),
    () => undefined,
  );
}

// ─── Per-user and global daily budget (Redis counters, memory fallback) ───────

interface DailyBudget {
  chars: number;
  date: string; // YYYY-MM-DD UTC
}

const userBudgets = new Map<string, DailyBudget>();
let globalBudget: DailyBudget = { chars: 0, date: todayUTC() };

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function memoryBudget(userId: string): DailyBudget {
  const today = todayUTC();
  if (globalBudget.date !== today) globalBudget = { chars: 0, date: today };
  const ub = userBudgets.get(userId) ?? { chars: 0, date: today };
  if (ub.date !== today) { ub.chars = 0; ub.date = today; }
  userBudgets.set(userId, ub);
  return ub;
}

const budgetKeys = (userId: string) => {
  const day = todayUTC();
  return [redisKey("tts", "budget", "global", day), redisKey("tts", "budget", "user", userId, day)] as const;
};

/** Current usage today: { global, user }. Shared across instances when Redis is up. */
async function budgetUsage(userId: string): Promise<{ global: number; user: number }> {
  return withRedis(
    async (r) => {
      const [g, u] = await r.mget(...budgetKeys(userId));
      return { global: Number(g) || 0, user: Number(u) || 0 };
    },
    () => {
      const ub = memoryBudget(userId);
      return { global: globalBudget.chars, user: ub.chars };
    },
  );
}

/** Checks without deducting, so failed synthesis doesn't consume budget. */
async function hasBudget(userId: string, charCount: number): Promise<boolean> {
  const used = await budgetUsage(userId);
  return used.global + charCount <= GLOBAL_DAILY_CHARS && used.user + charCount <= USER_DAILY_CHARS;
}

async function deductBudget(userId: string, charCount: number): Promise<void> {
  const [gk, uk] = budgetKeys(userId);
  await withRedis(
    async (r) => {
      // Counters expire two days later, so yesterday's keys clean themselves up.
      await r.multi().incrby(gk, charCount).expire(gk, 2 * 86400).incrby(uk, charCount).expire(uk, 2 * 86400).exec();
    },
    () => {
      const ub = memoryBudget(userId);
      globalBudget.chars += charCount;
      ub.chars += charCount;
    },
  );
}

// ─── API keys ─────────────────────────────────────────────────────────────────

/** Keys from SARVAM_API_KEYS (comma-separated), falling back to SARVAM_API_KEY. */
function configuredKeys(): string[] {
  const list = (process.env.SARVAM_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (list.length > 0) return list;
  const single = process.env.SARVAM_API_KEY?.trim();
  return single ? [single] : [];
}

// key fingerprint → unavailable until (epoch ms)
const keyBlockedUntil = new Map<string, number>();

const keyId = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 8);

function nextUtcMidnight(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

/** Keys not currently blocked. A block set by any instance (stored in Redis) applies to all. */
async function availableKeys(): Promise<string[]> {
  const keys = configuredKeys();
  if (keys.length === 0) return [];
  const remoteBlocked = await withRedis(
    async (r) => (await r.mget(...keys.map((k) => redisKey("tts", "keyblock", keyId(k))))).map(Boolean),
    () => keys.map(() => false),
  );
  const now = Date.now();
  return keys.filter((k, i) => !remoteBlocked[i] && (keyBlockedUntil.get(keyId(k)) ?? 0) <= now);
}

async function blockKey(key: string, untilMs: number): Promise<void> {
  keyBlockedUntil.set(keyId(key), untilMs);
  const ttl = Math.max(1000, untilMs - Date.now());
  await withRedis(
    (r) => r.set(redisKey("tts", "keyblock", keyId(key)), "1", "PX", ttl).then(() => undefined),
    () => undefined,
  );
}

// ─── Text preprocessing ───────────────────────────────────────────────────────

function stripForTTS(raw: string): string {
  return raw
    // Code fences
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    // Markdown headings
    .replace(/^#{1,6}\s+/gm, "")
    // Bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    // URLs
    .replace(/https?:\/\/\S+/g, "")
    // Markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Emojis (basic Unicode ranges)
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    // Bullet points
    .replace(/^[-*+]\s+/gm, "")
    // Multiple whitespace/newlines
    .replace(/\n{2,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text: string, maxLen = MAX_CHUNK_CHARS): string[] {
  const sentences = text.split(/(?<=[.?!])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= maxLen) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length > maxLen) {
        const words = sentence.split(" ");
        let wordChunk = "";
        for (const word of words) {
          if ((wordChunk + " " + word).trim().length <= maxLen) {
            wordChunk = (wordChunk + " " + word).trim();
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        if (wordChunk) current = wordChunk;
      } else {
        current = sentence;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

// ─── Sarvam call ──────────────────────────────────────────────────────────────

class SynthesisError extends Error {
  constructor(public kind: FallbackCause, message: string, public status?: number) {
    super(message);
  }
}

const QUOTA_WORDING = /quota|credit|insufficient|limit exceeded|exhausted|balance/i;

async function synthesizeChunk(chunk: string, speaker: string, key: string): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(SARVAM_API, {
      method: "POST",
      headers: {
        "api-subscription-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [chunk],
        target_language_code: "en-IN",
        speaker,
        pitch: 0,
        pace: 1.05,
        loudness: 1.5,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: "bulbul:v3",
      }),
      signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new SynthesisError("timeout", `Sarvam chunk timed out after ${CHUNK_TIMEOUT_MS}ms`);
    }
    throw new SynthesisError("provider_error", `Sarvam network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    const detail = errText.slice(0, 160);
    console.warn(`[TTS] Sarvam returned ${resp.status} key=${keyId(key)}: ${detail}`);
    if ((resp.status === 429 || resp.status === 402 || resp.status === 403) && QUOTA_WORDING.test(errText) && !/per minute|rate/i.test(errText)) {
      throw new SynthesisError("quota_exhausted", `Sarvam quota exhausted (${resp.status})`, resp.status);
    }
    if (resp.status === 429) throw new SynthesisError("rate_limited", "Sarvam rate limit (429)", 429);
    if (resp.status === 401 || resp.status === 403) throw new SynthesisError("auth_error", `Sarvam rejected key (${resp.status})`, resp.status);
    throw new SynthesisError("provider_error", `Sarvam API error ${resp.status}`, resp.status);
  }

  const data = await resp.json().catch(() => null);
  if (!data?.audios?.[0]) {
    throw new SynthesisError("provider_error", "No audio returned for chunk");
  }
  return data.audios[0] as string;
}

/**
 * Synthesises all chunks with one key; on quota/auth/rate errors marks that key unavailable
 * and retries with the next one. Timeouts and provider errors fall back immediately, since a
 * different key won't fix a slow or failing provider.
 */
async function synthesizeWithKeys(chunks: string[], speaker: string): Promise<string[]> {
  const keys = await availableKeys();
  if (keys.length === 0) {
    throw configuredKeys().length === 0
      ? new SynthesisError("not_configured", "TTS service not configured")
      : new SynthesisError("quota_exhausted", "All Sarvam keys are exhausted or blocked for today");
  }

  let lastErr: SynthesisError | null = null;
  for (const key of keys) {
    try {
      return await Promise.all(chunks.map((c) => synthesizeChunk(c, speaker, key)));
    } catch (err) {
      const e = err instanceof SynthesisError ? err : new SynthesisError("provider_error", String(err));
      lastErr = e;
      if (e.kind === "quota_exhausted") {
        await blockKey(key, nextUtcMidnight());
        console.error(`[TTS] QUOTA EXHAUSTED for key ${keyId(key)}; skipping it until next UTC day. Add another free-tier key to SARVAM_API_KEYS.`);
        continue;
      }
      if (e.kind === "auth_error") {
        await blockKey(key, Date.now() + 10 * 60_000);
        continue;
      }
      if (e.kind === "rate_limited") {
        await blockKey(key, Date.now() + RATE_LIMIT_COOLDOWN_MS);
        continue;
      }
      throw e;
    }
  }
  if (lastErr?.kind === "quota_exhausted") {
    console.error("[TTS] QUOTA EXHAUSTED on every configured Sarvam key — falling back to browser speech.");
  }
  throw lastErr ?? new SynthesisError("provider_error", "TTS synthesis failed");
}

// ─── Responses ────────────────────────────────────────────────────────────────

function fallbackResponse(
  req: NextRequest,
  userId: string,
  sessionId: string | null | undefined,
  cause: FallbackCause,
  reason: string,
) {
  logEvent(req, {
    userId,
    sessionId,
    type: "tts_fallback",
    meta: { cause, reason },
  });
  return NextResponse.json({ fallback: true, cause, reason });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let reqUserId = "";
  let reqSessionId: string | null = null;
  try {
    const { userId, sessionId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }
    reqUserId = userId;
    reqSessionId = sessionId;

    const rl = await checkTtsLimit(userId);
    if (!rl.allowed) {
      logEvent(req, { userId, sessionId, type: "rate_limited", meta: { bucket: "tts" } });
      return fallbackResponse(req, userId, sessionId, "rate_limited", "TTS rate limit exceeded");
    }

    const body = TTSRequestSchema.parse(await req.json());
    const speaker = body.speaker ?? "ritu";

    // Strip markdown / emoji / code before TTS
    const cleanText = stripForTTS(body.text);
    if (!cleanText) {
      return fallbackResponse(req, userId, sessionId, "empty_text", "Text empty after preprocessing");
    }

    const key = cacheKey(cleanText, speaker);

    // Cache hit (this instance or shared Redis) — free, no budget charged
    const cached = await getCachedAudio(key);
    if (cached) {
      console.log(`[TTS] Cache HIT (${cached.tier}) speaker=${speaker} len=${cleanText.length}`);
      return NextResponse.json({ audios: cached.audios, cached: true, fallback: false });
    }

    if (!(await hasBudget(userId, cleanText.length))) {
      console.warn(`[TTS] Daily budget reached user=${userId} len=${cleanText.length} limit=${GLOBAL_DAILY_CHARS}`);
      return fallbackResponse(req, userId, sessionId, "quota_exhausted", "Daily TTS character budget reached");
    }

    const chunks = chunkText(cleanText);
    console.log(`[TTS] Synthesizing ${chunks.length} chunk(s) speaker=${speaker} charsSent=${cleanText.length}`);

    const ttsStart = Date.now();
    logEvalLatency({
      interviewId: "active_session",
      turnId: "current",
      stage: "tts_start",
      ts: ttsStart,
    });

    let audioResults: string[];
    try {
      audioResults = await synthesizeWithKeys(chunks, speaker);
    } catch (err: unknown) {
      const e = err instanceof SynthesisError ? err : new SynthesisError("provider_error", String(err));
      return fallbackResponse(req, userId, sessionId, e.kind, e.message);
    }

    const ttsFinish = Date.now();
    logEvalLatency({
      interviewId: "active_session",
      turnId: "current",
      stage: "tts_finish",
      ts: ttsFinish,
      extra: { durationMs: ttsFinish - ttsStart },
    });

    if (audioResults.length === 0) {
      return fallbackResponse(req, userId, sessionId, "provider_error", "No audio generated");
    }

    // Charge only what was actually synthesised, and share the audio with every instance
    await Promise.all([deductBudget(userId, cleanText.length), cacheAudio(key, audioResults)]);

    return NextResponse.json({ audios: audioResults, cached: false, fallback: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected TTS error";
    console.error("[TTS] Unexpected error:", message);
    if (reqUserId) {
      return fallbackResponse(req, reqUserId, reqSessionId, "provider_error", message);
    }
    return NextResponse.json({
      fallback: true,
      cause: "provider_error",
      reason: message,
    });
  }
}
