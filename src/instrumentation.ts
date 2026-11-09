/**
 * Runs once when the Next.js server process starts.
 *
 * Opens a few database connections up front so the first page a user visits doesn't wait
 * 1–3 s for a fresh TLS handshake to the Supabase pooler. On a long-running server it also
 * pings those connections every 4 minutes so they don't hit the pool's 5-minute idle timeout.
 * Serverless instances skip the keep-warm timer (it would keep them billing).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.PG_WARM_DISABLED === "true") return;

  const { warmPool, isServerless } = await import("./db");
  void warmPool();

  if (!isServerless) {
    const timer = setInterval(() => void warmPool({ log: false }), 4 * 60 * 1000);
    timer.unref?.();
  }
}
