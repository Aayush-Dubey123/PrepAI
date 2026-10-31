import {
  QuestionPayloadSchema,
  RubricSchema,
  type QuestionPayload,
  type Rubric,
} from "@/src/schemas/practice/drills";

export interface RawQuestionItem {
  slug: string;
  type:
    | "mcq"
    | "multi_select"
    | "short_answer"
    | "scenario"
    | "code_trace"
    | "fix_the_bug"
    | "star_prompt"
    | "voice_answer";
  level: "foundational" | "mid" | "senior" | "staff";
  payload: QuestionPayload;
  rubric: Rubric;
  model_answer: string;
  explanation: string;
  review_status?: "draft" | "approved";
  version?: number;
}

export function jaccardSimilarity(str1: string, str2: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean),
    );
  const set1 = tokenize(str1);
  const set2 = tokenize(str2);
  if (set1.size === 0 && set2.size === 0) return 1;
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function validateQuestionItem(raw: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Question must be an object"] };
  }

  const q = raw as Partial<RawQuestionItem>;

  if (!q.slug || typeof q.slug !== "string") {
    errors.push("Missing or invalid slug");
  }

  // Validate payload against QuestionPayloadSchema
  const payloadRes = QuestionPayloadSchema.safeParse(q.payload);
  if (!payloadRes.success) {
    errors.push(`Invalid payload: ${payloadRes.error.message}`);
  } else {
    const p = payloadRes.data;
    if (p.type === "mcq") {
      const keys = new Set(p.options.map((o) => o.key));
      if (!keys.has(p.correct_key)) {
        errors.push(`MCQ correct_key '${p.correct_key}' not in options keys`);
      }
    } else if (p.type === "multi_select") {
      const keys = new Set(p.options.map((o) => o.key));
      for (const k of p.correct_keys) {
        if (!keys.has(k)) {
          errors.push(`Multi-select correct_key '${k}' not in options keys`);
        }
      }
    } else if (p.type === "code_trace") {
      if (!p.expected_output || p.expected_output.trim().length === 0) {
        errors.push("Code trace expected_output cannot be empty");
      }
    } else if (p.type === "fix_the_bug") {
      if (p.correct_code.trim() === p.buggy_code.trim()) {
        errors.push("Fix the bug correct_code must differ from buggy_code");
      }
    }
  }

  // Validate rubric against RubricSchema with >= 2 criteria
  const rubricRes = RubricSchema.safeParse(q.rubric);
  if (!rubricRes.success) {
    errors.push(`Invalid rubric: ${rubricRes.error.message}`);
  } else if (rubricRes.data.criteria.length < 2) {
    errors.push("Rubric must contain at least 2 criteria");
  }

  // Validate model_answer >= 20 chars
  if (!q.model_answer || typeof q.model_answer !== "string" || q.model_answer.trim().length < 20) {
    errors.push("model_answer must be non-empty and at least 20 characters");
  }

  // Validate explanation >= 30 chars
  if (!q.explanation || typeof q.explanation !== "string" || q.explanation.trim().length < 30) {
    errors.push("explanation must be non-empty and at least 30 characters");
  }

  return { valid: errors.length === 0, errors };
}
