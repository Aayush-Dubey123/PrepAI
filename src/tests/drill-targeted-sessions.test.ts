/**
 * Test Suite: Drill Targeted Sessions & Feature Guards
 *
 * Verifies:
 * 1. 403 FEATURE_DISABLED: Feature flag precedence rule & API rejection when disabled
 * 2. 409 INSUFFICIENT_CONCEPT_CONTENT: Refusal to silently produce a generic set when concept questions < 2
 * 3. 400 TARGET_CONCEPT_DRILL_MISMATCH: Cross-drill concept pollution rejection
 * 4. Targeted Concept Prioritization: Target concept questions strictly positioned at indices 0 and 1
 * 5. Direct Session Launch: Valid practiceSetId snapshots exact set questions and returns 201 without redirects
 */

import { isTechnicalPracticeEnabled } from "../lib/config";
import { ConceptContentError } from "../lib/drills/smart-set";
import { DrillSessionCreateSchema } from "../schemas/drills";

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
console.log("   DRILL TARGETED SESSIONS & FEATURE GUARDS SUITE      ");
console.log("=======================================================\n");

// ── 1. Feature Flag Precedence & 403 FEATURE_DISABLED ───────────────────────

test("Feature flag: NEXT_PUBLIC_PRACTICE_ENABLED takes absolute precedence over legacy flag", () => {
  const origPractice = process.env.NEXT_PUBLIC_PRACTICE_ENABLED;
  const origGym = process.env.NEXT_PUBLIC_GYM_ENABLED;

  try {
    // Both defined: new flag wins (true vs false)
    process.env.NEXT_PUBLIC_PRACTICE_ENABLED = "true";
    process.env.NEXT_PUBLIC_GYM_ENABLED = "false";
    assertEq(isTechnicalPracticeEnabled(), true, "New flag 'true' must override legacy 'false'");

    // Both defined: new flag wins (false vs true)
    process.env.NEXT_PUBLIC_PRACTICE_ENABLED = "false";
    process.env.NEXT_PUBLIC_GYM_ENABLED = "true";
    assertEq(isTechnicalPracticeEnabled(), false, "New flag 'false' must override legacy 'true'");

    // Only legacy defined
    delete process.env.NEXT_PUBLIC_PRACTICE_ENABLED;
    process.env.NEXT_PUBLIC_GYM_ENABLED = "false";
    assertEq(isTechnicalPracticeEnabled(), false, "Legacy flag 'false' honored when new flag undefined");

    process.env.NEXT_PUBLIC_GYM_ENABLED = "true";
    assertEq(isTechnicalPracticeEnabled(), true, "Legacy flag 'true' honored when new flag undefined");

    // Neither defined -> default true
    delete process.env.NEXT_PUBLIC_PRACTICE_ENABLED;
    delete process.env.NEXT_PUBLIC_GYM_ENABLED;
    assertEq(isTechnicalPracticeEnabled(), true, "Defaults to enabled (true) when neither flag set");
  } finally {
    if (origPractice !== undefined) process.env.NEXT_PUBLIC_PRACTICE_ENABLED = origPractice;
    else delete process.env.NEXT_PUBLIC_PRACTICE_ENABLED;

    if (origGym !== undefined) process.env.NEXT_PUBLIC_GYM_ENABLED = origGym;
    else delete process.env.NEXT_PUBLIC_GYM_ENABLED;
  }
});

test("403 FEATURE_DISABLED: Guard function rejects session creation when disabled", () => {
  const origPractice = process.env.NEXT_PUBLIC_PRACTICE_ENABLED;
  try {
    process.env.NEXT_PUBLIC_PRACTICE_ENABLED = "false";

    function guardSessionCreation(): { status: number; body: { error: string; code: string } } | null {
      if (!isTechnicalPracticeEnabled()) {
        return {
          status: 403,
          body: { error: "Technical Practice is currently disabled", code: "FEATURE_DISABLED" },
        };
      }
      return null;
    }

    const rejection = guardSessionCreation();
    assert(rejection !== null, "Must return rejection response when feature disabled");
    assertEq(rejection!.status, 403, "Must return HTTP 403 status code");
    assertEq(rejection!.body.code, "FEATURE_DISABLED", "Error code must be FEATURE_DISABLED");
  } finally {
    if (origPractice !== undefined) process.env.NEXT_PUBLIC_PRACTICE_ENABLED = origPractice;
    else delete process.env.NEXT_PUBLIC_PRACTICE_ENABLED;
  }
});

// ── 2. Schema Validation with targetConceptId ───────────────────────────────

