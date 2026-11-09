/**
 * src/lib/security/rate-limit.ts
 *
 * Separated rate limit buckets per action type.
 * Each action has its own key prefix, window, and counter — completely isolated.
 *
 * Storage:
 * - Redis (when REDIS_URL is set and reachable): a true sliding window per key, implemented as a
 *   sorted set updated atomically by one Lua script (one round trip). Shared by every server
 *   instance and survives restarts, so limits hold on serverless.
 * - In-memory fallback (Redis missing or down): a fixed window per process, as before.
 *
 * RATE_LIMIT_DISABLED=true (non-production only) bypasses all limits.
 * Idempotent replays with the same clientRequestId are NOT counted.
 */

import { randomUUID } from "crypto";
import { key as redisKey, redis, withRedis } from "@/src/lib/core/redis";

const IS_DISABLED =
  process.env.RATE_LIMIT_DISABLED === "true" && process.env.NODE_ENV !== "production";

// ─── Startup log (non-build dev only) ──────────────────────────────────────────
if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PHASE && process.env.RATE_LIMIT_VERBOSE === "true") {
  if (IS_DISABLED) {
    console.warn("[RATE_LIMIT] ⚠️  ALL rate limits DISABLED (RATE_LIMIT_DISABLED=true, non-production)");
  } else {
    console.log("[RATE_LIMIT] Limits active: interview_create=5/hr, turn=30/min, integrity=60/min, tts=20/min, parse_resume=10/hr, llm=5/min");
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WindowEntry {
  count: number;
  resetTime: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  retryAfterSec?: number;
}

// ─── In-memory stores (fallback; separate Map per action) ─────────────────────

const stores: Record<string, Map<string, WindowEntry>> = {
  interview_create: new Map(),
  interview_create_day: new Map(),
  turn: new Map(),
  integrity: new Map(),
  tts_req: new Map(),
  parse_resume: new Map(),
  llm: new Map(),
  drill_session_create: new Map(),
  drill_answer: new Map(),
};
// ─── Idempotency store ────────────────────────────────────────────────────────

/** Stores seen requestIds (client dedup). Max TTL = 10 minutes. */
const seenRequestIds = new Map<string, number>();

export function isReplayedRequest(clientRequestId: string | undefined): boolean {
  if (!clientRequestId) return false;
  const now = Date.now();

  // Clean up old entries if map grows
  if (seenRequestIds.size > 100) {
    for (const [id, ts] of seenRequestIds) {
      if (now - ts > 10 * 60 * 1000) seenRequestIds.delete(id);
    }
  }

  if (seenRequestIds.has(clientRequestId)) return true;
  seenRequestIds.set(clientRequestId, now);
  return false;
}

// ─── Redis sliding window ─────────────────────────────────────────────────────

// KEYS[1] = bucket key; ARGV = now(ms), window(ms), limit, unique member
// Returns {1, 0} when allowed, {0, retryAfterMs} when blocked.
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] then retry = tonumber(oldest[2]) + window - now end
  return {0, retry}
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
return {1, 0}
`;

function blocked(retryAfterSec: number): RateLimitResult {
  const s = Math.max(1, retryAfterSec);
  return {
    allowed: false,
    reason: `Too many requests — please wait ${s}s`,
    code: "RATE_LIMITED",
    retryAfterSec: s,
  };
}

// ─── In-memory fixed window (fallback) ────────────────────────────────────────

function checkMemory(
  store: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  // Periodic sweep of expired keys when store grows to prevent memory bloat
  if (store.size > 100) {
    for (const [k, v] of store) {
      if (now > v.resetTime) store.delete(k);
    }
  }

  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= limit) {
    return blocked(Math.ceil((entry.resetTime - now) / 1000));
  }

  entry.count++;
  return { allowed: true };
}

async function check(
  bucket: keyof typeof stores,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (IS_DISABLED) return { allowed: true };

  return withRedis(
    async (r) => {
      const [ok, retryMs] = (await r.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey("rl", key),
        Date.now(),
        windowMs,
        limit,
        randomUUID(),
      )) as [number, number];
      return ok === 1 ? { allowed: true } : blocked(Math.ceil(Number(retryMs) / 1000));
    },
    () => checkMemory(stores[bucket], key, limit, windowMs),
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * POST /api/interviews/initialize ONLY.
 * 5 per hour, 20 per day per user.
 */
export async function checkInterviewCreate(userId: string): Promise<RateLimitResult> {
  const hourly = await check("interview_create", `ic:${userId}`, 5, 60 * 60 * 1000);
  if (!hourly.allowed) return hourly;

  return check("interview_create_day", `ic_day:${userId}`, 20, 24 * 60 * 60 * 1000);
}

/**
 * POST /api/interviews/[id]/turn
 * 30 per minute per user. Never uses the interview-creation bucket.
 */
export function checkTurnLimit(userId: string): Promise<RateLimitResult> {
  return check("turn", `turn:${userId}`, 30, 60 * 1000);
}

/**
 * POST /api/interviews/[id]/integrity
 * 60 per minute per interview (not per user — avoids cross-interview bleed).
 */
export function checkIntegrityLimit(interviewId: string): Promise<RateLimitResult> {
  return check("integrity", `integrity:${interviewId}`, 60, 60 * 1000);
}

/**
 * POST /api/tts — per-minute request cap (in addition to existing char budget).
 */
export function checkTtsLimit(userId: string): Promise<RateLimitResult> {
  return check("tts_req", `tts:${userId}`, 20, 60 * 1000);
}

/**
 * POST /api/parse-resume
 */
export function checkParseResumeLimit(userId: string): Promise<RateLimitResult> {
  return check("parse_resume", `pr:${userId}`, 10, 60 * 60 * 1000);
}

/**
 * LLM-backed routes: /chat, /feedback/generate
 */
export function checkLlmRouteLimit(userId: string): Promise<RateLimitResult> {
  return check("llm", `llm:${userId}`, 5, 60 * 1000);
}
/**
 * POST /api/drills/[slug]/sessions
 * 10 per hour per user.
 */
export function checkDrillSessionCreate(userId: string): Promise<RateLimitResult> {
  return check("drill_session_create", `dsc:${userId}`, 10, 60 * 60 * 1000);
}

/**
 * POST /api/drill-sessions/[id]/answer
 * 60 per minute per user.
 */
export function checkDrillAnswer(userId: string): Promise<RateLimitResult> {
  return check("drill_answer", `da:${userId}`, 60, 60 * 1000);
}

/**
 * Dev-only: clear ALL counters for a user (memory and Redis).
 */
export async function devClearUserLimits(userId: string): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  for (const store of Object.values(stores)) {
    for (const key of store.keys()) {
      if (key.includes(userId)) store.delete(key);
    }
  }
  // Also clear replay cache for this user (rough match on userId prefix)
  for (const key of seenRequestIds.keys()) {
    if (key.includes(userId)) seenRequestIds.delete(key);
  }
  const r = redis();
  if (r) {
    const userKeys = ["ic", "ic_day", "turn", "tts", "pr", "llm", "dsc", "da"].map((p) => redisKey("rl", `${p}:${userId}`));
    await r.del(...userKeys).catch(() => {});
  }
  console.log(`[RATE_LIMIT] Dev: cleared all counters for user ${userId}`);
}
