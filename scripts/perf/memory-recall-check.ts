/**
 * Read-only check of interview memory against real data.
 * Usage: npx tsx --env-file=.env.local scripts/perf/memory-recall-check.ts
 *
 * Picks the interview with the most embedded candidate answers, uses its latest answer as the
 * "current" one, and prints what recall would hand the interviewer, with timings and the
 * similarity distribution (to sanity-check MEMORY_MIN_SIMILARITY). Writes nothing.
 */
import { sql } from "drizzle-orm";
import { db, pool } from "@/src/db/index";
import { embedTextCached } from "@/src/lib/ai/embedding-cache";
import { recallEarlierAnswers, selectRecalled, type RecallRow } from "@/src/lib/interview/memory/recall";
import { toPgVectorLiteral } from "@/src/db/vector";

async function main() {
  const stats = await db.execute<{ total: string; embedded: string; interviews: string }>(sql`
    SELECT count(*) AS total, count(embedding) AS embedded, count(DISTINCT interview_id) AS interviews
    FROM transcript_chunks WHERE speaker = 'user'
  `);
  console.log("candidate lines:", stats.rows[0]);

  const pick = await db.execute<{ interview_id: string; n: string }>(sql`
    SELECT interview_id, count(*) AS n FROM transcript_chunks
    WHERE speaker = 'user' AND embedding IS NOT NULL
    GROUP BY interview_id ORDER BY n DESC LIMIT 1
  `);
  if (pick.rows.length === 0) {
    console.log("No embedded candidate answers yet — run an interview first.");
    return;
  }
  const interviewId = pick.rows[0].interview_id;
  const latest = await db.execute<{ content: string }>(sql`
    SELECT content FROM transcript_chunks
    WHERE interview_id = ${interviewId} AND speaker = 'user' AND length(content) > 40
    ORDER BY created_at DESC LIMIT 1
  `);
  const query = latest.rows[0]?.content;
  if (!query) {
    console.log("No long candidate answer in that interview.");
    return;
  }
  console.log(`interview with ${pick.rows[0].n} embedded answers; query = "${query.slice(0, 90)}…"`);

  let t = Date.now();
  const embedding = await embedTextCached(query);
  console.log(`embed (cold): ${Date.now() - t} ms`);
  t = Date.now();
  await embedTextCached(query);
  console.log(`embed (cached): ${Date.now() - t} ms`);

  t = Date.now();
  const recalled = await recallEarlierAnswers(interviewId, embedding, { exclude: [query] });
  console.log(`recall query: ${Date.now() - t} ms → ${recalled.length} answer(s)`);
  for (const r of recalled) console.log(`  sim=${r.similarity} ${r.minutesAgo ?? "?"}min  "${r.content.slice(0, 90)}…"`);

  // Similarity distribution across the whole interview, for threshold tuning
  const all = await db.execute<RecallRow>(sql`
    SELECT content, 1 - (embedding <=> ${toPgVectorLiteral(embedding)}::vector) AS similarity, created_at
    FROM transcript_chunks
    WHERE interview_id = ${interviewId} AND speaker = 'user' AND embedding IS NOT NULL
    ORDER BY embedding <=> ${toPgVectorLiteral(embedding)}::vector
  `);
  const sims = all.rows.map((r) => Number(r.similarity)).filter(Number.isFinite);
  console.log(`similarities (n=${sims.length}): ${sims.map((s) => s.toFixed(2)).join(" ")}`);
  console.log(`with threshold 0.5 → ${selectRecalled(all.rows, { exclude: [query], minSimilarity: 0.5 }).length}, 0.62 → ${selectRecalled(all.rows, { exclude: [query] }).length}, 0.75 → ${selectRecalled(all.rows, { exclude: [query], minSimilarity: 0.75 }).length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    const { redis } = await import("@/src/lib/core/redis");
    redis()?.disconnect();
    process.exit();
  });
