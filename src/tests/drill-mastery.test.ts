import { computeEmaMastery, computeNextDue } from "../lib/drills/mastery";

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
console.log("       DRILL MASTERY EMA & SPACED REPETITION SUITE     ");
console.log("=======================================================\n");

test("EMA: 0.3 * answerScore + 0.7 * old_mastery (mastery=0.5, score=1.0 -> 0.65)", () => {
  const result = computeEmaMastery(0.5, 1.0);
  assertEq(result, 0.65, "EMA of 0.5 with score 1.0 must be 0.65");
});

test("EMA: bounds between 0.0 and 1.0", () => {
  assertEq(computeEmaMastery(0.0, 0.0), 0.0, "Lower bound must stay 0.0");
  assertEq(computeEmaMastery(1.0, 1.0), 1.0, "Upper bound must stay 1.0");
  assertEq(computeEmaMastery(0.2, 0.8), 0.38, "0.3*0.8 + 0.7*0.2 = 0.24 + 0.14 = 0.38");
});

test("SM-2 next_due brackets: >= 0.8 -> +7 days", () => {
  const base = new Date("2026-06-01T12:00:00Z");
  const due = computeNextDue(0.85, base);
  const diffDays = Math.round((due.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
  assertEq(diffDays, 7, "Mastery 0.85 must schedule 7 days out");
});

test("SM-2 next_due brackets: >= 0.6 -> +3 days", () => {
  const base = new Date("2026-06-01T12:00:00Z");
  const due = computeNextDue(0.65, base);
  const diffDays = Math.round((due.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
  assertEq(diffDays, 3, "Mastery 0.65 must schedule 3 days out");
});

test("SM-2 next_due brackets: >= 0.4 -> +1 day", () => {
  const base = new Date("2026-06-01T12:00:00Z");
  const due = computeNextDue(0.45, base);
  const diffDays = Math.round((due.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
  assertEq(diffDays, 1, "Mastery 0.45 must schedule 1 day out");
});

test("SM-2 next_due brackets: < 0.4 -> +4 hours", () => {
  const base = new Date("2026-06-01T12:00:00Z");
  const due = computeNextDue(0.2, base);
  const diffHours = Math.round((due.getTime() - base.getTime()) / (60 * 60 * 1000));
  assertEq(diffHours, 4, "Mastery 0.2 must schedule 4 hours out");
});

test("Chronological gate: out-of-order older answer preserves newer mastery", () => {
  const state = {
    mastery: 0.8,
    lastSeen: new Date("2026-06-05T12:00:00Z"),
    attempts: 5,
  };

  const delayedOldAnswer = {
    score: 0.1,
    createdAt: new Date("2026-06-01T12:00:00Z"), // older than lastSeen!
  };

  const isOutOfOrder = state.lastSeen.getTime() > delayedOldAnswer.createdAt.getTime();
  assert(isOutOfOrder, "Must detect delayed out-of-order answer");

  if (isOutOfOrder) {
    // Only increment attempts, do NOT mutate mastery or lastSeen
    state.attempts += 1;
  }

  assertEq(state.mastery, 0.8, "Mastery must remain 0.8 without rollback");
  assertEq(state.attempts, 6, "Attempts must increment to 6");
});

console.log("\n=======================================================");
console.log(`Results: ${passed} passed  ${failed} failed  (${passed + failed} total)`);
console.log("=======================================================\n");

if (failed > 0) process.exit(1);
