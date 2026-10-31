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

const pool =
  globalThis.__pgPool ??
  new Pool({
    connectionString,
    ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: isServerless ? 1 : process.env.NODE_ENV === "production" ? 10 : 5,
    idleTimeoutMillis: isServerless ? 2000 : 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pgPool = pool;
}
export const db = drizzle(pool, { schema });
