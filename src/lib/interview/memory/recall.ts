/**
 * Interview memory: semantic recall of the candidate's earlier answers (pgvector).
 *
 * The turn prompt only carries the last 12 transcript lines. In a 30-minute interview the
 * candidate's earlier claims ("we used Kafka for payment events", "I led the migration to
 * Postgres") drop out of view, so the interviewer can't connect back to them. Each transcript
 * line already has a 768-dim Gemini embedding; this module finds the earlier candidate answers
 * whose meaning is closest to the latest answer (cosine distance, `<=>`), so the interviewer
 * can say "Earlier you mentioned X..." like a human would.
 */

import { sql } from "drizzle-orm";
import { db } from "@/src/db/index";
import { toPgVectorLiteral } from "@/src/db/vector";

export interface RecalledAnswer {
  content: string;
  similarity: number; // 0..1, cosine similarity
  minutesAgo: number | null;
}

export interface RecallRow extends Record<string, unknown> {
  content: string;
  similarity: number | string;
  created_at?: Date | string | null;
  /** Age computed by Postgres. Preferred over created_at, which is a timestamp without time zone
   *  and is mis-read by the driver when the app server's timezone differs from the database's. */
  minutes_ago?: number | string | null;
}

export interface RecallOptions {
  limit?: number;
  /** Minimum cosine similarity to count as related (Gemini embeddings: ~0.6+ is on-topic). */
  minSimilarity?: number;
  /** Lines already visible to the model (recent dialogue, current answer) — never repeated. */
  exclude?: string[];
  maxChars?: number;
  now?: number;
}

const DEFAULT_MIN_SIMILARITY = Number(process.env.MEMORY_MIN_SIMILARITY) || 0.62;

const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Pure selection step (testable without a database). */
export function selectRecalled(rows: RecallRow[], opts: RecallOptions = {}): RecalledAnswer[] {
  const { limit = 3, minSimilarity = DEFAULT_MIN_SIMILARITY, exclude = [], maxChars = 320, now = Date.now() } = opts;
  const excluded = new Set(exclude.map(normalize));
  const seen = new Set<string>();
  const out: RecalledAnswer[] = [];

  for (const row of rows) {
    const similarity = Number(row.similarity);
    if (!Number.isFinite(similarity) || similarity < minSimilarity) continue;
    const norm = normalize(row.content);
    if (norm.split(" ").length < 6) continue; // "yes", "okay sure" carry no claim
    if (excluded.has(norm) || seen.has(norm)) continue;
    seen.add(norm);

    const content = row.content.length > maxChars ? row.content.slice(0, maxChars).trimEnd() + "…" : row.content;
    let minutesAgo: number | null = null;
    if (row.minutes_ago !== undefined && row.minutes_ago !== null && Number.isFinite(Number(row.minutes_ago))) {
      minutesAgo = Math.max(0, Math.round(Number(row.minutes_ago)));
    } else if (row.created_at) {
      const created = new Date(row.created_at).getTime();
      if (Number.isFinite(created)) minutesAgo = Math.max(0, Math.round((now - created) / 60000));
    }
    out.push({ content, similarity: Math.round(similarity * 100) / 100, minutesAgo });
    if (out.length >= limit) break;
  }
  return out;
}

/** Finds the candidate's earlier answers in this interview closest in meaning to `queryEmbedding`. */
export async function recallEarlierAnswers(
  interviewId: string,
  queryEmbedding: number[],
  opts: RecallOptions = {},
): Promise<RecalledAnswer[]> {
  const vector = toPgVectorLiteral(queryEmbedding);
  // Filtered by interview first (btree index), so the distance scan only covers one interview's
  // lines (~100 at most). No ANN index needed at this size.
  const result = await db.execute<RecallRow>(sql`
    SELECT content,
           1 - (embedding <=> ${vector}::vector) AS similarity,
           EXTRACT(EPOCH FROM (LOCALTIMESTAMP - created_at)) / 60 AS minutes_ago
    FROM transcript_chunks
    WHERE interview_id = ${interviewId}
      AND speaker = 'user'
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vector}::vector
    LIMIT 10
  `);
  return selectRecalled(result.rows, opts);
}
