import { NextRequest, NextResponse } from "next/server";
import { logEvalLatency, LatencyEvent, isResearchMode } from "@/src/eval/analytics/logger";

export async function POST(req: NextRequest) {
  if (!isResearchMode()) {
    return NextResponse.json({ skipped: true, reason: "RESEARCH_MODE is off" });
  }

  try {
    const body = (await req.json()) as LatencyEvent;
    if (!body.interviewId || !body.stage || !body.ts) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    logEvalLatency(body);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to log latency";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
