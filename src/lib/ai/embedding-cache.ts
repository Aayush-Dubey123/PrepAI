/**
 * Embedding with de-duplication.
 *
 * The same answer text gets embedded twice in one turn: /turn needs it right away for interview
 * memory, and /transcript/append stores it in the background. This wrapper makes the second call
 * free: concurrent calls in one process share a promise, and results are kept in Redis for an
 * hour so another instance (or a retry) reuses them too. That halves Gemini embedding calls.
 */

import { createHash } from "crypto";
import { embedText } from "@/src/lib/ai/gemini-embeddings";
import { key as redisKey, withRedis } from "@/src/lib/core/redis";

const TTL_SEC = 3600;
const inflight = new Map<string, Promise<number[]>>();

const hashOf = (text: string) => createHash("sha256").update(text.trim()).digest("hex");

export async function embedTextCached(text: string): Promise<number[]> {
  const h = hashOf(text);
  const pending = inflight.get(h);
  if (pending) return pending;

  const work = (async () => {
    const cached = await withRedis((r) => r.get(redisKey("emb", h)), () => null);
    if (cached) {
      try {
        const v = JSON.parse(cached) as number[];
        if (Array.isArray(v) && v.length > 0) return v;
      } catch {}
    }
    const values = await embedText(text.trim());
    void withRedis(
      (r) => r.set(redisKey("emb", h), JSON.stringify(values), "EX", TTL_SEC).then(() => undefined),
      () => undefined,
    );
    return values;
  })();

  inflight.set(h, work);
  work.finally(() => inflight.delete(h)).catch(() => {});
  return work;
}
