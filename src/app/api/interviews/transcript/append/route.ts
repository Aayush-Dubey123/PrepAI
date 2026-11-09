/**
 * Transcript append route.
 *
 * Changes:
 * - Embedding computation moved to after() — never blocks the response.
 * - Missing GEMINI_API_KEY no longer returns 500; chunk is inserted without embedding.
 * - Returns JSON on every error path.
 */

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { after } from "next/server";
import { db } from "@/src/db/index";
import { interviews, transcriptChunks } from "@/src/db/schema";
import { embedTextCached } from "@/src/lib/ai/embedding-cache";
import { AppendTranscriptSchema } from "@/src/schemas/interview/transcript";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const body = AppendTranscriptSchema.parse(await request.json());

    const [interview] = await db
      .select({ id: interviews.id })
      .from(interviews)
      .where(
        and(eq(interviews.id, body.interviewId), eq(interviews.userId, userId)),
      )
      .limit(1);

    if (!interview) {
      return Response.json({ error: "Interview not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // Insert chunk WITHOUT embedding — fast path for the live turn.
    // Idempotent on the client-supplied id: a retry returns the existing row instead of
    // inserting a duplicate answer.
    const [inserted] = await db
      .insert(transcriptChunks)
      .values({
        ...(body.id ? { id: body.id } : {}),
        interviewId: body.interviewId,
        content: body.content,
        speaker: body.speaker,
        // embedding will be backfilled asynchronously below
      })
      .onConflictDoNothing({ target: transcriptChunks.id })
      .returning();

    const chunk = inserted;
    if (!chunk && body.id) {
      const [existing] = await db
        .select()
        .from(transcriptChunks)
        .where(and(eq(transcriptChunks.id, body.id), eq(transcriptChunks.interviewId, body.interviewId)))
        .limit(1);
      if (!existing) {
        return Response.json({ error: "Chunk id conflict", code: "CONFLICT" }, { status: 409 });
      }
      // Already saved by an earlier attempt; the embedding job was scheduled then.
      return Response.json(existing);
    }
    if (!chunk) {
      throw new Error("Transcript insert returned no row");
    }
    const savedChunk = chunk;

    // Fire-and-forget: compute embedding and update the row after response is sent
    after(async () => {
      try {
        // Shared with /turn's memory lookup: the same answer text is embedded only once.
        const values = await embedTextCached(body.content);
        await db
          .update(transcriptChunks)
          .set({ embedding: values })
          .where(eq(transcriptChunks.id, savedChunk.id));
      } catch (embErr) {
        // Log but never surface — RAG will simply skip un-embedded chunks
        console.error(
          `[TRANSCRIPT] Embedding failed for chunk ${savedChunk.id}:`,
          embErr instanceof Error ? embErr.message : embErr,
        );
      }
    });

    return Response.json(savedChunk);
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Invalid transcript payload", code: "VALIDATION_ERROR", details: error.flatten() },
        { status: 422 },
      );
    }

    console.error("[TRANSCRIPT APPEND] Error:", error);
    return Response.json(
      {
        error: "Failed to save transcript",
        code: "INTERNAL_ERROR",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
