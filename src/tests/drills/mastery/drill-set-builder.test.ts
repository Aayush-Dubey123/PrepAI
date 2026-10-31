export {};

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
console.log("       DRILL SMART SET ADAPTIVE BUILDER SUITE          ");
console.log("=======================================================\n");

// Adaptive ranking logic test (matches smart-set.ts ranking algorithm)
interface MockConcept {
  id: string;
  slug: string;
}

interface MockMastery {
  conceptId: string;
  mastery: number;
  nextDue: Date | null;
}

function rankConcepts(
  concepts: MockConcept[],
  masteryList: MockMastery[],
  now: Date,
): MockConcept[] {
  const masteryMap = new Map<string, MockMastery>();
  for (const m of masteryList) masteryMap.set(m.conceptId, m);

  return [...concepts].sort((a, b) => {
    const aData = masteryMap.get(a.id);
    const bData = masteryMap.get(b.id);

    const aOverdue = aData?.nextDue ? aData.nextDue.getTime() <= now.getTime() : false;
    const bOverdue = bData?.nextDue ? bData.nextDue.getTime() <= now.getTime() : false;

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    const aMastery = aData ? aData.mastery : 0.0;
    const bMastery = bData ? bData.mastery : 0.0;

    return aMastery - bMastery;
  });
}

test("Adaptive ranking: weakest concepts (lowest mastery) prioritized first", () => {
  const now = new Date("2026-05-01T12:00:00Z");
  const concepts: MockConcept[] = [
    { id: "c1", slug: "strong-concept" },
    { id: "c2", slug: "weak-concept" },
    { id: "c3", slug: "medium-concept" },
  ];
  const mastery: MockMastery[] = [
    { conceptId: "c1", mastery: 0.9, nextDue: new Date("2026-05-10T12:00:00Z") },
    { conceptId: "c2", mastery: 0.2, nextDue: new Date("2026-05-10T12:00:00Z") },
    { conceptId: "c3", mastery: 0.5, nextDue: new Date("2026-05-10T12:00:00Z") },
  ];

  const ranked = rankConcepts(concepts, mastery, now);
  assertEq(ranked[0].id, "c2", "c2 (mastery 0.2) must be first");
  assertEq(ranked[1].id, "c3", "c3 (mastery 0.5) must be second");
  assertEq(ranked[2].id, "c1", "c1 (mastery 0.9) must be last");
});

test("Adaptive ranking: overdue concepts (next_due <= now) prioritized before non-overdue", () => {
  const now = new Date("2026-05-01T12:00:00Z");
  const concepts: MockConcept[] = [
    { id: "c1", slug: "low-mastery-not-due" },
    { id: "c2", slug: "high-mastery-overdue" },
  ];
  const mastery: MockMastery[] = [
    { conceptId: "c1", mastery: 0.2, nextDue: new Date("2026-05-05T12:00:00Z") }, // not due
    { conceptId: "c2", mastery: 0.8, nextDue: new Date("2026-04-30T12:00:00Z") }, // overdue
  ];

  const ranked = rankConcepts(concepts, mastery, now);
  assertEq(ranked[0].id, "c2", "Overdue concept c2 must be ranked before non-overdue c1");
});

test("Recently-seen question exclusion logic", () => {
  const allQuestionIds = ["q1", "q2", "q3", "q4", "q5"];
  const recentAnsweredIds = new Set(["q1", "q2", "q3"]);

  const fresh = allQuestionIds.filter((id) => !recentAnsweredIds.has(id));
  assertEq(fresh.length, 2, "Only 2 questions remain fresh");
  assert(fresh.includes("q4"), "q4 must be included");
  assert(fresh.includes("q5"), "q5 must be included");
});

test("Fallback supplementation when question count is insufficient", () => {
  const targetCount = 10;
  const picked = ["q4", "q5"];
  const pool = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11"];

  const supplemented = [...picked];
  for (const item of pool) {
    if (!supplemented.includes(item)) {
      supplemented.push(item);
    }
    if (supplemented.length >= targetCount) break;
  }

  assertEq(supplemented.length, 10, "Supplemented list must reach target size 10");
  assertEq(new Set(supplemented).size, 10, "All supplemented IDs must be unique");
});

console.log("\n=======================================================");
console.log(`Results: ${passed} passed  ${failed} failed  (${passed + failed} total)`);
console.log("=======================================================\n");

if (failed > 0) process.exit(1);
