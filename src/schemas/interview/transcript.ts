import { z } from "zod";

export const AppendTranscriptSchema = z.object({
  /** Client-generated chunk id. Retrying with the same id never creates a duplicate row. */
  id: z.string().uuid().optional(),
  interviewId: z.string().uuid(),
  content: z.string().min(1).max(8000),
  speaker: z.enum(["user", "ai"]),
});

export type AppendTranscriptInput = z.infer<typeof AppendTranscriptSchema>;
