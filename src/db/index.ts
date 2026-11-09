// Next.js loads .env files itself. Only standalone scripts (tsx scripts, drizzle-kit) need
// dotenv, so skip it inside the Next server (which also stops the "injected env" log on
// every route compile).
if (!process.env.NEXT_RUNTIME) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { config } = require("dotenv") as typeof import("dotenv");
  config({ path: ".env", quiet: true });
  config({ path: ".env.local", override: true, quiet: true });
}

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const connectionString = process.env.DATABASE_URL;
const isLocal =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1") ||
  connectionString.includes("sslmode=disable");

const requiresSsl =
  !isLocal &&
  (process.env.NODE_ENV === "production" ||
    connectionString.includes("sslmode=require") ||
    connectionString.includes("render.com") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("supabase.com") ||
    connectionString.includes("railway.app") ||
    connectionString.includes("aivencloud.com"));

export const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

declare global {
  var __pgPool: Pool | undefined;
}

// Opening a connection to a remote pooler (TLS + auth) costs ~1–1.5 s from India to EU-West,
// so a long-running server keeps idle connections for 5 min instead of 30 s. That way a user
// returning after a short pause doesn't pay the handshake again. Serverless keeps a short idle
// window to avoid holding pooler slots; both values can be overridden via env.
const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

function createPool(): Pool {
  const p = new Pool({
    connectionString,
    ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: envInt("PG_POOL_MAX", isServerless ? 1 : process.env.NODE_ENV === "production" ? 10 : 5),
    idleTimeoutMillis: envInt("PG_IDLE_TIMEOUT_MS", isServerless ? 2000 : 300_000),
    connectionTimeoutMillis: envInt("PG_CONNECT_TIMEOUT_MS", 5000),
    keepAlive: true,
  });
  // An idle client that the pooler drops must not crash the process.
  p.on("error", (err) => {
    console.warn("[DB_POOL] idle client error:", err.message);
  });
  return p;
}

// One pool per process, in every environment, so every route shares the warm connections.
export const pool = globalThis.__pgPool ?? createPool();
globalThis.__pgPool = pool;

export const db = drizzle(pool, { schema });

/**
 * Opens `count` connections in parallel so the first requests don't each pay the handshake
 * (analytics alone runs 6 queries at once). Errors are logged, never thrown.
 */
export async function warmPool(
  // 6 covers the widest fan-out (Analytics runs 6 queries at once) without hogging pooler slots.
  { count = envInt("PG_WARM_CONNECTIONS", 6), log = true }: { count?: number; log?: boolean } = {},
): Promise<void> {
  const n = Math.min(count, envInt("PG_POOL_MAX", 10));
  const started = Date.now();
  const clients = await Promise.allSettled(Array.from({ length: n }, () => pool.connect()));
  for (const c of clients) {
    if (c.status === "fulfilled") {
      await c.value.query("select 1").catch(() => {});
      c.value.release();
    }
  }
  const ok = clients.filter((c) => c.status === "fulfilled").length;
  if (log || ok < n) {
    console.log(`[DB_POOL] warmed ${ok}/${n} connections in ${Date.now() - started}ms`);
  }
}
