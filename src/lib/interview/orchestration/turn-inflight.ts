/**
 * In-flight /turn tracking.
 *
 * - Same instance: a retry of a turn that is still running joins the original request (shared
 *   promise) instead of generating a second follow-up.
 * - Across instances (Redis): each running turn is recorded in a per-interview set, so
 *   - feedback generation on any instance can see that a turn is still computing or saving
 *     state (`hasTurnInFlight`), and
 *   - a retry that lands on a different instance waits for the original to finish
 *     (`waitForRemoteTurn`) and is then answered from the persisted lastResponse.
 * Markers expire after 60 s, so a crashed instance can't block an interview forever.
 * Without Redis, everything degrades to the per-instance behaviour.
 */

import { key as redisKey, withRedis } from "@/src/lib/core/redis";

export interface SettledTurn {
  status: number;
  body: string;
  contentType: string;
}

const MARKER_TTL_MS = 60_000;

const inflight = new Map<string, Promise<SettledTurn>>();

const localKey = (interviewId: string, requestId: string) => `${interviewId}::${requestId}`;
const setKey = (interviewId: string) => redisKey("turn", "inflight", interviewId);

export function getInFlightTurn(interviewId: string, requestId: string): Promise<SettledTurn> | undefined {
  return inflight.get(localKey(interviewId, requestId));
}

export function trackTurn(interviewId: string, requestId: string, work: Promise<SettledTurn>): Promise<SettledTurn> {
  const k = localKey(interviewId, requestId);
  inflight.set(k, work);
  void withRedis(
    (r) => r.multi().sadd(setKey(interviewId), requestId).pexpire(setKey(interviewId), MARKER_TTL_MS).exec().then(() => undefined),
    () => undefined,
  );
  // `finally` returns a promise that rejects if `work` does; swallow it here, callers await `work`.
  work
    .finally(() => {
      inflight.delete(k);
      void withRedis((r) => r.srem(setKey(interviewId), requestId).then(() => undefined), () => undefined);
    })
    .catch(() => {});
  return work;
}

export async function hasTurnInFlight(interviewId: string): Promise<boolean> {
  const prefix = `${interviewId}::`;
  for (const k of inflight.keys()) if (k.startsWith(prefix)) return true;
  return withRedis(async (r) => (await r.scard(setKey(interviewId))) > 0, () => false);
}

/**
 * If this request is already running on another instance, waits (up to `maxWaitMs`) for it to
 * finish. Returns true if it waited. The caller then processes the request normally, and
 * /turn's persisted-replay check returns the reply the other instance produced.
 */
export async function waitForRemoteTurn(interviewId: string, requestId: string, maxWaitMs = 25_000): Promise<boolean> {
  const running = () => withRedis(async (r) => (await r.sismember(setKey(interviewId), requestId)) === 1, () => false);
  if (!(await running())) return false;
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    await new Promise((res) => setTimeout(res, 250));
    if (!(await running())) break;
  }
  // Non-final turns save state in after(), just after their response; give it a moment.
  await new Promise((res) => setTimeout(res, 400));
  return true;
}
