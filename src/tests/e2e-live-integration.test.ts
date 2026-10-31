/**
 * End-to-End Live Integration Verification Suite
 *
 * Validates complete end-to-end flows across:
 * 1. DRILLS: Seeding integrity, live session creation, question retrieval, deterministic grading,
 *    answer persistence, session completion, EMA mastery update, and SM-2 spaced repetition scheduling.
 * 2. INTERVIEWS: Conversation turn schema conformance, early session exit handling, and feedback generation.
 * 3. ANALYTICS & BRIDGE: User analytics aggregation, blindspot extraction, bidirectional mapping from
 *    interview blindspots to drill slugs, and gym analytics computations.
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  drills,
  concepts,
  questions,
  practiceSets,
  drillSessions,
  sessionAnswers,
  userConceptMastery,
} from "../db/schema";
import { gradeAnswer } from "../lib/drills/grading";
import { computeEmaMastery, computeNextDue } from "../lib/drills/mastery";
import { computeUserAnalytics, computeGymAnalytics } from "../lib/analytics/user";
import { LLMTurnResponseSchema } from "../schemas/brain";
import type { QuestionPayload, Rubric } from "../schemas/drills";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
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

async function runAll() {
  console.log("\n=======================================================");
  console.log("   PREPAI END-TO-END VERIFICATION: DRILLS, INTERVIEWS, ANALYTICS");
  console.log("=======================================================");

  const testUserId = `e2e_test_user_${Date.now()}`;

  // ─────────────────────────────────────────────────────────────────
  // PART 1: DRILLS E2E VALIDATION
  // ─────────────────────────────────────────────────────────────────
  console.log("\n▶ [DRILLS E2E] Database Integrity & Session Flow");

  await test("Database contains all 6 taxonomy drills and 100 concepts", async () => {
    const allDrills = await db.select().from(drills);
    assert(allDrills.length === 6, `Expected 6 drills, found ${allDrills.length}`);

    const allConcepts = await db.select().from(concepts);
    assert(allConcepts.length === 100, `Expected 100 concepts, found ${allConcepts.length}`);

    const allQuestions = await db.select().from(questions).where(eq(questions.reviewStatus, "approved"));
    assert(allQuestions.length >= 200, `Expected at least 200 approved questions, found ${allQuestions.length}`);

    const allSets = await db.select().from(practiceSets);
    assert(allSets.length === 24, `Expected 24 practice sets (4 per drill), found ${allSets.length}`);
  });

  let createdSessionId: string | null = null;
  let testQuestionId: string | null = null;
  let testConceptId: string | null = null;

  await test("Create live Drill Session with snapshot questions", async () => {
    const sysDesignDrill = await db.select().from(drills).where(eq(drills.slug, "system-design")).limit(1);
    assert(sysDesignDrill.length > 0, "system-design drill must exist");
    const drillId = sysDesignDrill[0].id;

    // Pick 4 approved questions from system-design
    const sampleQuestions = await db
      .select()
      .from(questions)
      .where(and(eq(questions.drillId, drillId), eq(questions.reviewStatus, "approved")))
      .limit(4);

    assert(sampleQuestions.length === 4, "Must retrieve 4 questions for session");
    testQuestionId = sampleQuestions[0].id;
    testConceptId = (sampleQuestions[0].conceptIds as string[])?.[0] ?? null;

    const [session] = await db
      .insert(drillSessions)
      .values({
        drillId,
        userId: testUserId,
        mode: "adhoc",
        level: "senior",
        questionIds: sampleQuestions.map((q) => q.id),
        currentIndex: 0,
        status: "active",
      })
      .returning();

    assert(Boolean(session?.id), "Session must be created with ID");
    createdSessionId = session.id;
  });

  await test("Grade answer and persist to session_answers", async () => {
    assert(Boolean(createdSessionId), "Session ID required");
    assert(Boolean(testQuestionId), "Question ID required");

    const [qRow] = await db.select().from(questions).where(eq(questions.id, testQuestionId!)).limit(1);
    assert(Boolean(qRow), "Question must exist in DB");

    const payload = qRow.payload as QuestionPayload;
    const rubric = qRow.rubric as Rubric;
    const submittedOption = (payload as { correct_key?: string })?.correct_key ?? "B";

    // Grade answer
    const gradeResult = await gradeAnswer({
      questionId: testQuestionId!,
      type: qRow.type,
      payload,
      rubric,
      modelAnswer: qRow.modelAnswer ?? "",
      explanation: qRow.explanation ?? "",
      userAnswer: submittedOption,
    });

    assert(typeof gradeResult.score === "number", "Score must be numeric");

    // Insert answer record
    const [answerRecord] = await db
      .insert(sessionAnswers)
      .values({
        sessionId: createdSessionId!,
        questionId: testQuestionId!,
        answer: { selected: submittedOption },
        isCorrect: gradeResult.isCorrect,
        score: gradeResult.score,
        gradingMethod: gradeResult.gradingMethod,
        confidence: gradeResult.confidence,
        timeTakenMs: 4200,
      })
      .returning();

    assert(Boolean(answerRecord?.id), "Answer record must be created");
  });

  await test("Finish Drill Session & update Concept Mastery EMA + SM-2 due date", async () => {
    assert(Boolean(createdSessionId), "Session ID required");

    // Mark session complete
    await db
      .update(drillSessions)
      .set({
        status: "completed",
        score: 85,
        finishedAt: new Date(),
      })
      .where(eq(drillSessions.id, createdSessionId!));

    const [finishedSession] = await db
      .select()
      .from(drillSessions)
      .where(eq(drillSessions.id, createdSessionId!))
      .limit(1);

    assertEq(finishedSession.status, "completed", "Session status must be completed");
    assertEq(finishedSession.score, 85, "Session score must match 85");

    // Update concept mastery
    if (testConceptId) {
      const existingMastery = 0.5;
      const answerScore = 1.0;
      const newMastery = computeEmaMastery(existingMastery, answerScore);
      assertEq(newMastery, 0.65, "EMA of 0.5 and 1.0 should be 0.65");

      const nextDue = computeNextDue(newMastery);
      const diffHours = (nextDue.getTime() - Date.now()) / (1000 * 60 * 60);
      assert(diffHours > 48, "Next due date must be scheduled >= 48 hours for 0.65 mastery");

      await db
        .insert(userConceptMastery)
        .values({
          userId: testUserId,
          conceptId: testConceptId,
          mastery: newMastery,
          nextDue,
        })
        .onConflictDoUpdate({
          target: [userConceptMastery.userId, userConceptMastery.conceptId],
          set: {
            mastery: newMastery,
            nextDue,
            updatedAt: new Date(),
          },
        });

      const [storedMastery] = await db
        .select()
        .from(userConceptMastery)
        .where(
          and(
            eq(userConceptMastery.userId, testUserId),
            eq(userConceptMastery.conceptId, testConceptId),
          ),
        )
        .limit(1);

      assert(Boolean(storedMastery), "Mastery row must exist");
      assertEq(storedMastery.mastery, 0.65, "Persisted mastery must match 0.65");
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // PART 2: INTERVIEWS E2E VALIDATION
  // ─────────────────────────────────────────────────────────────────
  console.log("\n▶ [INTERVIEWS E2E] Schema Conformance & Feedback Extraction");

  await test("Turn Response Schema conforms to LLMTurnResponse format", () => {
    const rawTurnResponse = {
      say: "That is a sound approach to partitioning. How would you handle hot partitions in your Kafka cluster?",
      intent: "answer",
      decision: {
        action: "followup",
        nextTopic: null,
        reason: "Probe deeper into Kafka partition skew mitigation.",
      },
      evaluation: {
        answeredQuestion: true,
        unclearOrGarbled: false,
        offTopic: false,
        score: 8,
        confidence: 0.95,
        strengths: ["Clear explanation of key-based partitioning"],
        gaps: ["Did not address partition skew"],
        facts: ["Uses Kafka with 10k TPS"],
        openThread: "Kafka partition skew",
      },
    };

    const parsed = LLMTurnResponseSchema.safeParse(rawTurnResponse);
    if (!parsed.success) {
      throw new Error(`Schema parse failed: ${JSON.stringify(parsed.error?.issues)}`);
    }
    assertEq(parsed.data.say.startsWith("That is a sound approach"), true, "Say field verified");
    assertEq(parsed.data.decision.action, "followup", "Decision action verified");
  });

  const mockInterviewFeedback = {
    overallScore: 78,
    hiringRecommendation: "hire",
    summary: "Strong systems candidate with deep distributed caching experience but gaps in database indexing and concurrency locks.",
    strengths: [
      "Distributed Caching with Redis",
      "Microservice Decomposition",
      "Event-Driven Architecture",
    ],
    areasForImprovement: [
      "Database Concurrency & Row Locks",
      "System Design & Distributed Scalability",
    ],
    skillAssessments: [
      { skill: "Distributed Systems", confidence: "high", demonstrated: true },
      { skill: "PostgreSQL Concurrency", confidence: "medium", demonstrated: false },
    ],
    questionFeedback: [
      {
        question: "Explain two-phase locking vs optimistic concurrency control.",
        focusArea: "Database Concurrency",
        answerQuality: "fair",
        strengths: ["Understands isolation levels"],
        gaps: ["Confused deadlocks with lock waits"],
        suggestedImprovement: "Review Postgres row-level locks and MVCC.",
      },
    ],
    interviewDuration: 1200,
  };

  await test("Interview early-exit and feedback object normalization", () => {
    const rawSessions = [
      {
        id: "interview_test_001",
        jobRole: "Senior Backend Engineer",
        status: "completed",
        score: 78,
        totalTurns: 12,
        createdAt: new Date().toISOString(),
        feedback: JSON.stringify(mockInterviewFeedback), // tests JSON string parsing
      },
      {
        id: "interview_test_002",
        jobRole: "Senior Backend Engineer",
        status: "ongoing",
        currentPhase: "closed",
        score: null,
        totalTurns: 2,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        feedback: {
          overallScore: 0,
          hiringRecommendation: "do_not_hire",
          summary: "Interview ended early.",
          strengths: [],
          areasForImprovement: ["Interview was not completed."],
        }, // tests plain object feedback
      },
    ];

    const analytics = computeUserAnalytics(rawSessions);
    assertEq(analytics.summary.totalInterviews, 2, "Must aggregate 2 interviews");
    assertEq(analytics.summary.completedInterviews, 2, "Both completed and closed-with-score are counted as completed");
    assert(analytics.summary.averageScore !== null && analytics.summary.averageScore > 0, "Average score computed");
  });

  // ─────────────────────────────────────────────────────────────────
  // PART 3: ANALYTICS & BRIDGE E2E VALIDATION
  // ─────────────────────────────────────────────────────────────────
  console.log("\n▶ [ANALYTICS & BRIDGE E2E] Blindspots to Targeted Drills Mapping");

  await test("Interview feedback areasForImprovement map accurately to Drill slugs", () => {
    const rawSessions = [
      {
        id: "interview_test_bridge",
        jobRole: "Principal Systems Architect",
        status: "completed",
        score: 74,
        totalTurns: 10,
        createdAt: new Date().toISOString(),
        feedback: mockInterviewFeedback,
      },
    ];

    const analytics = computeUserAnalytics(rawSessions);
    assert(analytics.topBlindspots.length >= 2, "Must identify top blindspots from gaps");

    const blindspotMap = new Map(analytics.topBlindspots.map((b) => [b.area, b.recommendedDrill]));

    // "Database Concurrency & Row Locks" -> "database-concurrency"
    const dbDrill = blindspotMap.get("Database Concurrency & Row Locks");
    assertEq(
      dbDrill,
      "database-concurrency",
      "Database concurrency gap must map to 'database-concurrency' drill",
    );

    // "System Design & Distributed Scalability" -> "system-design"
    const sdDrill = blindspotMap.get("System Design & Distributed Scalability");
    assertEq(
      sdDrill,
      "system-design",
      "System design gap must map to 'system-design' drill",
    );
  });

  await test("Gym Analytics accurately aggregates user progress and streak", async () => {
    const gymAnalytics = await computeGymAnalytics(testUserId);
    assert(Array.isArray(gymAnalytics.drillStats), "drillStats must be an array");
    assertEq(gymAnalytics.drillStats.length, 6, "drillStats must include all 6 taxonomy drills");

    const sysDesignStats = gymAnalytics.drillStats.find((d) => d.slug === "system-design");
    assert(Boolean(sysDesignStats), "system-design drill stats must be present");
    assert(sysDesignStats!.attempts >= 1, "Completed session must increment attempts");
    assertEq(sysDesignStats!.avgScore, 85, "Average score must reflect completed session");

    const totalAttempts = gymAnalytics.drillStats.reduce((acc, d) => acc + d.attempts, 0);
    assert(totalAttempts >= 1, "Total completed attempts must be >= 1");
    assert(gymAnalytics.streak >= 1, "Streak must be active (>= 1)");
  });

  // ─────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────
  console.log("\n▶ [CLEANUP] Cleaning up ephemeral test records");
  try {
    if (createdSessionId) {
      await db.delete(sessionAnswers).where(eq(sessionAnswers.sessionId, createdSessionId));
      await db.delete(drillSessions).where(eq(drillSessions.id, createdSessionId));
    }
    if (testUserId) {
      await db.delete(userConceptMastery).where(eq(userConceptMastery.userId, testUserId));
    }
    console.log("  ✅  Cleanup completed successfully");
  } catch (err) {
    console.warn("  ⚠️  Cleanup warning:", err);
  }

  console.log("\n=======================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error("Unhandled error in E2E suite:", err);
  process.exit(1);
});
