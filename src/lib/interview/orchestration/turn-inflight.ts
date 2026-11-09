/**
 * In-flight /turn tracking (per server instance).
 *
 * - A retry of a turn that is still running joins the original request instead of
 *   generating a second follow-up (the persisted lastRequestId/lastResponse replay only
 *   covers turns that have already finished).
 * - Feedback generation checks `hasTurnInFlight` so it can't start while a turn is still
 *   computing or saving the interview state.
 */

export interface SettledTurn {
  status: number;
  body: string;
  contentType: string;
}

const inflight = new Map<string, Promise<SettledTurn>>();

const key = (interviewId: string, requestId: string) => `${interviewId}::${requestId}`;

export function getInFlightTurn(interviewId: string, requestId: string): Promise<SettledTurn> | undefined {
  return inflight.get(key(interviewId, requestId));
}

export function trackTurn(interviewId: string, requestId: string, work: Promise<SettledTurn>): Promise<SettledTurn> {
  const k = key(interviewId, requestId);
  inflight.set(k, work);
  // `finally` returns a promise that rejects if `work` does; swallow it here, callers await `work`.
  work.finally(() => inflight.delete(k)).catch(() => {});
  return work;
}

export function hasTurnInFlight(interviewId: string): boolean {
  const prefix = `${interviewId}::`;
  for (const k of inflight.keys()) if (k.startsWith(prefix)) return true;
  return false;
}
