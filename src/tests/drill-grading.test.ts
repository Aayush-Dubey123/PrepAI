import { gradeDeterministic } from "../lib/drills/grading";
import { computeSessionScore } from "../lib/drills/scoring";
import type { QuestionPayload } from "../schemas/drills";

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
console.log("       DRILL DETERMINISTIC & RUBRIC GRADING SUITE      ");
console.log("=======================================================\n");

test("MCQ: correct option awards 1.0 score", () => {
  const payload: QuestionPayload = {
    type: "mcq",
    stem: "What is Raft?",
    options: [
      { key: "A", text: "Consensus algorithm" },
      { key: "B", text: "Database engine" },
    ],
    correct_key: "A",
  };
  const res = gradeDeterministic("mcq", payload, "A", "Explanation");
  assert(res !== null, "Result must not be null");
  assertEq(res?.score, 1.0, "Score must be 1.0");
  assertEq(res?.isCorrect, true, "isCorrect must be true");
  assertEq(res?.gradingMethod, "deterministic", "Method must be deterministic");
});

test("MCQ: incorrect option awards 0.0 score", () => {
  const payload: QuestionPayload = {
    type: "mcq",
    stem: "What is Raft?",
    options: [
      { key: "A", text: "Consensus algorithm" },
      { key: "B", text: "Database engine" },
    ],
    correct_key: "A",
  };
  const res = gradeDeterministic("mcq", payload, "B", "Explanation");
  assert(res !== null, "Result must not be null");
  assertEq(res?.score, 0.0, "Score must be 0.0");
  assertEq(res?.isCorrect, false, "isCorrect must be false");
});

test("Multi-select: partial credit calculated via Jaccard intersection/union", () => {
  const payload: QuestionPayload = {
    type: "multi_select",
    stem: "Select all consensus protocols:",
    options: [
      { key: "A", text: "Raft" },
      { key: "B", text: "Paxos" },
      { key: "C", text: "Redis" },
    ],
    correct_keys: ["A", "B"],
  };
  // User selects A and C -> intersection is {A} (size 1), union is {A, B, C} (size 3) -> 1/3 = 0.33
  const res = gradeDeterministic("multi_select", payload, ["A", "C"], "Explanation");
  assert(res !== null, "Result must not be null");
  assertEq(res?.score, 0.33, "Score must be Jaccard 1/3 = 0.33");
  assertEq(res?.isCorrect, false, "0.33 is below passing threshold 0.6");
});

test("Multi-select: exact match awards 1.0 score", () => {
  const payload: QuestionPayload = {
    type: "multi_select",
    stem: "Select all consensus protocols:",
    options: [
      { key: "A", text: "Raft" },
      { key: "B", text: "Paxos" },
      { key: "C", text: "Redis" },
    ],
    correct_keys: ["A", "B"],
  };
  const res = gradeDeterministic("multi_select", payload, ["A", "B"], "Explanation");
  assert(res !== null, "Result must not be null");
  assertEq(res?.score, 1.0, "Score must be 1.0");
  assertEq(res?.isCorrect, true, "isCorrect must be true");
});

test("Code trace: whitespace normalization handles whitespace/newlines", () => {
  const payload: QuestionPayload = {
    type: "code_trace",
    stem: "What does this output?",
    code: "console.log(42);",
    language: "javascript",
    expected_output: "42",
  };
  const res = gradeDeterministic("code_trace", payload, "  42 \r\n ", "Explanation");
  assert(res !== null, "Result must not be null");
  assertEq(res?.score, 1.0, "Normalized match must score 1.0");
  assertEq(res?.isCorrect, true, "isCorrect must be true");
});

test("Session scoring: low-confidence (<0.5) answers excluded from denominator", () => {
  const answers = [
    { grading_method: "deterministic", confidence: null, score: 1.0 }, // count (1.0)
    { grading_method: "llm", confidence: 0.9, score: 0.8 },             // count (0.8)
    { grading_method: "llm", confidence: 0.3, score: 0.0 },             // EXCLUDED (< 0.5)
    { grading_method: "self_assessment", confidence: null, score: 0.5 },// EXCLUDED
  ];
  // Scored: [1.0, 0.8] -> sum = 1.8, count = 2 -> 1.8 / 2 = 0.9 -> 90%
  const score = computeSessionScore(answers);
  assertEq(score, 90, "Score must be exactly 90% (excluding low confidence and self-assessment)");
});

test("Self-assessment score mapping: 1->0.0, 3->0.5, 5->1.0", () => {
  const mapRating = (r: number) => (r - 1) / 4.0;
  assertEq(mapRating(1), 0.0, "Rating 1 must map to 0.0");
  assertEq(mapRating(3), 0.5, "Rating 3 must map to 0.5");
  assertEq(mapRating(5), 1.0, "Rating 5 must map to 1.0");
});

console.log("\n=======================================================");
console.log(`Results: ${passed} passed  ${failed} failed  (${passed + failed} total)`);
console.log("=======================================================\n");

if (failed > 0) process.exit(1);
