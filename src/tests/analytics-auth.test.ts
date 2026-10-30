/**
 * Test Suite: Analytics & Admin Auth Barriers
 *
 * Verifies:
 * 1. Role-based authorization & IP checks in checkIsAdmin
 * 2. Unauthenticated caller rejection (HTTP 401)
 * 3. Non-admin candidate rejection on administrative endpoints (HTTP 403)
 * 4. Authorized admin privilege granting (HTTP 200)
 * 5. Deterministic computation of personal candidate analytics:
 *    - Empty data resilience (0 sessions)
 *    - Malformed/null database values
 *    - Trajectory ordering, average/peak scores, skill confidence tallies, gap frequencies, and recommendation generation
 */

import { checkIsAdmin, getAdminUserIds, getAllowedIPs, getClientIP, isLocalhostIP } from "../lib/auth/admin";
import { computeUserAnalytics } from "../lib/analytics/user";

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`  ✅ PASS: ${message}`);
}

async function runTests() {
  console.log("\n======================================================");
  console.log("       ANALYTICS & ADMIN AUTH BARRIER SUITE           ");
  console.log("======================================================\n");

  // Save initial env
  const origEnv = { ...process.env };

  try {
    // ── Test 1: Unauthenticated caller rejection ───────────────────────
    console.log("▶ Test 1: Unauthenticated caller handling");
    {
      const unauthResult = await checkIsAdmin(undefined, { userId: null });
      assert(unauthResult.isAdmin === false, "Unauthenticated user is not admin");
      assert(unauthResult.status === 401, "Unauthenticated user receives status 401");
      assert(unauthResult.error === "Unauthorized", "Error message indicates Unauthorized");
    }

    // ── Test 2: Non-admin candidate rejection (HTTP 403) ───────────────
    console.log("\n▶ Test 2: Non-admin candidate rejection");
    {
      process.env.ADMIN_USER_IDS = "admin_clerk_id_999";
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      const candidateResult = await checkIsAdmin(undefined, {
        userId: "candidate_clerk_id_123",
        sessionClaims: { role: "candidate" },
      });

      assert(candidateResult.isAdmin === false, "Candidate is denied administrative privileges");
      assert(candidateResult.status === 403, "Candidate receives status 403");
      assert(
        candidateResult.error?.includes("Admin privileges required") === true,
        "Error message specifies admin privileges required"
      );
    }

    // ── Test 3: Admin privilege grant via allowlist or role ────────────
    console.log("\n▶ Test 3: Admin authorization via allowlist & role claims");
    {
      process.env.ADMIN_USER_IDS = "admin_clerk_id_999,admin_ops_id_777";
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // 3a. Matching user in allowlist
      const allowlistedAdmin = await checkIsAdmin(undefined, {
        userId: "admin_clerk_id_999",
      });
      assert(allowlistedAdmin.isAdmin === true, "Allowlisted user ID is granted admin access");
      assert(allowlistedAdmin.userId === "admin_clerk_id_999", "Admin userId is returned");

      // 3b. User with Clerk admin role in claims
      const roleAdmin = await checkIsAdmin(undefined, {
        userId: "other_user_id_444",
        sessionClaims: { role: "admin" },
      });
      assert(roleAdmin.isAdmin === true, "User with direct role:admin claim is granted admin access");

      // 3c. User with Clerk metadata.role: admin in claims
      const metadataRoleAdmin = await checkIsAdmin(undefined, {
        userId: "other_user_id_555",
        sessionClaims: { metadata: { role: "admin" } },
      });
      assert(
        metadataRoleAdmin.isAdmin === true,
        "User with metadata.role:admin claim is granted admin access"
      );
    }

    // ── Test 4: IP Allowlist enforcement ───────────────────────────────
    console.log("\n▶ Test 4: IP Allowlist validation");
    {
      process.env.ADMIN_USER_IDS = "admin_clerk_id_999";
      process.env.ADMIN_ALLOWED_IPS = "192.168.1.50,10.0.0.1";
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      // Disallowed client IP
      const mockDisallowedReq = {
        headers: new Headers({ "x-forwarded-for": "203.0.113.195" }),
      } as unknown as Request;

      const ipDenied = await checkIsAdmin(mockDisallowedReq, {
        userId: "admin_clerk_id_999",
      });
      assert(ipDenied.isAdmin === false, "Admin user on unauthorized IP is blocked");
      assert(ipDenied.status === 403, "Status is 403 on IP mismatch");

      // Allowed IP
      const mockAllowedReq = {
        headers: new Headers({ "x-forwarded-for": "192.168.1.50" }),
      } as unknown as Request;

      const ipAllowed = await checkIsAdmin(mockAllowedReq, {
        userId: "admin_clerk_id_999",
      });
      assert(ipAllowed.isAdmin === true, "Admin user on authorized IP is permitted");

      // Localhost IP always permitted
      const mockLocalhostReq = {
        headers: new Headers({ "x-real-ip": "127.0.0.1" }),
      } as unknown as Request;

      const localhostAllowed = await checkIsAdmin(mockLocalhostReq, {
        userId: "admin_clerk_id_999",
      });
      assert(localhostAllowed.isAdmin === true, "Admin user on localhost is permitted");
    }

    // ── Test 5: User Analytics computation on empty & malformed data ───
    console.log("\n▶ Test 5: Candidate analytics computation resilience");
    {
      // 5a. Completely empty list
      const emptyAnalytics = computeUserAnalytics([]);
      assert(emptyAnalytics.summary.totalInterviews === 0, "Empty list yields totalInterviews: 0");
      assert(emptyAnalytics.summary.completedInterviews === 0, "completedInterviews is 0");
      assert(emptyAnalytics.summary.averageScore === null, "averageScore is null for empty list");
      assert(emptyAnalytics.summary.highestScore === null, "highestScore is null for empty list");
      assert(emptyAnalytics.trajectory.length === 0, "trajectory is empty array");
      assert(
        emptyAnalytics.practiceRecommendations.length === 3,
        "Baseline practice recommendations provided on empty history"
      );
      assert(emptyAnalytics.recentSessions.length === 0, "recentSessions is empty array");

      // 5b. Malformed data handling (nulls, missing feedback, invalid numbers)
      const malformedData = [
        null,
        undefined,
        {},
        { status: "completed", score: "not-a-number", feedback: null },
        { status: "ongoing", totalTurns: null },
        { status: "completed", score: null, feedback: { overallScore: "invalid" } },
      ];

      const malformedResult = computeUserAnalytics(malformedData);
      assert(malformedResult.summary.totalInterviews === 6, "Safely counts all non-null entries");
      assert(malformedResult.summary.averageScore === null, "Invalid scores do not produce NaN average");
      assert(malformedResult.trajectory.length === 0, "No invalid scores in trajectory");
      assert(
        malformedResult.skillConfidences.high === 0 &&
          malformedResult.skillConfidences.medium === 0 &&
          malformedResult.skillConfidences.low === 0,
        "Skill confidences gracefully stay 0 on missing feedback"
      );

      // 5c. Multi-session realistic candidate progression
      const realisticSessions = [
        {
          id: "session-1",
          jobRole: "Senior Backend Engineer",
          status: "completed",
          score: 80,
          totalTurns: 6,
          createdAt: new Date("2026-03-01T10:00:00Z"),
          feedback: {
            overallScore: 80,
            skillAssessments: [
              { skill: "PostgreSQL", confidence: "high" },
              { skill: "Distributed Systems", confidence: "medium" },
            ],
            questionFeedback: [
              {
                question: "Explain Postgres MVCC",
                answerQuality: "excellent",
                gaps: ["Vacuum tuning"],
                strengths: ["Index selection"],
              },
              {
                question: "Design cache invalidation",
                answerQuality: "good",
                gaps: ["Thundering herd mitigations"],
                strengths: ["TTL strategies"],
              },
            ],
          },
        },
        {
          id: "session-2",
          jobRole: "Senior Backend Engineer",
          status: "completed",
          score: 90,
          totalTurns: 8,
          createdAt: new Date("2026-03-10T14:00:00Z"),
          feedback: {
            overallScore: 90,
            skillAssessments: [
              { skill: "PostgreSQL", confidence: "high" },
              { skill: "Distributed Systems", confidence: "high" },
            ],
            questionFeedback: [
              {
                question: "Explain consensus protocols",
                answerQuality: "excellent",
                gaps: ["Vacuum tuning"],
                strengths: ["Raft leader election"],
              },
            ],
          },
        },
        {
          id: "session-3",
          jobRole: "Staff Systems Engineer",
          status: "ongoing",
          totalTurns: 2,
          createdAt: new Date("2026-03-15T09:00:00Z"),
          feedback: null,
        },
      ];

      const richAnalytics = computeUserAnalytics(realisticSessions);
      assert(richAnalytics.summary.totalInterviews === 3, "Total interviews is 3");
      assert(richAnalytics.summary.completedInterviews === 2, "Completed interviews is 2");
      assert(richAnalytics.summary.ongoingInterviews === 1, "Ongoing interviews is 1");
      assert(richAnalytics.summary.averageScore === 85, "Average score computed as exactly 85 (80 + 90 / 2)");
      assert(richAnalytics.summary.highestScore === 90, "Highest score identified as 90");
      assert(richAnalytics.summary.totalTurns === 16, "Total turns correctly summed (6 + 8 + 2 = 16)");
      assert(richAnalytics.summary.totalQuestionsAnswered === 3, "Total questions answered is 3");

      // Trajectory verification (chronological)
      assert(richAnalytics.trajectory.length === 2, "Trajectory has 2 completed sessions");
      assert(richAnalytics.trajectory[0].score === 80, "First chronological session is score 80");
      assert(richAnalytics.trajectory[1].score === 90, "Second chronological session is score 90");

      // Skill Confidences
      assert(richAnalytics.skillConfidences.high === 3, "High confidence count is 3");
      assert(richAnalytics.skillConfidences.medium === 1, "Medium confidence count is 1");
      assert(richAnalytics.skillConfidences.low === 0, "Low confidence count is 0");

      // Skill Gaps & Strengths
      assert(
        richAnalytics.skillGaps[0].area === "Vacuum tuning" && richAnalytics.skillGaps[0].frequency === 2,
        "Top skill gap is 'Vacuum tuning' with frequency 2"
      );
      assert(
        richAnalytics.practiceRecommendations[0].title.includes("Vacuum tuning"),
        "Practice recommendations tailored to top recorded gap topic"
      );

      // Answer Quality
      assert(richAnalytics.answerQuality.excellent === 2, "Excellent answers count is 2");
      assert(richAnalytics.answerQuality.good === 1, "Good answers count is 1");

      // Recent sessions
      assert(richAnalytics.recentSessions.length === 3, "Recent sessions contains all 3 entries");
      assert(
        richAnalytics.recentSessions[0].id === "session-3",
        "Recent sessions sorted newest first (session-3 on top)"
      );

      // Deep Feedback & Practice Gym features
      assert(richAnalytics.recentEvaluations.length === 2, "2 completed evaluations captured in recentEvaluations");
      assert(richAnalytics.dimensionRatings.systemDesign > 0, "systemDesign dimension rating computed");
      assert(richAnalytics.dimensionRatings.codeLogic > 0, "codeLogic dimension rating computed");
      assert(richAnalytics.topBlindspots.length > 0, "topBlindspots identifies recurring gaps");
      assert(
        richAnalytics.topBlindspots[0].area === "Vacuum tuning" && richAnalytics.topBlindspots[0].severity === "critical",
        "Top blindspot correctly classified as critical with frequency >= 2"
      );
    }

    console.log("\n======================================================");
    console.log(` Results: ${passedAssertions} passed  0 failed  (${totalAssertions} total)`);
    console.log("======================================================\n");
  } finally {
    // Restore process.env
    process.env = origEnv;
  }
}

runTests().catch((err) => {
  console.error("Test execution aborted:", err);
  process.exit(1);
});
