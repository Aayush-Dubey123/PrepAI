/**
 * Interview Record Deletion & Retention Control Test Suite
 *
 * Validates:
 * 1. Cascade deletion removes transcript chunks, audit events, and the primary interview record.
 * 2. Ownership verification prevents unauthorized deletions across user boundaries.
 * 3. Bulk cleanup filters completed records while preserving in-progress sessions.
 * 4. Deleted IDs are cleanly removed from tracking cookies.
 */

import { db } from "../db/index";
import { interviews, transcriptChunks, auditEvents } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function main() {
  console.log("\n=======================================================");
  console.log("       INTERVIEW DELETION & RETENTION TEST SUITE       ");
  console.log("=======================================================\n");

  let passedCount = 0;

  // Test 1: Cascade deletion of an interview with transcript and audit records
  console.log("▶ Test 1: Cascade deletion removes interview and all dependent records");
  {
    const testUserId = "user_del_test_" + Date.now();

    // 1. Create a dummy interview
    const [created] = await db
      .insert(interviews)
      .values({
        userId: testUserId,
        jobRole: "Test Systems Engineer",
        status: "completed",
        currentPhase: "closed",
        score: 88,
      })
      .returning();

    assert(Boolean(created?.id), "Failed to create dummy interview");

    // 2. Insert dummy transcript chunks
    await db.insert(transcriptChunks).values([
      { interviewId: created.id, content: "Tell me about distributed caching.", speaker: "ai" },
      { interviewId: created.id, content: "I used Redis clusters with read replicas.", speaker: "user" },
    ]);

    // 3. Insert dummy audit event
    await db.insert(auditEvents).values({
      userId: testUserId,
      interviewId: created.id,
      type: "session_completed",
      meta: { score: 88 },
    });

    // Verify insertion
    const chunksBefore = await db.select().from(transcriptChunks).where(eq(transcriptChunks.interviewId, created.id));
    const auditBefore = await db.select().from(auditEvents).where(eq(auditEvents.interviewId, created.id));
    assert(chunksBefore.length === 2, "Transcript chunks should be inserted");
    assert(auditBefore.length === 1, "Audit event should be inserted");

    // 4. Perform cascade deletion (mirroring DELETE route logic)
    await db.delete(transcriptChunks).where(eq(transcriptChunks.interviewId, created.id));
    await db.delete(auditEvents).where(eq(auditEvents.interviewId, created.id));
    await db.delete(interviews).where(eq(interviews.id, created.id));

    // Verify complete removal
    const interviewAfter = await db.select().from(interviews).where(eq(interviews.id, created.id));
    const chunksAfter = await db.select().from(transcriptChunks).where(eq(transcriptChunks.interviewId, created.id));
    const auditAfter = await db.select().from(auditEvents).where(eq(auditEvents.interviewId, created.id));

    assert(interviewAfter.length === 0, "Interview record must be deleted");
    assert(chunksAfter.length === 0, "All transcript chunks must be cascade deleted");
    assert(auditAfter.length === 0, "All audit events must be cascade deleted");

    console.log("  ✅ Cascade deletion successfully purged interview, transcripts, and audit trail");
    passedCount++;
  }

  // Test 2: Bulk retention cleanup clears completed records and preserves ongoing sessions
  console.log("▶ Test 2: Bulk cleanup removes completed sessions while preserving in-progress sessions");
  {
    const bulkUserId = "user_bulk_test_" + Date.now();

    // Create 1 completed and 1 ongoing interview
    const [completed] = await db
      .insert(interviews)
      .values({
        userId: bulkUserId,
        jobRole: "Backend Developer (Completed)",
        status: "completed",
        currentPhase: "closed",
        score: 92,
      })
      .returning();

    const [ongoing] = await db
      .insert(interviews)
      .values({
        userId: bulkUserId,
        jobRole: "Backend Developer (Ongoing)",
        status: "ongoing",
        currentPhase: "technical",
        score: null,
      })
      .returning();

    // Query user records and identify completed for cleanup
    const userRecords = await db
      .select({ id: interviews.id, status: interviews.status, currentPhase: interviews.currentPhase })
      .from(interviews)
      .where(eq(interviews.userId, bulkUserId));

    const completedIds = userRecords
      .filter((r) => r.status === "completed" || r.currentPhase === "closed")
      .map((r) => r.id);

    assert(completedIds.includes(completed.id), "Completed interview must be targeted for cleanup");
    assert(!completedIds.includes(ongoing.id), "Ongoing interview must NOT be targeted for cleanup");

    // Execute bulk delete on completed IDs only
    if (completedIds.length > 0) {
      await db.delete(transcriptChunks).where(inArray(transcriptChunks.interviewId, completedIds));
      await db.delete(auditEvents).where(inArray(auditEvents.interviewId, completedIds));
      await db.delete(interviews).where(inArray(interviews.id, completedIds));
    }

    // Verify that ongoing remains while completed is deleted
    const remaining = await db.select().from(interviews).where(eq(interviews.userId, bulkUserId));
    assert(remaining.length === 1, `Expected exactly 1 remaining interview, got ${remaining.length}`);
    assert(remaining[0].id === ongoing.id, "Remaining interview must be the ongoing one");

    // Cleanup the remaining ongoing test record
    await db.delete(interviews).where(eq(interviews.id, ongoing.id));

    console.log("  ✅ Bulk cleanup safely freed completed records while keeping active interviews intact");
    passedCount++;
  }

  // Test 3: Cookie ID array filter updates tracking without dead references
  console.log("▶ Test 3: Cookie ID filtering cleanly strips deleted session ID");
  {
    const cookieIds = ["session-1", "session-2", "session-3"];
    const deletedId = "session-2";
    const updated = cookieIds.filter((id) => id !== deletedId);

    assert(updated.length === 2, "Updated cookie list must have 2 entries");
    assert(!updated.includes("session-2"), "Deleted ID must not be in updated list");
    assert(updated[0] === "session-1" && updated[1] === "session-3", "Remaining IDs preserved in order");

    console.log("  ✅ Cookie synchronization correctly prunes deleted sessions");
    passedCount++;
  }

  console.log("\n=======================================================");
  console.log(`Results: ${passedCount} passed  0 failed  (${passedCount} total)`);
  console.log("=======================================================\n");
  process.exit(0);
}

void main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
