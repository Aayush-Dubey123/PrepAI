/**
 * GET /api/admin/analytics
 *
 * Admin-only analytics endpoint. Protected by:
 *  1. Clerk user ID allowlist (ADMIN_USER_IDS env)
 *  2. IP address allowlist (ADMIN_ALLOWED_IPS env)
 *
 * Returns platform-wide metrics, score distributions, session stats,
 * and research-grade evaluation data for the admin dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/index";
import { interviews, transcriptChunks, auditEvents } from "@/src/db/schema";
import { eq, count, avg, desc } from "drizzle-orm";
import {
  checkIsAdmin,
  getClientIP,
  getAllowedIPs,
  getAdminUserIds,
  isLocalhostIP,
} from "@/src/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Authorize Admin Access
    const authResult = await checkIsAdmin(req);
    if (!authResult.isAdmin) {
      return NextResponse.json(
        { error: authResult.error || "Forbidden: Admin privileges required" },
        { status: authResult.status || 403 }
      );
    }

    const adminIds = getAdminUserIds();
    const allowedIPs = getAllowedIPs();
    const clientIP = getClientIP(req);
    const isLocalhost = isLocalhostIP(clientIP);
    // ── Fetch Platform Stats ──────────────────────────────────────────────

    // Total interviews by status
    const statusCounts = await db
      .select({
        status: interviews.status,
        count: count(),
      })
      .from(interviews)
      .groupBy(interviews.status);

    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusMap[row.status || "unknown"] = row.count;
    }

    const totalInterviews =
      (statusMap["completed"] || 0) +
      (statusMap["ongoing"] || 0) +
      (statusMap["failed"] || 0);

    // Total transcript chunks
    const [chunkCountRow] = await db
      .select({ count: count() })
      .from(transcriptChunks);
    const totalTranscriptChunks = chunkCountRow?.count || 0;

    // Total audit events
    const [auditCountRow] = await db
      .select({ count: count() })
      .from(auditEvents);
    const totalAuditEvents = auditCountRow?.count || 0;

    // Average score from completed interviews
    const [avgScoreRow] = await db
      .select({ avg: avg(interviews.score) })
      .from(interviews)
      .where(eq(interviews.status, "completed"));
    const averageScore = avgScoreRow?.avg ? parseFloat(String(avgScoreRow.avg)) : null;

    // Average turns per interview
    const [avgTurnsRow] = await db
      .select({ avg: avg(interviews.totalTurns) })
      .from(interviews)
      .where(eq(interviews.status, "completed"));
    const averageTurns = avgTurnsRow?.avg ? parseFloat(String(avgTurnsRow.avg)) : null;

    // ── Completed Interview Feedback Analysis ────────────────────────────

    const completedInterviews = await db
      .select({
        id: interviews.id,
        score: interviews.score,
        feedback: interviews.feedback,
        totalTurns: interviews.totalTurns,
        createdAt: interviews.createdAt,
        jobRole: interviews.jobRole,
        geminiCallsCount: interviews.geminiCallsCount,
        candidateSnapshot: interviews.candidateSnapshot,
      })
      .from(interviews)
      .where(eq(interviews.status, "completed"))
      .orderBy(desc(interviews.createdAt));

    // Score distribution (0-10, 11-20, ..., 91-100)
    const scoreDistribution: Record<string, number> = {};
    const hiringRecommendations: Record<string, number> = {
      strong_hire: 0,
      hire: 0,
      consider: 0,
      do_not_hire: 0,
      unknown: 0,
    };

    const allOverallScores: number[] = [];
    const allSkillConfidences: { high: number; medium: number; low: number } = {
      high: 0,
      medium: 0,
      low: 0,
    };
    let totalQuestionsEvaluated = 0;
    const answerQualityDist: Record<string, number> = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      no_answer: 0,
    };

    // Session activity (last 30 days)
    const sessionsPerDay: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      sessionsPerDay[d.toISOString().split("T")[0]] = 0;
    }

    for (const iv of completedInterviews) {
      const fb = iv.feedback as Record<string, unknown> | null;
      const overallScore = (typeof fb?.overallScore === "number" ? fb.overallScore : null) ?? iv.score ?? null;

      if (typeof overallScore === "number") {
        allOverallScores.push(overallScore);
        const bucket = `${Math.floor(overallScore / 10) * 10}-${Math.min(Math.floor(overallScore / 10) * 10 + 9, 100)}`;
        scoreDistribution[bucket] = (scoreDistribution[bucket] || 0) + 1;
      }

      // Hiring recommendation
      const rec = typeof fb?.hiringRecommendation === "string" ? fb.hiringRecommendation : "unknown";
      hiringRecommendations[rec] = (hiringRecommendations[rec] || 0) + 1;

      // Skill confidence breakdown
      if (fb?.skillAssessments && Array.isArray(fb.skillAssessments)) {
        for (const skill of fb.skillAssessments) {
          if (skill.confidence === "high") allSkillConfidences.high++;
          else if (skill.confidence === "medium") allSkillConfidences.medium++;
          else allSkillConfidences.low++;
        }
      }

      // Question feedback quality
      if (fb?.questionFeedback && Array.isArray(fb.questionFeedback)) {
        totalQuestionsEvaluated += fb.questionFeedback.length;
        for (const qf of fb.questionFeedback) {
          const quality = (qf && typeof qf === "object" && "answerQuality" in qf && typeof qf.answerQuality === "string") ? qf.answerQuality : "no_answer";
          answerQualityDist[quality] = (answerQualityDist[quality] || 0) + 1;
        }
      }

      // Session per day
      if (iv.createdAt) {
        const dayKey = new Date(iv.createdAt).toISOString().split("T")[0];
        if (sessionsPerDay[dayKey] !== undefined) {
          sessionsPerDay[dayKey]++;
        }
      }
    }

    // Compute derived research metrics from DB data
    const meanScore =
      allOverallScores.length > 0
        ? allOverallScores.reduce((a, b) => a + b, 0) / allOverallScores.length
        : null;

    const stdDevScore =
      allOverallScores.length > 1 && meanScore !== null
        ? Math.sqrt(
            allOverallScores.reduce((acc, s) => acc + Math.pow(s - meanScore, 2), 0) /
              (allOverallScores.length - 1),
          )
        : null;

    const medianScore =
      allOverallScores.length > 0
        ? (() => {
            const sorted = [...allOverallScores].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          })()
        : null;

    // Total Gemini API calls across all interviews
    let totalGeminiCalls = 0;
    for (const iv of completedInterviews) {
      totalGeminiCalls += iv.geminiCallsCount || 0;
    }

    // ── Response ──────────────────────────────────────────────────────────

    // Fetch recent candidate snapshots for admin inspection
    const recentSessions = await db
      .select({
        id: interviews.id,
        jobRole: interviews.jobRole,
        status: interviews.status,
        score: interviews.score,
        createdAt: interviews.createdAt,
        candidateSnapshot: interviews.candidateSnapshot,
        feedback: interviews.feedback,
      })
      .from(interviews)
      .orderBy(desc(interviews.createdAt))
      .limit(12);

    const candidateSnapshots = recentSessions.map((s) => ({
      id: s.id,
      jobRole: s.jobRole,
      status: s.status,
      score: s.score,
      createdAt: s.createdAt,
      candidateSnapshot: s.candidateSnapshot,
      candidateName: (s.feedback as { candidateProfile?: { fullName?: string } } | null)?.candidateProfile?.fullName || "Candidate",
    }));

    return NextResponse.json({
      platform: {
        totalInterviews,
        completedInterviews: statusMap["completed"] || 0,
        ongoingInterviews: statusMap["ongoing"] || 0,
        failedInterviews: statusMap["failed"] || 0,
        totalTranscriptChunks,
        totalAuditEvents,
        totalGeminiCalls,
        totalQuestionsEvaluated,
      },
      scoring: {
        averageScore,
        meanScore,
        medianScore,
        stdDevScore,
        averageTurns,
        scoreDistribution,
      },
      hiringRecommendations,
      skillConfidences: allSkillConfidences,
      answerQualityDistribution: answerQualityDist,
      sessionsPerDay,
      candidateSnapshots,
      clientNetwork: {
        clientIp: clientIP,
        allowedIpsConfigured: allowedIPs.length > 0,
        adminUserIdsConfigured: adminIds.length > 0,
        isLocalhost,
      },
      researchMetricsNote:
        "Research-grade metrics (WER, Precision/Recall/F1, MAE, Pearson/Spearman Correlation, QWK, Cohen's Kappa) require human-annotated evaluation data. Run `npm run eval:report` with populated eval-data/ CSVs to compute these. The metrics shown here are derived from " +
        allOverallScores.length +
        " completed AI-evaluated sessions.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[ADMIN_ANALYTICS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics", message: errorMessage },
      { status: 500 },
    );
  }
}
