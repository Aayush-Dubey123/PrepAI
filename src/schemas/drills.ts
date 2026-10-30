import { z } from "zod";

// --- Question Payload Schemas ---

export const McqPayloadSchema = z.object({
  type: z.literal("mcq"),
  stem: z.string().min(1),
  options: z.array(z.object({ key: z.string(), text: z.string() })).min(2).max(6),
  correct_key: z.string(),
});

export const MultiSelectPayloadSchema = z.object({
  type: z.literal("multi_select"),
  stem: z.string().min(1),
  options: z.array(z.object({ key: z.string(), text: z.string() })).min(3).max(8),
  correct_keys: z.array(z.string()).min(1),
});

export const ShortAnswerPayloadSchema = z.object({
  type: z.literal("short_answer"),
  stem: z.string().min(1),
  max_words: z.number().int().min(10).max(500).default(200),
});

export const ScenarioPayloadSchema = z.object({
  type: z.literal("scenario"),
  stem: z.string().min(1),
  context: z.string().min(1),
  max_words: z.number().int().default(500),
});

export const CodeTracePayloadSchema = z.object({
  type: z.literal("code_trace"),
  stem: z.string().min(1),
  code: z.string().min(1),
  language: z.string().default("javascript"),
  expected_output: z.string().min(1),
});

export const FixTheBugPayloadSchema = z.object({
  type: z.literal("fix_the_bug"),
  stem: z.string().min(1),
  buggy_code: z.string().min(1),
  language: z.string().default("javascript"),
  correct_code: z.string().min(1),
  hint: z.string().optional(),
});

export const StarPromptPayloadSchema = z.object({
  type: z.literal("star_prompt"),
  stem: z.string().min(1),
  situation_hint: z.string().optional(),
});

export const VoiceAnswerPayloadSchema = z.object({
  type: z.literal("voice_answer"),
  stem: z.string().min(1),
  max_duration_seconds: z.number().int().default(120),
});

export const QuestionPayloadSchema = z.discriminatedUnion("type", [
  McqPayloadSchema,
  MultiSelectPayloadSchema,
  ShortAnswerPayloadSchema,
  ScenarioPayloadSchema,
  CodeTracePayloadSchema,
  FixTheBugPayloadSchema,
  StarPromptPayloadSchema,
  VoiceAnswerPayloadSchema,
]);

// --- Client-Safe Question Payload Schemas ---

export const ClientMcqPayloadSchema = McqPayloadSchema.omit({ correct_key: true });
export const ClientMultiSelectPayloadSchema = MultiSelectPayloadSchema.omit({ correct_keys: true });
export const ClientCodeTracePayloadSchema = CodeTracePayloadSchema.omit({ expected_output: true });
export const ClientFixTheBugPayloadSchema = FixTheBugPayloadSchema.omit({ correct_code: true });

export const ClientQuestionPayloadSchema = z.discriminatedUnion("type", [
  ClientMcqPayloadSchema,
  ClientMultiSelectPayloadSchema,
  ShortAnswerPayloadSchema,
  ScenarioPayloadSchema,
  ClientCodeTracePayloadSchema,
  ClientFixTheBugPayloadSchema,
  StarPromptPayloadSchema,
  VoiceAnswerPayloadSchema,
]);

// --- Rubric & Grading Schemas ---

export const RubricCriterionSchema = z.object({
  name: z.string(),
  weight: z.number().min(0).max(1),
  description: z.string(),
});

export const RubricSchema = z.object({
  criteria: z.array(RubricCriterionSchema),
  passing_threshold: z.number().min(0).max(1).default(0.6),
});

export const CriterionGradeSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(1),
  feedback: z.string(),
});

export const GradingResultSchema = z.object({
  per_criterion: z.array(CriterionGradeSchema),
  overall_score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
});

// --- API Request/Response Schemas ---

export const DrillSessionCreateSchema = z.object({
  level: z.enum(["foundational", "mid", "senior", "staff"]),
  mode: z.enum(["practice", "timed", "voice"]),
  practiceSetId: z.string().uuid().optional(),
  isSmartSet: z.boolean().default(false),
  targetConceptId: z.string().uuid().optional(),
  clientRequestId: z.string().max(128).optional(),
});

export const SubmitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.unknown(),
  timeTakenMs: z.number().int().min(0).optional(),
  clientRequestId: z.string().max(128).optional(),
});

export const SelfAssessmentSchema = z.object({
  questionId: z.string().uuid(),
  selfRating: z.number().int().min(1).max(5),
});

export const ReportQuestionSchema = z.object({
  questionId: z.string().uuid(),
  reason: z.enum(["incorrect_answer", "ambiguous_question", "wrong_category", "other"]),
  details: z.string().max(500).optional(),
});

// --- Type Exports ---

export type McqPayload = z.infer<typeof McqPayloadSchema>;
export type MultiSelectPayload = z.infer<typeof MultiSelectPayloadSchema>;
export type ShortAnswerPayload = z.infer<typeof ShortAnswerPayloadSchema>;
export type ScenarioPayload = z.infer<typeof ScenarioPayloadSchema>;
export type CodeTracePayload = z.infer<typeof CodeTracePayloadSchema>;
export type FixTheBugPayload = z.infer<typeof FixTheBugPayloadSchema>;
export type StarPromptPayload = z.infer<typeof StarPromptPayloadSchema>;
export type VoiceAnswerPayload = z.infer<typeof VoiceAnswerPayloadSchema>;
export type QuestionPayload = z.infer<typeof QuestionPayloadSchema>;
export type ClientQuestionPayload = z.infer<typeof ClientQuestionPayloadSchema>;

export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type CriterionGrade = z.infer<typeof CriterionGradeSchema>;
export type GradingResult = z.infer<typeof GradingResultSchema>;

export type DrillSessionCreateInput = z.infer<typeof DrillSessionCreateSchema>;
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;
export type SelfAssessmentInput = z.infer<typeof SelfAssessmentSchema>;
export type ReportQuestionInput = z.infer<typeof ReportQuestionSchema>;
