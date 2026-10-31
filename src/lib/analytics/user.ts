import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { drills, drillSessions, concepts, userConceptMastery } from "@/src/db/schema";

export interface UserAnalyticsSummary {
  totalInterviews: number;
  completedInterviews: number;
  ongoingInterviews: number;
  averageScore: number | null;
  highestScore: number | null;
  totalTurns: number;
  totalQuestionsAnswered: number;
}

export interface UserAnalyticsTrajectoryItem {
  date: string;
  jobRole: string;
  score: number;
  turns: number;
}

export interface SkillGapItem {
  area: string;
  frequency: number;
  suggestedFocus: string;
}

export interface DemonstratedStrengthItem {
  strength: string;
  frequency: number;
}

export interface PracticeRecommendationItem {
  title: string;
  category: string;
  reason: string;
  suggestedAction: string;
}

export interface RecentSessionItem {
  id: string;
  jobRole: string;
  status: string;
  score: number | null;
  createdAt: string;
}

export interface EvaluatedQuestionFeedback {
  question: string;
  focusArea: string;
  answerQuality: "excellent" | "good" | "fair" | "poor" | "no_answer";
  strengths: string[];
  gaps: string[];
  suggestedImprovement?: string;
}

export interface DetailedEvaluationSession {
  id: string;
  jobRole: string;
  overallScore: number;
  hiringRecommendation: "strong_hire" | "hire" | "consider" | "do_not_hire" | "unknown";
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  questionFeedback: EvaluatedQuestionFeedback[];
  skillAssessments: Array<{
    skill: string;
    confidence: "high" | "medium" | "low";
    notes: string;
    demonstrated: boolean;
  }>;
  createdAt: string;
}

export interface DimensionRatings {
  systemDesign: number;
  codeLogic: number;
  edgeCases: number;
  communication: number;
  domainExpertise: number;
}

export interface TopBlindspot {
  area: string;
  frequency: number;
  severity: "critical" | "moderate" | "minor";
  suggestedAction: string;
  recommendedDrill: string;
}

export interface UserAnalyticsData {
  summary: UserAnalyticsSummary;
  trajectory: UserAnalyticsTrajectoryItem[];
  skillConfidences: { high: number; medium: number; low: number };
  skillGaps: SkillGapItem[];
  demonstratedStrengths: DemonstratedStrengthItem[];
  answerQuality: { excellent: number; good: number; fair: number; poor: number };
  practiceRecommendations: PracticeRecommendationItem[];
  recentSessions: RecentSessionItem[];
  // Deep Feedback & Practice Gym Additions:
  recentEvaluations: DetailedEvaluationSession[];
  dimensionRatings: DimensionRatings;
  topBlindspots: TopBlindspot[];
  hiringDistribution: {
    strong_hire: number;
    hire: number;
    consider: number;
    do_not_hire: number;
  };
  gym?: GymAnalyticsData;
};

export interface GymAnalyticsData {
  drillStats: { slug: string; title: string; avgScore: number; attempts: number }[];
  conceptMastery: { conceptId: string; label: string; mastery: number; drillSlug?: string }[];
  scoreTrend: { date: string; score: number; drillSlug: string }[];
  streak: number;
}

export interface NormalizedInterviewFeedback {
  overallScore?: number;
  hiringRecommendation?: string;
  summary?: string;
  strengths?: string[];
  areasForImprovement?: string[];
  questionFeedback?: Array<{
    question?: string;
    focusArea?: string;
    answerQuality?: string;
    strengths?: string[];
    gaps?: string[];
    suggestedImprovement?: string;
  }>;
  skillAssessments?: Array<{
    skill?: string;
    confidence?: string;
    notes?: string;
    demonstrated?: boolean;
  }>;
  [key: string]: unknown;
}

export interface NormalizedInterview {
  id?: string;
  jobRole?: string;
  status?: string;
  currentPhase?: string;
  score?: number | null;
  totalTurns?: number | null;
  createdAt?: string | Date | null;
  feedback?: NormalizedInterviewFeedback | null;
}

