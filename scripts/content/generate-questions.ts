import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { generate } from "../../src/lib/llm";
import { DRILL_TAXONOMY } from "./taxonomy";
import { validateQuestionItem, type RawQuestionItem } from "./validation";

config({ path: ".env" });
config({ path: ".env.local", override: true });

interface CliArgs {
  drill?: string;
  concept?: string;
  level?: "foundational" | "mid" | "senior" | "staff";
  budget?: number;
  force?: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--drill" && args[i + 1]) parsed.drill = args[++i];
    else if (args[i] === "--concept" && args[i + 1]) parsed.concept = args[++i];
    else if (args[i] === "--level" && args[i + 1]) {
      const l = args[++i] as "foundational" | "mid" | "senior" | "staff";
      if (["foundational", "mid", "senior", "staff"].includes(l)) parsed.level = l;
    } else if (args[i] === "--budget" && args[i + 1]) parsed.budget = parseInt(args[++i], 10);
    else if (args[i] === "--force") parsed.force = true;
  }
  return parsed;
}

const ALLOWED_TYPES_BY_DRILL: Record<string, string[]> = {
  "system-design": ["scenario", "short_answer"],
  "algo-logic": ["mcq", "code_trace", "fix_the_bug"],
  "behavioral-star": ["star_prompt", "voice_answer", "short_answer"],
  "frontend-arch": ["mcq", "scenario", "code_trace"],
  "database-concurrency": ["short_answer", "scenario", "mcq"],
  "rapid-screen": ["mcq", "code_trace"],
};

const LEVEL_PROMPTS = {
  foundational: "Explain core principles, basic mechanics, standard terminology, and definitions.",
  mid: "Solve practical implementation problems, evaluate tradeoffs between two options, and handle common errors.",
  senior: "Design resilient systems, weigh complex architectural tradeoffs, optimize performance, and handle edge cases.",
  staff: "Critique system failure modes, cross-cutting multi-region scalability, cascading outages, and org-level tech strategy.",
};

async function generateQuestionsForConcept(
  drillSlug: string,
  conceptSlug: string,
  conceptLabel: string,
  level: "foundational" | "mid" | "senior" | "staff",
  count: number,
): Promise<RawQuestionItem[]> {
  const allowedTypes = ALLOWED_TYPES_BY_DRILL[drillSlug] || ["mcq", "short_answer"];
  const levelGuidance = LEVEL_PROMPTS[level];

  const system = `You are a Principal Technical Interviewer and Question Author for PrepAI Practice Gym.
Create high-quality, rigorous interview questions for:
Drill: "${drillSlug}"
Concept: "${conceptLabel}" (slug: ${conceptSlug})
Difficulty: "${level}"
Allowed question types: ${allowedTypes.join(", ")}

Level Guidance: ${levelGuidance}

Output a JSON array of question objects. Each question object MUST have:
- slug: string format "${drillSlug}-${conceptSlug}-${level}-01", etc.
- type: one of [${allowedTypes.map((t) => `"${t}"`).join(", ")}]
- level: "${level}"
- payload: object matching the type:
  * mcq: { type: "mcq", stem: string, options: [{ key: "A"|"B"|"C"|"D", text: string }], correct_key: "A"|"B"|"C"|"D" }
  * short_answer: { type: "short_answer", stem: string, max_words: number (100-300) }
  * scenario: { type: "scenario", stem: string, context: string, max_words: number (200-500) }
  * code_trace: { type: "code_trace", stem: string, code: string, language: "javascript"|"typescript"|"sql", expected_output: string }
  * fix_the_bug: { type: "fix_the_bug", stem: string, buggy_code: string, language: "javascript"|"typescript", correct_code: string, hint?: string }
  * star_prompt: { type: "star_prompt", stem: string, situation_hint?: string }
  * voice_answer: { type: "voice_answer", stem: string, max_duration_seconds: number (60-180) }
- rubric: { criteria: [{ name: string, weight: number (0-1, sum to 1), description: string }], passing_threshold: 0.6 } (must have >= 2 criteria)
- model_answer: detailed exemplary answer (>= 30 characters)
- explanation: educational explanation explaining WHY this answer is correct and what common misconceptions are (>= 40 characters)
- review_status: "draft"
- version: 1

Return ONLY valid JSON array with NO markdown wrapping.`;

  const prompt = `Generate exactly ${count} distinct, rigorous questions for ${conceptLabel} at ${level} difficulty.`;

  try {
    const res = await generate({ task: "heavy", system, prompt });
    let text = res.text.trim();
    if (text.startsWith("```json")) {
      text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("Generated response is not an array");
    }

    const validated: RawQuestionItem[] = [];
    for (const item of parsed) {
      const v = validateQuestionItem(item);
      if (v.valid) {
        validated.push({
          ...(item as RawQuestionItem),
          review_status: "draft",
          version: 1,
        });
      } else {
        console.warn(`[GEN_WARN] Invalid question item ${item.slug}: ${v.errors.join(", ")}`);
      }
    }
    return validated;
  } catch (err) {
    console.error(`[GEN_ERROR] Failed for ${drillSlug}/${conceptSlug}/${level}:`, err);
    return [];
  }
}

async function main() {
  const args = parseArgs();
  console.log("=== PrepAI Practice Gym Question Generator ===");
  console.log("Options:", args);

  const outDirBase = path.join(process.cwd(), "content", "drills");
  fs.mkdirSync(outDirBase, { recursive: true });

  const drillEntries = Object.entries(DRILL_TAXONOMY).filter(
    ([slug]) => !args.drill || slug === args.drill,
  );

  const levels: ("foundational" | "mid" | "senior" | "staff")[] = args.level
    ? [args.level]
    : ["foundational", "mid", "senior", "staff"];

  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const [drillSlug, drill] of drillEntries) {
    const drillDir = path.join(outDirBase, drillSlug);
    fs.mkdirSync(drillDir, { recursive: true });

    const concepts = drill.concepts.filter(
      (c) => !args.concept || c.slug === args.concept,
    );

    for (const concept of concepts) {
      for (const lvl of levels) {
        const filePath = path.join(drillDir, `${concept.slug}-${lvl}.json`);
        if (fs.existsSync(filePath) && !args.force) {
          totalSkipped++;
          continue;
        }

        const countPerBatch = drillSlug === "rapid-screen" ? 5 : 2;
        console.log(`Generating: ${drillSlug} | ${concept.slug} | ${lvl} (${countPerBatch} Qs)...`);
        const questions = await generateQuestionsForConcept(
          drillSlug,
          concept.slug,
          concept.label,
          lvl,
          countPerBatch,
        );

        if (questions.length > 0) {
          fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), "utf-8");
          console.log(`  -> Wrote ${questions.length} questions to ${path.relative(process.cwd(), filePath)}`);
          totalGenerated += questions.length;
        } else {
          totalFailed++;
        }
      }
    }
  }

  console.log("\nGeneration complete.");
  console.log(`Generated: ${totalGenerated} questions`);
  console.log(`Skipped existing: ${totalSkipped} concept-level files`);
  console.log(`Failed batches: ${totalFailed}`);
}

main().catch((err) => {
  console.error("Generator failed:", err);
  process.exit(1);
});
