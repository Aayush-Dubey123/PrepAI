import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  index,
  uniqueIndex,
  boolean,
  real,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { vector768 } from "./vector";

export const statusEnum = pgEnum("interview_status", [
  "ongoing",
  "completed",
  "failed",
]);

export const phaseEnum = pgEnum("interview_phase", [
  "greeting",
  "rapport",
  "technical",
  "wrapup",
  "closed",
]);

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    fullName: text("full_name").notNull(),
    rawText: text("raw_text").notNull(),
    structuredData: jsonb("structured_data").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("resumes_user_id_idx").on(table.userId)],
);

export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    resumeId: uuid("resume_id").references(() => resumes.id, {
      onDelete: "set null",
    }),
    jobRole: text("job_role").notNull(),
    jobDescription: text("job_description"),
    status: statusEnum("status").default("ongoing"),
    currentPhase: phaseEnum("current_phase").default("greeting"),
    score: integer("score"),
    feedback: jsonb("feedback"),
    createdAt: timestamp("created_at").defaultNow(),
    // Cost and runaway control tracking
    geminiCallsCount: integer("gemini_calls_count").default(0),
    totalTurns: integer("total_turns").default(0),
    adaptiveDecisionsCount: integer("adaptive_decisions_count").default(0),
    // Server-owned conversation state (brain) — replaces client-driven phase/turn tracking
    plan: jsonb("plan"),
    // Candidate screenshot taken during interview
    candidateSnapshot: text("candidate_snapshot"),
  },
  (table) => [index("interviews_resume_id_idx").on(table.resumeId)],
);

export const transcriptChunks = pgTable(
  "transcript_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    speaker: text("speaker", { enum: ["user", "ai"] }).notNull(),
    embedding: vector768("embedding"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("transcript_chunks_interview_id_idx").on(table.interviewId),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    interviewId: uuid("interview_id").references(() => interviews.id, {
      onDelete: "cascade",
    }),
    clerkSessionId: text("clerk_session_id"),
    type: text("type").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_events_user_created_idx").on(table.userId, table.createdAt),
    index("audit_events_interview_id_idx").on(table.interviewId),
  ],
);

export const questionTypeEnum = pgEnum("question_type", [
  "mcq",
  "multi_select",
  "short_answer",
  "scenario",
  "code_trace",
  "fix_the_bug",
  "star_prompt",
  "voice_answer",
]);

export const difficultyLevelEnum = pgEnum("difficulty_level", [
  "foundational",
  "mid",
  "senior",
  "staff",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "draft",
  "approved",
]);

export const drillSessionStatusEnum = pgEnum("drill_session_status", [
  "active",
  "completed",
  "abandoned",
]);

export const drills = pgTable(
  "drills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    defaultDifficulty: difficultyLevelEnum("default_difficulty").notNull(),
    timeLimitSeconds: integer("time_limit_seconds").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("drills_slug_idx").on(table.slug),
  ],
);

export const concepts = pgTable(
  "concepts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    drillId: uuid("drill_id")
      .notNull()
      .references(() => drills.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => concepts.id, {
      onDelete: "cascade",
    }),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("concepts_drill_slug_idx").on(table.drillId, table.slug),
    index("concepts_parent_idx").on(table.parentId),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    drillId: uuid("drill_id")
      .notNull()
      .references(() => drills.id, { onDelete: "cascade" }),
    conceptIds: uuid("concept_ids").array().notNull(),
    type: questionTypeEnum("type").notNull(),
    level: difficultyLevelEnum("level").notNull(),
    payload: jsonb("payload").notNull(),
    rubric: jsonb("rubric").notNull(),
    modelAnswer: text("model_answer").notNull(),
    explanation: text("explanation").notNull(),
    reviewStatus: reviewStatusEnum("review_status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("questions_drill_status_idx").on(table.drillId, table.reviewStatus),
    uniqueIndex("questions_slug_version_idx").on(table.slug, table.version),
  ],
);

export const practiceSets = pgTable(
  "practice_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    drillId: uuid("drill_id")
      .notNull()
      .references(() => drills.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    level: difficultyLevelEnum("level").notNull(),
    questionIds: uuid("question_ids").array().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("practice_sets_drill_level_idx").on(table.drillId, table.level),
    uniqueIndex("practice_sets_slug_idx").on(table.slug),
  ],
);

export const drillSessions = pgTable(
  "drill_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    drillId: uuid("drill_id")
      .notNull()
      .references(() => drills.id, { onDelete: "cascade" }),
    practiceSetId: uuid("practice_set_id").references(() => practiceSets.id, {
      onDelete: "set null",
    }),
    status: drillSessionStatusEnum("status").notNull().default("active"),
    mode: text("mode").notNull(),
    level: difficultyLevelEnum("level").notNull(),
    questionIds: uuid("question_ids").array().notNull(),
    currentIndex: integer("current_index").notNull().default(0),
    score: integer("score"),
    startedAt: timestamp("started_at").defaultNow(),
    finishedAt: timestamp("finished_at"),
    timeLimitSeconds: integer("time_limit_seconds"),
    expiresAt: timestamp("expires_at"),
    clientRequestId: text("client_request_id"),
  },
  (table) => [
    index("drill_sessions_user_idx").on(table.userId, table.drillId),
    uniqueIndex("drill_sessions_client_req_idx")
      .on(table.userId, table.clientRequestId)
      .where(sql`client_request_id IS NOT NULL`),
    uniqueIndex("drill_sessions_unique_active_idx")
      .on(table.userId, table.drillId)
      .where(sql`status = 'active'`),
  ],
);

export const sessionAnswers = pgTable(
  "session_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => drillSessions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    answer: jsonb("answer").notNull(),
    isCorrect: boolean("is_correct"),
    score: real("score"),
    gradingResult: jsonb("grading_result"),
    gradingMethod: text("grading_method"),
    confidence: real("confidence"),
    timeTakenMs: integer("time_taken_ms"),
    flaggedForReview: boolean("flagged_for_review").notNull().default(false),
    reportReason: text("report_reason"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("session_answers_session_idx").on(table.sessionId),
    uniqueIndex("session_answers_session_question_idx").on(
      table.sessionId,
      table.questionId,
    ),
  ],
);

export const userConceptMastery = pgTable(
  "user_concept_mastery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    mastery: real("mastery").notNull().default(0.0),
    attempts: integer("attempts").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    lastSeen: timestamp("last_seen"),
    nextDue: timestamp("next_due"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("user_concept_mastery_user_concept_idx").on(
      table.userId,
      table.conceptId,
    ),
    index("mastery_user_due_idx").on(table.userId, table.nextDue),
  ],
);

export const userConceptMasteryLog = pgTable(
  "user_concept_mastery_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => sessionAnswers.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    previousMastery: real("previous_mastery").notNull(),
    newMastery: real("new_mastery").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("user_concept_mastery_log_uniq_idx").on(
      table.userId,
      table.conceptId,
      table.answerId,
    ),
    index("mastery_log_user_concept_idx").on(table.userId, table.conceptId),
  ],
);

export const masteryRetryQueue = pgTable(
  "mastery_retry_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    conceptIds: uuid("concept_ids").array().notNull(),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => sessionAnswers.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("mastery_retry_pending_idx")
      .on(table.nextRetryAt)
      .where(sql`attempts < 5`),
  ],
);

export const questionReports = pgTable(
  "question_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => drillSessions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("question_reports_session_q_user_idx").on(
      table.sessionId,
      table.questionId,
      table.userId,
    ),
    index("question_reports_question_idx").on(table.questionId),
  ],
);