export function computeUserAnalytics(interviewsList: Array<unknown>): UserAnalyticsData {
  const safeList = Array.isArray(interviewsList) ? interviewsList : [];
  const normalizedList: NormalizedInterview[] = [];

  for (const item of safeList) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    let fb = raw.feedback;
    if (typeof fb === "string") {
      try {
        fb = JSON.parse(fb);
      } catch {
        fb = null;
      }
    }
    const feedbackObj = fb && typeof fb === "object" ? (fb as NormalizedInterviewFeedback) : null;
    normalizedList.push({
      id: typeof raw.id === "string" ? raw.id : String(raw.id || ""),
      jobRole: typeof raw.jobRole === "string" ? raw.jobRole : undefined,
      status: typeof raw.status === "string" ? raw.status : undefined,
      currentPhase: typeof raw.currentPhase === "string" ? raw.currentPhase : undefined,
      score: typeof raw.score === "number" ? raw.score : null,
      totalTurns: typeof raw.totalTurns === "number" ? raw.totalTurns : null,
      createdAt: (raw.createdAt as string | Date | null) ?? null,
      feedback: feedbackObj,
    });
  }

  const isCompletedSession = (i: NormalizedInterview): boolean =>
    i.status === "completed" ||
    i.currentPhase === "closed" ||
    typeof (i.feedback?.overallScore ?? i.score) === "number";

  // 1. Partition sessions
  const completed = normalizedList.filter(isCompletedSession);
  const ongoing = normalizedList.filter((i) => !isCompletedSession(i));
  // 2. Score calculations
  const validScores: number[] = [];
  for (const item of completed) {
    const scoreCandidate = item?.feedback?.overallScore ?? item?.score;
    if (typeof scoreCandidate === "number" && !isNaN(scoreCandidate) && scoreCandidate >= 0) {
      validScores.push(Math.round(scoreCandidate));
    }
  }

  const averageScore =
    validScores.length > 0
      ? Math.round(validScores.reduce((sum, val) => sum + val, 0) / validScores.length)
      : null;

  const highestScore = validScores.length > 0 ? Math.max(...validScores) : null;

  const totalTurns: number = normalizedList.reduce((acc: number, curr) => {
    const turns = typeof curr?.totalTurns === "number" && !isNaN(curr.totalTurns) ? curr.totalTurns : 0;
    return acc + turns;
  }, 0);

  // 3. Trajectory progression (chronological ascending)
  const trajectoryCandidates = [...completed].filter((i) => {
    const scoreCandidate = i?.feedback?.overallScore ?? i?.score;
    return typeof scoreCandidate === "number" && !isNaN(scoreCandidate);
  });

  trajectoryCandidates.sort((a, b) => {
    const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });

  const trajectory: UserAnalyticsTrajectoryItem[] = trajectoryCandidates.map((i) => {
    const dateFormatted = i?.createdAt
      ? new Date(i.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "Session";

    return {
      date: dateFormatted,
      jobRole: i?.jobRole || "Technical Role",
      score: Math.round(i?.feedback?.overallScore ?? i?.score ?? 0),
      turns: typeof i?.totalTurns === "number" ? i.totalTurns : 0,
    };
  });

  // 4. Competency Diagnostics (Skill Confidences, Quality, Gaps, Strengths)
  const skillConfidences = { high: 0, medium: 0, low: 0 };
  const answerQuality = { excellent: 0, good: 0, fair: 0, poor: 0 };
  let totalQuestionsAnswered = 0;

  const gapCounts = new Map<string, number>();
  const strengthCounts = new Map<string, number>();

  for (const interview of normalizedList) {
    const feedback = interview?.feedback;
    if (!feedback || typeof feedback !== "object") continue;

    // Skill assessments
    if (Array.isArray(feedback.skillAssessments)) {
      for (const sa of feedback.skillAssessments) {
        if (!sa || typeof sa !== "object") continue;
        const conf = String(sa.confidence || "").toLowerCase();
        if (conf === "high") skillConfidences.high++;
        else if (conf === "medium") skillConfidences.medium++;
        else if (conf === "low") skillConfidences.low++;
      }
    }

    // Question feedbacks
    if (Array.isArray(feedback.questionFeedback)) {
      for (const qf of feedback.questionFeedback) {
        if (!qf || typeof qf !== "object") continue;
        totalQuestionsAnswered++;

        const quality = String(qf.answerQuality || "").toLowerCase();
        if (quality === "excellent") answerQuality.excellent++;
        else if (quality === "good") answerQuality.good++;
        else if (quality === "fair") answerQuality.fair++;
        else if (quality === "poor" || quality === "no_answer") answerQuality.poor++;

        if (Array.isArray(qf.gaps)) {
          for (const g of qf.gaps) {
            if (typeof g === "string" && g.trim()) {
              const cleaned = g.trim();
              gapCounts.set(cleaned, (gapCounts.get(cleaned) || 0) + 1);
            }
          }
        }

        if (Array.isArray(qf.strengths)) {
          for (const s of qf.strengths) {
            if (typeof s === "string" && s.trim()) {
              const cleaned = s.trim();
              strengthCounts.set(cleaned, (strengthCounts.get(cleaned) || 0) + 1);
            }
          }
        }
      }
    }

    // High level feedback areasForImprovement & strengths
    if (Array.isArray(feedback.areasForImprovement)) {
      for (const area of feedback.areasForImprovement) {
        if (typeof area === "string" && area.trim()) {
          const cleaned = area.trim();
          gapCounts.set(cleaned, (gapCounts.get(cleaned) || 0) + 1);
        }
      }
    }

    if (Array.isArray(feedback.strengths)) {
      for (const str of feedback.strengths) {
        if (typeof str === "string" && str.trim()) {
          const cleaned = str.trim();
          strengthCounts.set(cleaned, (strengthCounts.get(cleaned) || 0) + 1);
        }
      }
    }
  }

  // Format gaps
  const sortedGaps = Array.from(gapCounts.entries()).sort((a, b) => b[1] - a[1]);
  const skillGaps: SkillGapItem[] = sortedGaps.slice(0, 6).map(([area, frequency]) => ({
    area,
    frequency,
    suggestedFocus: `Refine edge cases, concrete implementation mechanics, and architectural trade-offs around ${area.toLowerCase()}.`,
  }));

  // Format strengths
  const sortedStrengths = Array.from(strengthCounts.entries()).sort((a, b) => b[1] - a[1]);
  const demonstratedStrengths: DemonstratedStrengthItem[] = sortedStrengths
    .slice(0, 6)
    .map(([strength, frequency]) => ({
      strength,
      frequency,
    }));

  // 5. Practice Recommendations
  const practiceRecommendations: PracticeRecommendationItem[] = [];

  // Targeted gap-based recommendations
  for (let i = 0; i < Math.min(skillGaps.length, 3); i++) {
    const gap = skillGaps[i];
    practiceRecommendations.push({
      title: `Mastery Drill: ${gap.area}`,
      category: i === 0 ? "Priority Growth" : "Targeted Practice",
      reason: `Flagged as a growth opportunity across ${gap.frequency} evaluation ${
        gap.frequency === 1 ? "checkpoint" : "checkpoints"
      }.`,
      suggestedAction: `Practice explaining failure modes, performance trade-offs, and design alternatives for ${gap.area}.`,
    });
  }

  // Baseline fallbacks if fewer than 3 recommendations
  const baselineRecommendations: PracticeRecommendationItem[] = [
    {
      title: "System Design Trade-off Articulation",
      category: "Architecture",
      reason: "High-impact differentiator across senior and staff technical rounds.",
      suggestedAction:
        "Proactively compare latency vs throughput, consistency models, and caching strategies before proposing architectures.",
    },
    {
      title: "Defensive Coding & Boundary Validation",
      category: "Robustness",
      reason: "Essential for demonstrating production engineering maturity.",
      suggestedAction:
        "Explicitly discuss null states, concurrency race conditions, and exponential backoff retry strategies.",
    },
    {
      title: "Structured Behavioral Communication (STAR)",
      category: "Leadership",
      reason: "Translates technical execution into quantifiable business outcomes.",
      suggestedAction:
        "Frame leadership and cross-functional conflict scenarios with concrete metrics and verifiable resolution steps.",
    },
  ];

  for (const baseline of baselineRecommendations) {
    if (practiceRecommendations.length >= 3) break;
    practiceRecommendations.push(baseline);
  }

  // 6. Recent sessions
  const sortedByRecent = [...normalizedList].sort((a, b) => {
    const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const recentSessions: RecentSessionItem[] = sortedByRecent.slice(0, 10).map((i) => {
    const scoreCandidate = i?.feedback?.overallScore ?? i?.score;
    const validScore =
      typeof scoreCandidate === "number" && !isNaN(scoreCandidate)
        ? Math.round(scoreCandidate)
        : null;

    return {
      id: String(i?.id || ""),
      jobRole: String(i?.jobRole || "Software Engineer"),
      status: String(i?.status || "ongoing"),
      score: validScore,
      createdAt: i?.createdAt ? new Date(i.createdAt).toISOString() : new Date().toISOString(),
    };
  });

  // 7. Recent Detailed Evaluations
  const recentEvaluations: DetailedEvaluationSession[] = [];
  const hiringDistribution = {
    strong_hire: 0,
    hire: 0,
    consider: 0,
    do_not_hire: 0,
  };

  for (const interview of sortedByRecent) {
    if (isCompletedSession(interview) && interview?.feedback) {
      const fb = interview.feedback;
      const rec = (fb.hiringRecommendation || "unknown").toLowerCase();
      if (rec === "strong_hire") hiringDistribution.strong_hire++;
      else if (rec === "hire") hiringDistribution.hire++;
      else if (rec === "consider") hiringDistribution.consider++;
      else if (rec === "do_not_hire") hiringDistribution.do_not_hire++;

      if (recentEvaluations.length < 5) {
        recentEvaluations.push({
          id: String(interview.id || ""),
          jobRole: String(interview.jobRole || "Technical Role"),
          overallScore: Math.round(fb.overallScore ?? interview.score ?? 0),
          hiringRecommendation: (fb.hiringRecommendation as DetailedEvaluationSession["hiringRecommendation"]) || "consider",
          summary: String(fb.summary || ""),
          strengths: Array.isArray(fb.strengths) ? fb.strengths : [],
          areasForImprovement: Array.isArray(fb.areasForImprovement) ? fb.areasForImprovement : [],
          questionFeedback: (Array.isArray(fb.questionFeedback) ? fb.questionFeedback : []) as EvaluatedQuestionFeedback[],
          skillAssessments: (Array.isArray(fb.skillAssessments) ? fb.skillAssessments : []) as DetailedEvaluationSession["skillAssessments"],
          createdAt: interview.createdAt ? new Date(interview.createdAt).toISOString() : new Date().toISOString(),
        });
      }
    }
  }

  // 8. 5-Dimensional Competency Ratings
  let dimensionRatings: DimensionRatings = {
    systemDesign: 0,
    codeLogic: 0,
    edgeCases: 0,
    communication: 0,
    domainExpertise: 0,
  };

  if (averageScore !== null && averageScore > 0) {
    const totalQ = totalQuestionsAnswered || 1;
    const qualityWeight = (answerQuality.excellent * 1.0 + answerQuality.good * 0.8 + answerQuality.fair * 0.5) / totalQ;
    const qualityScale = Math.max(0.6, Math.min(1.1, qualityWeight + 0.2));

    dimensionRatings = {
      systemDesign: Math.min(100, Math.round(averageScore * 0.94 * qualityScale)),
      codeLogic: Math.min(100, Math.round(averageScore * 0.98 * qualityScale)),
      edgeCases: Math.max(25, Math.min(100, Math.round(averageScore * 0.86 * (answerQuality.poor > 1 ? 0.85 : 1.0)))),
      communication: Math.min(100, Math.round(averageScore * 0.96 * qualityScale)),
      domainExpertise: Math.min(100, Math.round(averageScore * (skillConfidences.high >= 2 ? 1.05 : 0.92))),
    };
  }

  // 9. Top Blindspots with Target Drill Mapping
  const topBlindspots: TopBlindspot[] = sortedGaps.slice(0, 5).map(([area, frequency]) => {
    const lower = area.toLowerCase();
    let recommendedDrill = "rapid-screen";

    if (lower.includes("design") || lower.includes("scale") || lower.includes("architect") || lower.includes("cache") || lower.includes("system")) {
      recommendedDrill = "system-design";
    } else if (lower.includes("algo") || lower.includes("complexity") || lower.includes("tree") || lower.includes("array") || lower.includes("sort")) {
      recommendedDrill = "algo-logic";
    } else if (lower.includes("star") || lower.includes("behavior") || lower.includes("conflict") || lower.includes("team") || lower.includes("lead")) {
      recommendedDrill = "behavioral-star";
    } else if (lower.includes("react") || lower.includes("frontend") || lower.includes("dom") || lower.includes("render") || lower.includes("css")) {
      recommendedDrill = "frontend-arch";
    } else if (lower.includes("database") || lower.includes("postgres") || lower.includes("sql") || lower.includes("index") || lower.includes("concurren") || lower.includes("lock")) {
      recommendedDrill = "database-concurrency";
    }
    return {
      area,
      frequency,
      severity: frequency >= 2 ? "critical" : "moderate",
      suggestedAction: `Drill failure modes, edge cases, and architectural justification for ${area.toLowerCase()}.`,
      recommendedDrill,
    };
  });

  return {
    summary: {
      totalInterviews: safeList.length,
      completedInterviews: completed.length,
      ongoingInterviews: ongoing.length,
      averageScore,
      highestScore,
      totalTurns,
      totalQuestionsAnswered,
    },
    trajectory,
    skillConfidences,
    skillGaps,
    demonstratedStrengths,
    answerQuality,
    practiceRecommendations,
    recentSessions,
    recentEvaluations,
    dimensionRatings,
    topBlindspots,
    hiringDistribution,
  };
}

export async function computeGymAnalytics(userId: string): Promise<GymAnalyticsData> {
  try {
    const allDrills = await db.select({ id: drills.id, slug: drills.slug, title: drills.title }).from(drills);
    const sessionStats = await db
      .select({
        drillId: drillSessions.drillId,
        attempts: sql<number>`count(*) FILTER (WHERE ${drillSessions.status} = 'completed')`,
        avgScore: sql<number | null>`avg(${drillSessions.score}) FILTER (WHERE ${drillSessions.status} = 'completed')`,
      })
      .from(drillSessions)
      .where(eq(drillSessions.userId, userId))
      .groupBy(drillSessions.drillId);

    const statsMap = new Map<string, { attempts: number; avgScore: number }>();
    for (const s of sessionStats) {
      statsMap.set(s.drillId, {
        attempts: Number(s.attempts) || 0,
        avgScore: s.avgScore !== null ? Math.round(Number(s.avgScore)) : 0,
      });
    }

    const drillStats = allDrills.map((d) => ({
      slug: d.slug,
      title: d.title,
      attempts: statsMap.get(d.id)?.attempts ?? 0,
      avgScore: statsMap.get(d.id)?.avgScore ?? 0,
    }));

    const masteryRows = await db
      .select({
        conceptId: userConceptMastery.conceptId,
        label: concepts.label,
        mastery: userConceptMastery.mastery,
        drillSlug: drills.slug,
      })
      .from(userConceptMastery)
      .innerJoin(concepts, eq(concepts.id, userConceptMastery.conceptId))
      .innerJoin(drills, eq(drills.id, concepts.drillId))
      .where(and(eq(userConceptMastery.userId, userId), sql`${userConceptMastery.mastery} > 0`))
      .orderBy(userConceptMastery.mastery);

    const conceptMastery = masteryRows.map((m) => ({
      conceptId: m.conceptId,
      label: m.label,
      mastery: Math.round(Number(m.mastery) * 100) / 100,
      drillSlug: m.drillSlug,
    }));
    const trendRows = await db
      .select({
        date: drillSessions.finishedAt,
        score: drillSessions.score,
        drillSlug: drills.slug,
      })
      .from(drillSessions)
      .innerJoin(drills, eq(drills.id, drillSessions.drillId))
      .where(and(eq(drillSessions.userId, userId), eq(drillSessions.status, "completed"), sql`${drillSessions.score} IS NOT NULL`))
      .orderBy(drillSessions.finishedAt)
      .limit(30);

    const scoreTrend = trendRows.map((t) => ({
      date: t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
      score: t.score ?? 0,
      drillSlug: t.drillSlug,
    }));

    const dayRows = await db
      .select({
        day: sql<string>`DISTINCT TO_CHAR(${drillSessions.finishedAt}, 'YYYY-MM-DD')`,
      })
      .from(drillSessions)
      .where(and(eq(drillSessions.userId, userId), eq(drillSessions.status, "completed"), sql`${drillSessions.finishedAt} IS NOT NULL`))
      .orderBy(sql`1 DESC`);

    const days = new Set(dayRows.map((r) => r.day));
    let streak = 0;
    const checkDate = new Date();
    const toDateStr = (d: Date) => d.toISOString().split("T")[0];

    let currentDayStr = toDateStr(checkDate);
    if (!days.has(currentDayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
      currentDayStr = toDateStr(checkDate);
    }

    while (days.has(currentDayStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      currentDayStr = toDateStr(checkDate);
    }

    return {
      drillStats,
      conceptMastery,
      scoreTrend,
      streak,
    };
  } catch (err) {
    console.error("[COMPUTE_GYM_ANALYTICS_ERROR]", err);
    return {
      drillStats: [],
      conceptMastery: [],
      scoreTrend: [],
      streak: 0,
    };
  }
}
