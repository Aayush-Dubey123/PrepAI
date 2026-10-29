import { NextRequest, NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { db } from "@/src/db/index";
import { auditEvents } from "@/src/db/schema";

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

    return NextResponse.json({
      success: true,
      purgedCount: deleted.length,
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