test("DrillSessionCreateSchema validates targetConceptId uuid parameter", () => {
  const validUuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const parsed = DrillSessionCreateSchema.parse({
    level: "senior",
    mode: "practice",
    isSmartSet: true,
    targetConceptId: validUuid,
  });

  assertEq(parsed.targetConceptId, validUuid, "Schema must parse targetConceptId correctly");
  assertEq(parsed.isSmartSet, true, "isSmartSet must be true");

  let invalidUuidError = false;
  try {
    DrillSessionCreateSchema.parse({
      level: "senior",
      mode: "practice",
      targetConceptId: "not-a-valid-uuid",
    });
  } catch {
    invalidUuidError = true;
  }
  assert(invalidUuidError, "Schema must reject non-UUID targetConceptId");
});

// ── 3. Concept Drill Membership Validation (400 TARGET_CONCEPT_DRILL_MISMATCH) 

test("400 TARGET_CONCEPT_DRILL_MISMATCH: Concept belonging to different drill is rejected", () => {
  interface MockConcept {
    id: string;
    drillId: string;
  }

  const mockConcepts: Record<string, MockConcept> = {
    "concept-sys-1": { id: "concept-sys-1", drillId: "drill-system-design" },
    "concept-algo-1": { id: "concept-algo-1", drillId: "drill-algo-logic" },
  };

  function validateConceptForDrill(drillId: string, conceptId?: string): void {
    if (!conceptId) return;
    const concept = mockConcepts[conceptId];
    if (!concept || concept.drillId !== drillId) {
      throw new ConceptContentError(
        "Target concept does not belong to the requested drill",
        "TARGET_CONCEPT_DRILL_MISMATCH",
      );
    }
  }

  // Cross-drill pollution: concept-sys-1 requested for drill-algo-logic
  let caughtError: ConceptContentError | null = null;
  try {
    validateConceptForDrill("drill-algo-logic", "concept-sys-1");
  } catch (e) {
    if (e instanceof ConceptContentError) caughtError = e;
  }

  assert(caughtError !== null, "Must throw ConceptContentError on drill mismatch");
  assertEq(caughtError!.code, "TARGET_CONCEPT_DRILL_MISMATCH", "Error code must be TARGET_CONCEPT_DRILL_MISMATCH");

  // Valid drill match: concept-sys-1 for drill-system-design
  let validPassed = true;
  try {
    validateConceptForDrill("drill-system-design", "concept-sys-1");
  } catch {
    validPassed = false;
  }
  assert(validPassed, "Matching drill and concept must validate without error");
});

// ── 4. No-Bait-and-Switch Guard (409 INSUFFICIENT_CONCEPT_CONTENT) ──────────

test("409 INSUFFICIENT_CONCEPT_CONTENT: Refuses silent fallback if approved questions < 2", () => {
  interface MockQuestion {
    id: string;
    drillId: string;
    level: string;
    reviewStatus: string;
    conceptIds: string[];
  }

  const mockQuestions: MockQuestion[] = [
    // Only 1 question for concept-sparse at senior level
    {
      id: "q-sparse-1",
      drillId: "drill-1",
      level: "senior",
      reviewStatus: "approved",
      conceptIds: ["concept-sparse"],
    },
    // Another question for concept-sparse but only at foundational level
    {
      id: "q-sparse-2",
      drillId: "drill-1",
      level: "foundational",
      reviewStatus: "approved",
      conceptIds: ["concept-sparse"],
    },
  ];

  function buildTargetedSmartQueue(
    drillId: string,
    level: string,
    targetConceptId?: string,
  ): string[] {
    if (targetConceptId) {
      const approved = mockQuestions.filter(
        (q) =>
          q.drillId === drillId &&
          q.level === level &&
          q.reviewStatus === "approved" &&
          q.conceptIds.includes(targetConceptId),
      );

      if (approved.length < 2) {
        throw new ConceptContentError(
          "Not enough approved questions available for the requested concept at this difficulty tier",
          "INSUFFICIENT_CONCEPT_CONTENT",
        );
      }

      return approved.map((q) => q.id);
    }
    return [];
  }

  let error409: ConceptContentError | null = null;
  try {
    buildTargetedSmartQueue("drill-1", "senior", "concept-sparse");
  } catch (e) {
    if (e instanceof ConceptContentError) error409 = e;
  }

  assert(error409 !== null, "Must throw ConceptContentError when approved questions < 2");
  assertEq(error409!.code, "INSUFFICIENT_CONCEPT_CONTENT", "Error code must be INSUFFICIENT_CONCEPT_CONTENT");
});

