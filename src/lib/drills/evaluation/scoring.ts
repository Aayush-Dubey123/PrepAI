export interface ScorableAnswer {
  gradingMethod?: string | null;
  grading_method?: string | null;
  confidence: number | null;
  score: number | null;
}

export function computeSessionScore(answers: ScorableAnswer[]): number {
  const scored = answers.filter((a) => {
    if (a.score === null || a.score === undefined) return false;
    const method = a.gradingMethod ?? a.grading_method ?? null;
    if (method === "deterministic") return true;
    if (method === "llm") {
      return (a.confidence ?? 1.0) >= 0.5;
    }
    // self_assessment and other unverified methods excluded from denominator
    return false;
  });
  if (scored.length === 0) {
    return 0;
  }

  const total = scored.reduce((sum, a) => sum + (a.score ?? 0), 0);
  return Math.round((100 * total) / Math.max(scored.length, 1));
}
