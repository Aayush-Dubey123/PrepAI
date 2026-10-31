import { NextRequest, NextResponse } from "next/server";
import { lt, and, eq, sql } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { db } from "@/src/db/index";
import { auditEvents, drillSessions, masteryRetryQueue } from "@/src/db/schema";
import { updateConceptMastery } from "@/src/lib/drills/progression/mastery";

function safeCompare(provided: string, expected: string): boolean {
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  return handlePurge(req);
}

export async function GET(req: NextRequest) {
  return handlePurge(req);
}

async function handlePurge(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured on the server" }, { status: 500 });
    }

    const rawHeader = req.headers.get("x-cron-secret") || req.headers.get("authorization") || "";
    const cleanToken = rawHeader.startsWith("Bearer ") ? rawHeader.slice(7).trim() : rawHeader.trim();
    const isAuthorized = safeCompare(cleanToken, cronSecret);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const NinetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const deleted = await db
      .delete(auditEvents)
      .where(lt(auditEvents.createdAt, NinetyDaysAgo))
      .returning({ id: auditEvents.id });

    console.log(`[PURGE-AUDIT] Successfully purged ${deleted.length} audit events older than 90 days.`);

    // Clean up stale active drill sessions older than 24 hours -> mark as abandoned
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const abandonedSessions = await db
      .update(drillSessions)
      .set({ status: "abandoned", finishedAt: new Date() })
      .where(
        and(
          eq(drillSessions.status, "active"),
          lt(drillSessions.startedAt, twentyFourHoursAgo),
        ),
      )
      .returning({ id: drillSessions.id });
    console.log(`[PURGE-AUDIT] Marked ${abandonedSessions.length} stale drill sessions as abandoned.`);

    // Step A: Reconcile unrecorded answers within last 24h
    const unrecordedAnswers = await db.execute(sql`
      SELECT sa.id as answer_id, ds.user_id, q.concept_ids, sa.score
      FROM session_answers sa
      JOIN drill_sessions ds ON ds.id = sa.session_id
      JOIN questions q ON q.id = sa.question_id
      WHERE sa.grading_method IN ('deterministic', 'llm')
        AND (sa.confidence IS NULL OR sa.confidence >= 0.5)
        AND sa.score IS NOT NULL
        AND sa.created_at > now() - interval '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM user_concept_mastery_log ml
          WHERE ml.answer_id = sa.id
        )
      LIMIT 100
    `);

    let reconciledCount = 0;
    interface UnrecordedRow {
      answer_id: string;
      user_id: string;
      concept_ids: string[];
      score: number;
    }
    for (const rawRow of unrecordedAnswers.rows) {
      const row = rawRow as unknown as UnrecordedRow;
      try {
        await updateConceptMastery(row.user_id, row.concept_ids, row.answer_id, Number(row.score));
        reconciledCount++;
      } catch (err) {
        console.error(`[CRON_MASTERY_RECONCILE_ERROR] answerId=${row.answer_id}`, err);
      }
    }

    // Step B: Process mastery retry queue
    const pendingRetries = await db
      .select()
      .from(masteryRetryQueue)
      .where(
        and(
          sql`${masteryRetryQueue.nextRetryAt} <= now()`,
          sql`${masteryRetryQueue.attempts} < 5`,
        ),
      )
      .limit(50);

    let retrySuccessCount = 0;
    for (const retry of pendingRetries) {
      try {
        await updateConceptMastery(retry.userId, retry.conceptIds, retry.answerId, retry.score);
        await db.delete(masteryRetryQueue).where(eq(masteryRetryQueue.id, retry.id));
        retrySuccessCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await db
          .update(masteryRetryQueue)
          .set({
            attempts: sql`${masteryRetryQueue.attempts} + 1`,
            nextRetryAt: sql`now() + (interval '5 minutes' * ${masteryRetryQueue.attempts})`,
            lastError: msg,
          })
          .where(eq(masteryRetryQueue.id, retry.id));
      }
    }

    return NextResponse.json({
      success: true,
      purgedCount: deleted.length,
      abandonedSessionsCount: abandonedSessions.length,
      reconciledMasteryCount: reconciledCount,
      retriedMasteryCount: retrySuccessCount,
      cutoffDate: NinetyDaysAgo.toISOString(),
    });
  } catch (error) {
    console.error("[PURGE-AUDIT] Error during audit log purge:", error);
    return NextResponse.json(
      { error: "Failed to purge audit events", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
