import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

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

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

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

const pool =
  globalThis.__pgPool ??
  new Pool({
    connectionString,
    ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: envInt("PG_POOL_MAX", isServerless ? 1 : process.env.NODE_ENV === "production" ? 10 : 5),
    idleTimeoutMillis: envInt("PG_IDLE_TIMEOUT_MS", isServerless ? 2000 : 300_000),
    connectionTimeoutMillis: envInt("PG_CONNECT_TIMEOUT_MS", 5000),
    keepAlive: true,
  });

// An idle client that the pooler drops must not crash the process.
pool.on("error", (err) => {
  console.warn("[DB_POOL] idle client error:", err.message);
});

if (process.env.NODE_ENV !== "production") {
  globalThis.__pgPool = pool;
}
export const db = drizzle(pool, { schema });
