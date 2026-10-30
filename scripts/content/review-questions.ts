import readline from "readline";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });
config({ path: ".env.local", override: true });

function parseArgs(): { drill?: string; level?: string } {
  const args = process.argv.slice(2);
  let drill: string | undefined;
  let level: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--drill" && args[i + 1]) drill = args[++i];
    else if (args[i] === "--level" && args[i + 1]) level = args[++i];
  }
  return { drill, level };
}
async function prompt(rl: readline.Interface, question: string): Promise<string> {
  const { promise, resolve } = Promise.withResolvers<string>();
  rl.question(question, resolve);
  return promise;
}

async function main() {
  const { drill, level } = parseArgs();
  console.log("=== PrepAI Practice Gym Question Review CLI ===");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    let query = `
      SELECT q.id, q.slug, q.type, q.level, q.payload, q.rubric, q.model_answer, q.explanation, d.slug as drill_slug
      FROM questions q
      JOIN drills d ON d.id = q.drill_id
      WHERE q.review_status = 'draft'
    `;
    const params: unknown[] = [];
    if (drill) {
      params.push(drill);
      query += ` AND d.slug = $${params.length}`;
    }
    if (level) {
      params.push(level);
      query += ` AND q.level = $${params.length}`;
    }
    query += ` ORDER BY q.created_at ASC`;

    const res = await client.query(query, params);
    const draftQuestions = res.rows;

    console.log(`Found ${draftQuestions.length} draft question(s) awaiting review.\n`);

    if (draftQuestions.length === 0) {
      console.log("No questions to review.");
      return;
    }

    for (let i = 0; i < draftQuestions.length; i++) {
      const q = draftQuestions[i];
      console.log(`\n─────────────────────────────────────────────────────────────────────────────`);
      console.log(`[${i + 1}/${draftQuestions.length}] ${q.slug} (ID: ${q.id})`);
      console.log(`Drill: ${q.drill_slug} | Level: ${q.level} | Type: ${q.type}`);
      console.log(`Stem:\n  ${q.payload.stem}`);
      if (q.payload.options) {
        console.log(`Options:`);
        for (const opt of q.payload.options) {
          console.log(`  [${opt.key}] ${opt.text}`);
        }
        console.log(`Correct: ${q.payload.correct_key || q.payload.correct_keys}`);
      }
      console.log(`Model Answer:\n  ${q.model_answer}`);
      console.log(`Explanation:\n  ${q.explanation}`);
      console.log(`─────────────────────────────────────────────────────────────────────────────`);

      const action = await prompt(rl, "Action ([a]pprove, [r]eject, [s]kip, [q]uit): ");
      const trimmed = action.trim().toLowerCase();

      if (trimmed === "q") {
        console.log("Exiting review.");
        break;
      } else if (trimmed === "a") {
        await client.query(
          `UPDATE questions SET review_status = 'approved', updated_at = now() WHERE id = $1`,
          [q.id],
        );
        console.log(`✓ Approved question ${q.slug}`);
      } else if (trimmed === "r") {
        const reason = await prompt(rl, "Rejection reason: ");
        console.log(`✗ Rejected question ${q.slug} (Reason: ${reason})`);
      } else {
        console.log("Skipped.");
      }
    }
  } finally {
    rl.close();
    await client.end();
  }
}

if (process.argv[1]?.includes("review-questions.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
