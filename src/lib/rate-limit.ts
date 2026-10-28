/**
 * src/lib/rate-limit.ts
 *
 * Separated rate limit buckets per action type.
 * Each action has its own key prefix, window, and counter — completely isolated.
 *
 * RATE_LIMIT_DISABLED=true (non-production only) bypasses all limits.
 * Idempotent replays with the same clientRequestId are NOT counted.
 */

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

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  retryAfterSec?: number;
}

// ─── In-memory stores (separate Map per action) ───────────────────────────────

const stores: Record<string, Map<string, WindowEntry>> = {
  interview_create: new Map(),
  interview_create_day: new Map(),
  turn: new Map(),
  integrity: new Map(),
  tts_req: new Map(),
  parse_resume: new Map(),
  llm: new Map(),
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

// ─── Core sliding window check ────────────────────────────────────────────────

function check(
  store: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  if (IS_DISABLED) return { allowed: true };

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
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
    return {
      allowed: false,
      reason: `Too many requests — please wait ${retryAfterSec}s`,
      code: "RATE_LIMITED",
      retryAfterSec,
    };
  }

  entry.count++;
  return { allowed: true };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * POST /api/interviews/initialize ONLY.
 * 5 per hour, 20 per day per user.
 */
export function checkInterviewCreate(userId: string): RateLimitResult {
  const hourly = check(stores.interview_create, `ic:${userId}`, 5, 60 * 60 * 1000);
  if (!hourly.allowed) return hourly;

  const daily = check(stores.interview_create_day, `ic_day:${userId}`, 20, 24 * 60 * 60 * 1000);
  return daily;
}

/**
 * POST /api/interviews/[id]/turn
 * 30 per minute per user. Never uses the interview-creation bucket.
 */
export function checkTurnLimit(userId: string): RateLimitResult {
  return check(stores.turn, `turn:${userId}`, 30, 60 * 1000);
}

/**
 * POST /api/interviews/[id]/integrity
 * 60 per minute per interview (not per user — avoids cross-interview bleed).
 */
export function checkIntegrityLimit(interviewId: string): RateLimitResult {
  return check(stores.integrity, `integrity:${interviewId}`, 60, 60 * 1000);
}

/**
 * POST /api/tts — per-minute request cap (in addition to existing char budget).
 */
export function checkTtsLimit(userId: string): RateLimitResult {
  return check(stores.tts_req, `tts:${userId}`, 20, 60 * 1000);
}

/**
 * POST /api/parse-resume
 */
export function checkParseResumeLimit(userId: string): RateLimitResult {
  return check(stores.parse_resume, `pr:${userId}`, 10, 60 * 60 * 1000);
}

/**
 * LLM-backed routes: /chat, /feedback/generate
 */
export function checkLlmRouteLimit(userId: string): RateLimitResult {
  return check(stores.llm, `llm:${userId}`, 5, 60 * 1000);
}

/**
 * Dev-only: clear ALL counters for a user.
 */
export function devClearUserLimits(userId: string): void {
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
  console.log(`[RATE_LIMIT] Dev: cleared all counters for user ${userId}`);
}

