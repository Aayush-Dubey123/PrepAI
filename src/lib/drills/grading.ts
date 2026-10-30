import { generate } from "../llm";
import {
  GradingResultSchema,
  type GradingResult,
  type Rubric,
  type QuestionPayload,
} from "../../schemas/drills";

export interface GradeAnswerInput {
  questionId: string;
  type: string;
  payload: QuestionPayload;
  rubric: Rubric;
  modelAnswer: string;
  explanation: string;
  userAnswer: unknown;
}

export interface GradeAnswerResult {
  score: number;
  isCorrect: boolean;
  gradingMethod: "deterministic" | "llm" | "self_assessment";
  confidence: number | null;
  gradingResult?: GradingResult;
  explanation: string;
  modelAnswer?: string;
  requiresSelfAssessment?: boolean;
}

export function normalizeWhitespace(s: string): string {
  return s
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ");
}

export function gradeDeterministic(
  type: string,
  payload: QuestionPayload,
  userAnswer: unknown,
  explanation: string,
): GradeAnswerResult | null {
  if (type === "mcq" && payload.type === "mcq") {
    const selected = String(userAnswer ?? "").trim();
    const correct = String(payload.correct_key).trim();
    const isCorrect = selected.toLowerCase() === correct.toLowerCase();
    const score = isCorrect ? 1.0 : 0.0;
    return {
      score,
      isCorrect,
      gradingMethod: "deterministic",
      confidence: null,
      explanation,
      gradingResult: {
        per_criterion: [
          {
            name: "Option Accuracy",
            score,
            feedback: isCorrect ? "Selected correct option." : `Selected ${selected}, expected ${correct}.`,
          },
        ],
        overall_score: score,
        confidence: 1.0,
        explanation,
      },
    };
  }

  if (type === "multi_select" && payload.type === "multi_select") {
    const userKeys = Array.isArray(userAnswer)
      ? new Set(userAnswer.map((k: unknown) => String(k).trim()))
      : new Set([String(userAnswer ?? "").trim()]);
    const correctKeys = new Set(payload.correct_keys.map((k) => String(k).trim()));

    let intersection = 0;
    for (const k of userKeys) {
      if (correctKeys.has(k)) intersection++;
    }
    const union = new Set([...userKeys, ...correctKeys]).size;
    const score = union === 0 ? 0.0 : Math.round((intersection / union) * 100) / 100;
    const isCorrect = score >= 0.6;

    return {
      score,
      isCorrect,
      gradingMethod: "deterministic",
      confidence: null,
      explanation,
      gradingResult: {
        per_criterion: [
          {
            name: "Multi-Option Alignment",
            score,
            feedback: `Selected ${userKeys.size} options, ${intersection} correct out of ${correctKeys.size}.`,
          },
        ],
        overall_score: score,
        confidence: 1.0,
        explanation,
      },
    };
  }

  if (type === "code_trace" && payload.type === "code_trace") {
    const normUser = normalizeWhitespace(String(userAnswer ?? ""));
    const normExpected = normalizeWhitespace(payload.expected_output);
    const isCorrect = normUser === normExpected;
    const score = isCorrect ? 1.0 : 0.0;

    return {
      score,
      isCorrect,
      gradingMethod: "deterministic",
      confidence: null,
      explanation,
      gradingResult: {
        per_criterion: [
          {
            name: "Exact Output Match",
            score,
            feedback: isCorrect
              ? "Trace output matches expected output."
              : `Received: "${normUser}", Expected: "${normExpected}"`,
          },
        ],
        overall_score: score,
        confidence: 1.0,
        explanation,
      },
    };
  }

  return null;
}

const GRADING_SYSTEM_PROMPT = `You are a Principal Engineering Interview Grader evaluating technical candidate answers.
Evaluate the candidate's answer against the rubric criteria and the reference model answer.
Scoring Guidelines:
- Grade strictly and objectively.
- Each criterion has a weight (summing to 1.0) and description. Provide a score (0.0 to 1.0) and specific actionable feedback for each.
- Compute the overall_score as the weighted sum of criterion scores.
- Confidence must be between 0.0 and 1.0 (1.0 = unequivocal evaluation, 0.4 = ambiguous utterance or unparseable input).
- Return valid JSON matching the GradingResult schema:
  {
    "per_criterion": [
      { "name": string, "score": number, "feedback": string }
    ],
    "overall_score": number,
    "confidence": number,
    "explanation": string
  }
`;

export async function gradeAnswer(input: GradeAnswerInput): Promise<GradeAnswerResult> {
  const { questionId, type, payload, rubric, modelAnswer, explanation, userAnswer } = input;

  // 1. Try deterministic grading first
  const deterministic = gradeDeterministic(type, payload, userAnswer, explanation);
  if (deterministic) {
    return deterministic;
  }

  // 2. Format user answer string
  let answerStr = "";
  if (typeof userAnswer === "string") {
    answerStr = userAnswer;
  } else if (userAnswer && typeof userAnswer === "object") {
    answerStr = JSON.stringify(userAnswer, null, 2);
  } else {
    answerStr = String(userAnswer ?? "");
  }

  // 3. Prepare LLM prompt
  const stem = payload.stem;
  const rubricJson = JSON.stringify(rubric, null, 2);

  const prompt = `QUESTION STEM:
${stem}

REFERENCE MODEL ANSWER:
${modelAnswer}

RUBRIC:
${rubricJson}

CANDIDATE ANSWER:
${answerStr || "(empty answer)"}

Evaluate this answer against the rubric. Output JSON matching the schema.`;

  const startTime = Date.now();

  try {
    const res = await generate({
      task: "heavy",
      system: GRADING_SYSTEM_PROMPT,
      prompt,
      jsonSchema: GradingResultSchema,
    });

    const latency = Date.now() - startTime;
    let parsed: GradingResult;
    try {
      let rawText = res.text.trim();
      if (rawText.startsWith("```json")) {
        rawText = rawText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      parsed = GradingResultSchema.parse(JSON.parse(rawText));
    } catch {
      parsed = GradingResultSchema.parse(JSON.parse(res.text));
    }

    const conf = parsed.confidence;
    const provider = res.attempts.find((a) => a.outcome === "success")?.provider ?? "unknown";

    console.log(
      `[DRILL_GRADE] questionId=${questionId} method=llm latencyMs=${latency} confidence=${conf} provider=${provider}`,
    );

    const isCorrect = parsed.overall_score >= (rubric.passing_threshold ?? 0.6);

    return {
      score: parsed.overall_score,
      isCorrect,
      gradingMethod: "llm",
      confidence: conf,
      gradingResult: parsed,
      explanation,
      modelAnswer,
    };
  } catch (err) {
    console.warn(`[DRILL_GRADE_FALLBACK] questionId=${questionId} reason=all_providers_failed error=${err}`);
    return {
      score: 0.0,
      isCorrect: false,
      gradingMethod: "self_assessment",
      confidence: null,
      explanation,
      modelAnswer,
      requiresSelfAssessment: true,
    };
  }
}
