/**
 * Interview memory (pgvector recall) — selection rules and prompt rendering.
 * Pure tests: no database or embedding API needed.
 */

import { selectRecalled, type RecallRow } from "@/src/lib/interview/memory/recall";
import { buildTurnContext } from "@/src/lib/interview/orchestration/prompt";
import { loadState } from "@/src/lib/interview/orchestration/state";

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string, details?: string) {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  FAIL: ${label}${details ? `\n      ${details}` : ""}`);
    failed++;
  }
}

const now = Date.parse("2026-11-09T10:30:00Z");
const row = (content: string, similarity: number, minutesAgo: number): RecallRow => ({
  content,
  similarity: String(similarity), // pg returns numerics as strings
  created_at: new Date(now - minutesAgo * 60000).toISOString(),
});

console.log("\n▶ selectRecalled");
{
  const kafka = "We used Kafka for payment events with exactly-once semantics and idempotent consumers";
  const recent = "I would shard the orders table by customer id to spread the write load evenly";
  const rows = [
    row(kafka, 0.81, 12),
    row(kafka, 0.8, 12), // duplicate content
    row(recent, 0.79, 1), // already in recent dialogue → excluded
    row("Yes that's right", 0.9, 3), // too short to be a claim
    row("I led the migration from MySQL to Postgres over two quarters with zero downtime", 0.66, 20),
    row("I enjoy hiking on weekends with my friends near the city mountains", 0.41, 25), // unrelated
    row("Our CI pipeline ran integration tests against ephemeral databases per pull request", 0.7, 18),
  ];
  const got = selectRecalled(rows, { exclude: [recent], now, minSimilarity: 0.62 });

  assert(got.length === 3, "returns at most 3 answers", `got ${got.length}`);
  assert(got[0].content === kafka && got[0].similarity === 0.81, "keeps similarity order (best first)");
  assert(got.filter((g) => g.content === kafka).length === 1, "drops duplicate content");
  assert(!got.some((g) => g.content === recent), "never repeats lines already in the recent dialogue");
  assert(!got.some((g) => g.content.startsWith("Yes")), "ignores short replies with no claim");
  assert(!got.some((g) => g.content.includes("hiking")), "drops answers below the similarity threshold");
  assert(got[0].minutesAgo === 12, "computes minutes ago", `got ${got[0].minutesAgo}`);

  const long = "x ".repeat(400) + "end";
  const trimmed = selectRecalled([row(long, 0.9, 5)], { now, maxChars: 50 });
  assert(trimmed[0].content.length <= 51 && trimmed[0].content.endsWith("…"), "truncates long answers");

  assert(selectRecalled([], { now }).length === 0, "empty input → empty result");

  // DB-computed age wins over created_at (timestamp without time zone is mis-read when the app
  // server's timezone differs from the database's, e.g. IST vs UTC = 330 min off).
  const skewed = selectRecalled(
    [{ content: kafka, similarity: "0.8", created_at: new Date(now - 355 * 60000).toISOString(), minutes_ago: "25.4" }],
    { now },
  );
  assert(skewed[0].minutesAgo === 25, "uses the database-computed age", `got ${skewed[0].minutesAgo}`);
}

console.log("\n▶ prompt block");
{
  const state = loadState({ phase: "core" });
  const base = {
    jobRole: "Backend Engineer",
    state,
    resume: null,
    recentTranscript: [],
    userUtterance: "We moved to an outbox pattern to avoid dual writes",
    remainingTurns: 10,
    remainingMinutes: 20,
  };
  const withMemory = buildTurnContext({
    ...base,
    earlierAnswers: [{ content: "We used Kafka for payment events", minutesAgo: 12 }],
  });
  assert(withMemory.includes("=== EARLIER IN THIS INTERVIEW"), "renders the memory section in core phase");
  assert(withMemory.includes(`(~12 min ago) "We used Kafka for payment events"`), "quotes the earlier answer with its age");
  assert(withMemory.includes("never attribute anything not written above"), "includes the faithfulness rule");

  const without = buildTurnContext(base);
  assert(!without.includes("EARLIER IN THIS INTERVIEW"), "no section when nothing was recalled");

  const warmup = buildTurnContext({
    ...base,
    state: loadState({ phase: "warmup" }),
    earlierAnswers: [{ content: "We used Kafka for payment events", minutesAgo: 2 }],
  });
  assert(!warmup.includes("EARLIER IN THIS INTERVIEW"), "not shown during warmup");
}

console.log(`\n Results: ${passed} passed  ${failed} failed  (${passed + failed} total)\n`);
if (failed > 0) process.exit(1);