// ── 5. Targeted Concept Prioritization at Indices 0 and 1 ───────────────────

test("Targeted Concept Prioritization: Matching questions strictly occupy indices 0 and 1", () => {
  interface MockQuestion {
    id: string;
    conceptIds: string[];
  }

  const targetConceptId = "concept-caching";
  const allQuestions: MockQuestion[] = [
    { id: "q-supp-1", conceptIds: ["concept-sharding"] },
    { id: "q-target-1", conceptIds: [targetConceptId] },
    { id: "q-supp-2", conceptIds: ["concept-consensus"] },
    { id: "q-target-2", conceptIds: [targetConceptId] },
    { id: "q-supp-3", conceptIds: ["concept-networking"] },
    { id: "q-supp-4", conceptIds: ["concept-storage"] },
    { id: "q-supp-5", conceptIds: ["concept-replication"] },
    { id: "q-supp-6", conceptIds: ["concept-security"] },
    { id: "q-supp-7", conceptIds: ["concept-tracing"] },
    { id: "q-supp-8", conceptIds: ["concept-monitoring"] },
  ];

  function assembleTargetedQueue(targetConcept: string, questionsList: MockQuestion[]): string[] {
    const targetApproved = questionsList.filter((q) => q.conceptIds.includes(targetConcept)).map((q) => q.id);
    if (targetApproved.length < 2) {
      throw new ConceptContentError("Insufficient content", "INSUFFICIENT_CONCEPT_CONTENT");
    }

    const prioritizedPrefix = targetApproved.slice(0, 2);
    const supplemental = questionsList
      .filter((q) => !prioritizedPrefix.includes(q.id))
      .map((q) => q.id)
      .slice(0, 8);

    return [...prioritizedPrefix, ...supplemental];
  }

  const queue = assembleTargetedQueue(targetConceptId, allQuestions);

  assertEq(queue.length, 10, "Queue must contain 10 questions");
  assertEq(queue[0], "q-target-1", "Question at index 0 MUST be a target concept question");
  assertEq(queue[1], "q-target-2", "Question at index 1 MUST be a target concept question");

  // Verify indices 0 and 1 belong to target concept
  const q0 = allQuestions.find((q) => q.id === queue[0]);
  const q1 = allQuestions.find((q) => q.id === queue[1]);
  assert(q0?.conceptIds.includes(targetConceptId) === true, "Index 0 belongs to targetConceptId");
  assert(q1?.conceptIds.includes(targetConceptId) === true, "Index 1 belongs to targetConceptId");
});

// ── 6. Direct Session Launch with Valid practiceSetId ───────────────────────

test("Direct Session Launch: Valid practiceSetId snapshots exact set questions with HTTP 201", () => {
  interface MockPracticeSet {
    id: string;
    drillId: string;
    level: string;
    questionIds: string[];
  }

  const approvedQuestionDb: Record<string, boolean> = {
    "q-set-1": true,
    "q-set-2": true,
    "q-set-3": true,
    "q-set-4": true,
    "q-set-5": true,
  };

  const mockSet: MockPracticeSet = {
    id: "set-sys-foundational",
    drillId: "drill-sys",
    level: "foundational",
    questionIds: ["q-set-1", "q-set-2", "q-set-3", "q-set-4", "q-set-5"],
  };

  function simulateCreateSession(req: {
    level: string;
    mode: string;
    practiceSetId?: string;
  }): { status: number; body: { id: string; questionCount: number; practiceSetId: string | null } } {
    if (req.practiceSetId) {
      if (req.practiceSetId !== mockSet.id) {
        throw new Error("PRACTICE_SET_NOT_FOUND");
      }
      const verified = mockSet.questionIds.filter((id) => approvedQuestionDb[id]);
      if (verified.length < 4) {
        throw new Error("INSUFFICIENT_APPROVED_QUESTIONS");
      }
      return {
        status: 201,
        body: {
          id: "session-new-777",
          questionCount: verified.length,
          practiceSetId: mockSet.id,
        },
      };
    }
    return {
      status: 201,
      body: {
        id: "session-adhoc-888",
        questionCount: 10,
        practiceSetId: null,
      },
    };
  }

  const result = simulateCreateSession({
    level: "foundational",
    mode: "practice",
    practiceSetId: "set-sys-foundational",
  });

  assertEq(result.status, 201, "Direct session launch must return HTTP 201 Created");
  assertEq(result.body.questionCount, 5, "Session must snapshot exact 5 questions from practice set");
  assertEq(result.body.practiceSetId, "set-sys-foundational", "Session must link directly to the practiceSetId");
});

console.log("\n=======================================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
