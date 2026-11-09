/**
 * Shared Redis client (ioredis) with graceful degradation.
 *
 * Why Redis here: rate limits, the TTS audio cache, Sarvam budgets and in-flight turn markers
 * must be shared by every server instance and survive restarts. Per-process Maps don't do that
 * on serverless, where each instance would count and cache separately.
 *
 * Config: REDIS_URL. Locally that's the docker-compose Redis (redis://localhost:6379);
 * in production, Upstash's TCP endpoint (rediss://default:<password>@<host>:6379).
 * REDIS_DISABLED=true forces the in-memory fallback.
 *
 * Every caller must handle `redis()` returning null (not configured, still connecting, or down)
 * by using its in-memory fallback. Commands time out after 500 ms, and the offline queue is off,
 * so a Redis outage costs a request at most half a second, never a hang.
 */

import type { Redis as RedisClient } from "ioredis";

declare global {
  var __prepaiRedis: RedisClient | null | undefined;
}

export const REDIS_PREFIX = "prepai:";

let lastErrorLog = 0;

function create(): RedisClient | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url || process.env.REDIS_DISABLED === "true") return null;

  // Loaded lazily so builds/tests without Redis never touch the package.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("ioredis") as typeof import("ioredis");
  const client = new Redis(url, {
    connectTimeout: 2000,
    commandTimeout: 500,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false, // fail fast while disconnected → callers fall back to memory
    retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
    lazyConnect: false,
  });

  client.on("ready", () => console.log("[REDIS] connected"));
  client.on("error", (err) => {
    const now = Date.now();
    if (now - lastErrorLog > 30_000) {
      lastErrorLog = now;
      console.warn(`[REDIS] unavailable, using in-memory fallback: ${err.message}`);
    }
  });
  return client;
}

/** The connected client, or null when Redis is not configured / not ready. */
export function redis(): RedisClient | null {
  if (globalThis.__prepaiRedis === undefined) {
    globalThis.__prepaiRedis = create();
  }
  const c = globalThis.__prepaiRedis;
  return c && c.status === "ready" ? c : null;
}

/** Starts connecting early (called at server boot) so the first request can already use Redis. */
export function initRedis(): void {
  redis();
}

/** Runs `fn` against Redis; returns `fallback()` when Redis is unavailable or the call fails. */
export async function withRedis<T>(fn: (r: RedisClient) => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  const r = redis();
  if (!r) return fallback();
  try {
    return await fn(r);
  } catch (err) {
    const now = Date.now();
    if (now - lastErrorLog > 30_000) {
      lastErrorLog = now;
      console.warn(`[REDIS] command failed, using in-memory fallback: ${err instanceof Error ? err.message : err}`);
    }
    return fallback();
  }
}

export const key = (...parts: string[]) => REDIS_PREFIX + parts.join(":");
