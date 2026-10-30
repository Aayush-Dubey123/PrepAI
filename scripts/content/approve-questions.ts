import { config } from "dotenv";
import pg from "pg";
import { DRILL_TAXONOMY } from "./taxonomy";
import { validateQuestionItem } from "./validation";

config({ path: ".env" });
config({ path: ".env.local", override: true });

function parseArgs(): { ids: string[]; reviewer: string } {
  const args = process.argv.slice(2);
  let ids: string[] = [];
  let reviewer = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ids" && args[i + 1]) {
      ids = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (args[i] === "--reviewer" && args[i + 1]) {
      reviewer = args[++i].trim();
    }
  }

  if (ids.length === 0 || !reviewer) {
    console.error("Usage: tsx scripts/content/approve-questions.ts --ids <uuid,uuid,...> --reviewer <admin_id>");
    process.exit(1);
  }

  return { ids, reviewer };
}

async function rebuildPracticeSetsForDrills(client: pg.Client, drillIds: string[]) {
  const levels: ("foundational" | "mid" | "senior" | "staff")[] = [
    "foundational",
    "mid",
    "senior",
    "staff",
  ];

  for (const drillId of drillIds) {
    const drillRes = await client.query(`SELECT slug FROM drills WHERE id = $1`, [drillId]);
    if (drillRes.rows.length === 0) continue;
    const drillSlug = drillRes.rows[0].slug;
    const minRequired = drillSlug === "rapid-screen" ? 15 : 8;
    const setTargetSize = drillSlug === "rapid-screen" ? 20 : 10;

    for (const level of levels) {
      const approvedRes = await client.query(
        `SELECT id FROM questions
         WHERE drill_id = $1 AND level = $2 AND review_status = 'approved'
         ORDER BY created_at ASC`,
        [drillId, level],
      );

      const approvedQuestions = approvedRes.rows;
      const setSlug = `${drillSlug}-${level}-set-01`;
      const setTitle = `${drillSlug.split("-").map((s: string) => s[0].toUpperCase() + s.slice(1)).join(" ")} — ${level[0].toUpperCase() + level.slice(1)} Core Set`;

      if (approvedQuestions.length >= minRequired) {
        const questionIds = approvedQuestions.slice(0, setTargetSize).map((r: { id: string }) => r.id);
        await client.query(
          `INSERT INTO practice_sets (drill_id, title, slug, level, question_ids, sort_order)
           VALUES ($1, $2, $3, $4, $5, 0)
           ON CONFLICT (slug) DO UPDATE SET
             title = EXCLUDED.title,
             question_ids = EXCLUDED.question_ids,
             sort_order = EXCLUDED.sort_order`,
          [drillId, setTitle, setSlug, level, questionIds],
        );
        console.log(`[APPROVE] Published/rebuilt practice set '${setSlug}' with ${questionIds.length} approved questions.`);
      }
    }
  }
}

async function main() {
  const { ids, reviewer } = parseArgs();
  console.log(`=== Approving ${ids.length} Question(s) by Reviewer: ${reviewer} ===`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");

    const affectedDrills = new Set<string>();
    let approvedCount = 0;

    for (const id of ids) {
      const res = await client.query(
        `SELECT id, slug, drill_id, payload, rubric, model_answer, explanation, review_status
         FROM questions WHERE id = $1`,
        [id],
      );

      if (res.rows.length === 0) {
        throw new Error(`Question ID ${id} not found in database.`);
      }

      const q = res.rows[0];
      const validation = validateQuestionItem({
        slug: q.slug,
        type: q.payload.type,
        level: q.level,
        payload: q.payload,
        rubric: q.rubric,
        model_answer: q.model_answer,
        explanation: q.explanation,
      });

      if (!validation.valid) {
        throw new Error(`Question ${id} (${q.slug}) failed validation gate: ${validation.errors.join(", ")}`);
      }

      await client.query(
        `UPDATE questions SET review_status = 'approved', updated_at = now() WHERE id = $1`,
        [id],
      );

      affectedDrills.add(q.drill_id);
      approvedCount++;
      console.log(`  ✓ Approved question: ${q.slug} (ID: ${id})`);
    }

    // Rebuild practice sets for affected drills
    await rebuildPracticeSetsForDrills(client, Array.from(affectedDrills));

    await client.query("COMMIT");
    console.log(`\nSuccessfully approved ${approvedCount} questions. Rebuilt sets for ${affectedDrills.size} drills.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[APPROVE_ERROR] Failed to approve questions:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
