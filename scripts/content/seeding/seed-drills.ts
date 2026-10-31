import fs from "fs";
import path from "path";
import { config } from "dotenv";
import pg from "pg";
import { DRILL_TAXONOMY } from "../taxonomy/taxonomy";
import { validateQuestionItem, type RawQuestionItem } from "../taxonomy/validation";

config({ path: ".env" });
config({ path: ".env.local", override: true });

export async function seedDrillsAndContent() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  console.log("=== Starting Practice Gym Database Seeding ===");

  try {
    await client.query("BEGIN");

    const drillIdMap = new Map<string, string>(); // drillSlug -> drillId
    const conceptIdMap = new Map<string, string>(); // `${drillSlug}:${conceptSlug}` -> conceptId

    // 1. Seed drills
    for (const [slug, drill] of Object.entries(DRILL_TAXONOMY)) {
      const res = await client.query(
        `INSERT INTO drills (slug, title, category, description, icon, color, default_difficulty, time_limit_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           category = EXCLUDED.category,
           description = EXCLUDED.description,
           icon = EXCLUDED.icon,
           color = EXCLUDED.color,
           default_difficulty = EXCLUDED.default_difficulty,
           time_limit_seconds = EXCLUDED.time_limit_seconds
         RETURNING id`,
        [
          slug,
          drill.title,
          drill.category,
          drill.description,
          drill.icon,
          drill.color,
          drill.defaultDifficulty,
          drill.timeLimitSeconds,
        ],
      );
      drillIdMap.set(slug, res.rows[0].id);
    }
    console.log(`[SEED] Upserted ${drillIdMap.size} drills.`);

    // 2. Seed concepts (roots and children)
    let totalConcepts = 0;
    for (const [drillSlug, drill] of Object.entries(DRILL_TAXONOMY)) {
      const drillId = drillIdMap.get(drillSlug)!;

      for (let i = 0; i < drill.concepts.length; i++) {
        const root = drill.concepts[i];
        const rootRes = await client.query(
          `INSERT INTO concepts (drill_id, slug, label, sort_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (drill_id, slug) DO UPDATE SET
             label = EXCLUDED.label,
             sort_order = EXCLUDED.sort_order
           RETURNING id`,
          [drillId, root.slug, root.label, i],
        );
        const rootId = rootRes.rows[0].id;
        conceptIdMap.set(`${drillSlug}:${root.slug}`, rootId);
        totalConcepts++;

        if (root.children) {
          for (let j = 0; j < root.children.length; j++) {
            const child = root.children[j];
            const childRes = await client.query(
              `INSERT INTO concepts (drill_id, parent_id, slug, label, sort_order)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (drill_id, slug) DO UPDATE SET
                 parent_id = EXCLUDED.parent_id,
                 label = EXCLUDED.label,
                 sort_order = EXCLUDED.sort_order
               RETURNING id`,
              [drillId, rootId, child.slug, child.label, j],
            );
            conceptIdMap.set(`${drillSlug}:${child.slug}`, childRes.rows[0].id);
            totalConcepts++;
          }
        }
      }
    }
    console.log(`[SEED] Upserted ${totalConcepts} concepts across drills.`);

    // 3. Read questions from content/drills/
    const contentDir = path.join(process.cwd(), "content", "drills");
    let totalQuestionsFound = 0;
    let newQuestionsInserted = 0;
    let questionsUpdated = 0;
    let invalidCount = 0;

    if (fs.existsSync(contentDir)) {
      for (const [drillSlug] of Object.entries(DRILL_TAXONOMY)) {
        const drillId = drillIdMap.get(drillSlug)!;
        const drillDir = path.join(contentDir, drillSlug);
        if (!fs.existsSync(drillDir)) continue;

        const files = fs.readdirSync(drillDir).filter((f) => f.endsWith(".json"));

        for (const file of files) {
          const filePath = path.join(drillDir, file);
          let questionsInFile: RawQuestionItem[] = [];
          try {
            questionsInFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          } catch (err) {
            console.warn(`[SEED_WARN] Failed to parse JSON file ${filePath}:`, err);
            continue;
          }

          // concept slug can be derived from file name e.g. "cap-theorem-foundational.json"
          const baseName = file.replace(/\.json$/, "");
          const lastDash = baseName.lastIndexOf("-");
          const conceptSlug = lastDash > 0 ? baseName.slice(0, lastDash) : baseName;
          const conceptId = conceptIdMap.get(`${drillSlug}:${conceptSlug}`);
          const conceptIds = conceptId ? [conceptId] : [];

          for (const q of questionsInFile) {
            totalQuestionsFound++;
            const v = validateQuestionItem(q);
            if (!v.valid) {
              console.warn(`[SEED_WARN] Question ${q.slug} failed validation: ${v.errors.join("; ")}`);
              invalidCount++;
              continue;
            }

            const version = q.version ?? 1;

            // Check if question exists to preserve review_status if already approved
            const existing = await client.query(
              `SELECT id, review_status FROM questions WHERE slug = $1 AND version = $2`,
              [q.slug, version],
            );

            if (existing.rows.length === 0) {
              // Auto-approve validated questions from content directory
              const reviewStatus = "approved";
              await client.query(
                `INSERT INTO questions (drill_id, concept_ids, type, level, payload, rubric, model_answer, explanation, review_status, version, slug)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                  drillId,
                  conceptIds,
                  q.type,
                  q.level,
                  JSON.stringify(q.payload),
                  JSON.stringify(q.rubric),
                  q.model_answer,
                  q.explanation,
                  reviewStatus,
                  version,
                  q.slug,
                ],
              );
              newQuestionsInserted++;
            } else {
              // Auto-approve validated questions on update
              const reviewStatus = "approved";
              await client.query(
                `UPDATE questions SET
                   drill_id = $1,
                   concept_ids = $2,
                   type = $3,
                   level = $4,
                   payload = $5,
                   rubric = $6,
                   model_answer = $7,
                   explanation = $8,
                   review_status = $9,
                   updated_at = now()
                 WHERE slug = $10 AND version = $11`,
                [
                  drillId,
                  conceptIds,
                  q.type,
                  q.level,
                  JSON.stringify(q.payload),
                  JSON.stringify(q.rubric),
                  q.model_answer,
                  q.explanation,
                  reviewStatus,
                  q.slug,
                  version,
                ],
              );
              questionsUpdated++;
            }
          }
        }
      }
    }

    console.log(
      `[SEED] Questions processed: ${totalQuestionsFound} (New: ${newQuestionsInserted}, Updated: ${questionsUpdated}, Invalid: ${invalidCount})`,
    );

    // 4. Assemble practice sets STRICTLY from approved questions
    let publishedPracticeSets = 0;
    const levels: ("foundational" | "mid" | "senior" | "staff")[] = [
      "foundational",
      "mid",
      "senior",
      "staff",
    ];

    for (const [drillSlug] of Object.entries(DRILL_TAXONOMY)) {
      const drillId = drillIdMap.get(drillSlug)!;
      const minRequired = drillSlug === "rapid-screen" ? 10 : 4;
      const setTargetSize = drillSlug === "rapid-screen" ? 20 : 10;

      for (const level of levels) {
        // Query approved questions for this drill and level
        const approvedRes = await client.query(
          `SELECT id, concept_ids FROM questions
           WHERE drill_id = $1 AND level = $2 AND review_status = 'approved'
           ORDER BY created_at ASC`,
          [drillId, level],
        );

        const approvedQuestions = approvedRes.rows;
        const setSlug = `${drillSlug}-${level}-set-01`;
        const setTitle = `${drillSlug.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ")} — ${level[0].toUpperCase() + level.slice(1)} Core Set`;

        if (approvedQuestions.length < minRequired) {
          console.log(
            `[SEED] Practice set '${setSlug}' skipped: only ${approvedQuestions.length}/${minRequired} approved questions available`,
          );
          continue;
        }

        const questionIds = approvedQuestions.slice(0, setTargetSize).map((r) => r.id);

        await client.query(
          `INSERT INTO practice_sets (drill_id, title, slug, level, question_ids, sort_order)
           VALUES ($1, $2, $3, $4, $5, 0)
           ON CONFLICT (slug) DO UPDATE SET
             title = EXCLUDED.title,
             question_ids = EXCLUDED.question_ids,
             sort_order = EXCLUDED.sort_order`,
          [drillId, setTitle, setSlug, level, questionIds],
        );
        publishedPracticeSets++;
      }
    }

    // 5. Final summary
    const statsRes = await client.query(`
      SELECT
        count(*) as total,
        count(*) FILTER (WHERE review_status = 'approved') as approved,
        count(*) FILTER (WHERE review_status = 'draft') as draft
      FROM questions
    `);

    const s = statsRes.rows[0];
    console.log("\n=======================================================");
    console.log("               DRILL SEEDING SUMMARY                   ");
    console.log("=======================================================");
    console.log(`Drills: ${drillIdMap.size}`);
    console.log(`Concepts: ${totalConcepts}`);
    console.log(`Questions in DB: ${s.total} (${s.approved} approved, ${s.draft} draft)`);
    console.log(`Practice Sets Published: ${publishedPracticeSets}`);
    console.log("=======================================================\n");

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[SEED_ERROR] Seeding failed, rolled back:", err);
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.includes("seed-drills.ts")) {
  seedDrillsAndContent().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
