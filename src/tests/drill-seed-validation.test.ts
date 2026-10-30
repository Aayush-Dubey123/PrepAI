import fs from "fs";
import path from "path";
import { validateQuestionItem, type RawQuestionItem } from "../../scripts/content/validation";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ❌  ${name}\n     ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEq<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} — Expected: ${expected}, Got: ${actual}`);
  }
}

console.log("\n=======================================================");
console.log("       DRILL SEED CONTENT VALIDATION SUITE             ");
console.log("=======================================================\n");

const contentDir = path.join(process.cwd(), "content", "drills");
assert(fs.existsSync(contentDir), `Content directory must exist at ${contentDir}`);

const drillDirs = fs.readdirSync(contentDir).filter((d) => {
  return fs.statSync(path.join(contentDir, d)).isDirectory();
});

test("Directory contains all 6 required drill folders", () => {
  assert(drillDirs.length >= 6, `Expected at least 6 drill folders, found ${drillDirs.length}`);
  const required = [
    "system-design",
    "algo-logic",
    "behavioral-star",
    "frontend-arch",
    "database-concurrency",
    "rapid-screen",
  ];
  for (const r of required) {
    assert(drillDirs.includes(r), `Missing required drill folder: ${r}`);
  }
});

const allQuestions: RawQuestionItem[] = [];
for (const d of drillDirs) {
  const dirPath = path.join(contentDir, d);
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const filePath = path.join(dirPath, f);
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (Array.isArray(content)) {
      for (const item of content) {
        allQuestions.push(item as RawQuestionItem);
      }
    }
  }
}

test("Seed bank contains >= 200 validated questions", () => {
  assert(
    allQuestions.length >= 200,
    `Expected >= 200 questions in seed bank, found ${allQuestions.length}`,
  );
});

test("Every question passes the automated validation gate", () => {
  let invalidCount = 0;
  const errors: string[] = [];
  for (const q of allQuestions) {
    const v = validateQuestionItem(q);
    if (!v.valid) {
      invalidCount++;
      errors.push(`${q.slug}: ${v.errors.join(", ")}`);
    }
  }
  assertEq(invalidCount, 0, `All questions must pass validation. Failures:\n${errors.slice(0, 5).join("\n")}`);
});

test("No duplicate (slug, version) pairs across the entire question bank", () => {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const q of allQuestions) {
    const key = `${q.slug}:v${q.version ?? 1}`;
    if (seen.has(key)) {
      duplicates.push(key);
    }
    seen.add(key);
  }
  assertEq(duplicates.length, 0, `Found duplicate slugs in seed content: ${duplicates.join(", ")}`);
});

test("All MCQ and multi-select questions reference valid option keys", () => {
  for (const q of allQuestions) {
    if (q.type === "mcq" && q.payload.type === "mcq") {
      const keys = q.payload.options.map((o) => o.key);
      assert(
        keys.includes(q.payload.correct_key),
        `MCQ ${q.slug} has correct_key ${q.payload.correct_key} not in options [${keys.join(",")}]`,
      );
    } else if (q.type === "multi_select" && q.payload.type === "multi_select") {
      const keys = q.payload.options.map((o) => o.key);
      for (const k of q.payload.correct_keys) {
        assert(
          keys.includes(k),
          `Multi-select ${q.slug} has correct_key ${k} not in options [${keys.join(",")}]`,
        );
      }
    }
  }
});

console.log("\n=======================================================");
console.log(`Results: ${passed} passed  ${failed} failed  (${passed + failed} total)`);
console.log("=======================================================\n");

if (failed > 0) process.exit(1);
