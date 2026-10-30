"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { Card } from "@/src/components/ui/Card";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import LatticeLoader from "@/src/components/ui/LatticeLoader";
import { useToast } from "@/src/components/ui/ToastProvider";
import { QuestionDispatcher } from "@/src/components/gym/QuestionRenderers";
import type { ClientQuestionPayload, GradingResult } from "@/src/schemas/drills";
import {
  ArrowLeft,
  Clock,
  Flag,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SessionData {
  id: string;
  drillId: string;
  drillSlug: string;
  drillTitle: string;
  mode: "practice" | "timed" | "voice";
  level: "foundational" | "mid" | "senior" | "staff";
  currentIndex: number;
  totalQuestions: number;
  status: string;
  score: number | null;
  expiresAt: string | null;
  timeLimitSeconds: number | null;
}

interface QuestionData {
  index: number;
  questionId: string;
  type: string;
  payload: ClientQuestionPayload;
  totalQuestions: number;
  alreadyAnswered?: boolean;
  previousScore?: number;
}

interface FinishFeedbackItem {
  index: number;
  questionId: string;
  type: string;
  stem: string;
  userAnswer: unknown;
  score: number;
  isCorrect: boolean;
  gradingMethod: string | null;
  gradingResult: GradingResult | null;
  explanation: string;
  modelAnswer: string;
  timeTakenMs: number | null;
}

interface FinishResponse {
  score: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  timeElapsed: number;
  perQuestion: FinishFeedbackItem[];
}

function QuestionPlayer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const drillSlug = params.slug as string;
  const sessionId = searchParams.get("sessionId");
  const { toast } = useToast();

  const [session, setSession] = useState<SessionData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [userAnswer, setUserAnswer] = useState<unknown>("");
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  // State machine: loading | answering | submitting | feedback | self_assessment | finished | error
  const [viewState, setViewState] = useState<
    "loading" | "answering" | "submitting" | "feedback" | "self_assessment" | "finished" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Feedback state for current question
  const [feedbackData, setFeedbackData] = useState<{
    score: number;
    isCorrect: boolean;
    gradingResult?: GradingResult;
    explanation: string;
    modelAnswer?: string;
  } | null>(null);

  // Self-assessment state
  const [selfAssessmentModelAnswer, setSelfAssessmentModelAnswer] = useState<string>("");
  const [selfRating, setSelfRating] = useState<number>(3);

  // Finish summary state
  const [finishData, setFinishData] = useState<FinishResponse | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Record<number, boolean>>({});

  // Timed session countdown
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<string>("incorrect_answer");
  const [reportDetails, setReportDetails] = useState<string>("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // 1. Fetch Session Info
  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setViewState("error");
      setErrorMessage("No sessionId provided in URL query.");
      return;
    }

    try {
      const res = await fetch(`/api/drill-sessions/${sessionId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load session");
      }

      const s = data.session;
      const sessionObj: SessionData = {
        id: s.id,
        drillId: s.drillId,
        drillSlug: s.drillSlug,
        drillTitle: s.drillTitle,
        mode: s.mode,
        level: s.level,
        currentIndex: s.currentIndex,
        totalQuestions: s.questionCount,
        status: s.status,
        score: s.score,
        expiresAt: s.expiresAt,
        timeLimitSeconds: s.timeLimitSeconds,
      };
      setSession(sessionObj);

      if (sessionObj.status === "completed") {
        await finishSession(sessionId);
        return;
      }

      await fetchQuestion(sessionId, sessionObj.currentIndex);
    } catch (err: unknown) {
      setViewState("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to load session");
    }
  }, [sessionId]);

  // 2. Fetch Question at Index
  const fetchQuestion = async (sid: string, index: number) => {
    try {
      setViewState("loading");
      const res = await fetch(`/api/drill-sessions/${sid}/questions/${index}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "SESSION_EXPIRED" || data.code === "SESSION_ENDED") {
          await finishSession(sid);
          return;
        }
        throw new Error(data.error || "Failed to fetch question");
      }

      setCurrentQuestion(data);
      setUserAnswer("");
      setQuestionStartTime(Date.now());
      setViewState("answering");
    } catch (err: unknown) {
      setViewState("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to fetch question");
    }
  };

  // 3. Countdown timer for Timed Sessions
  useEffect(() => {
    if (!session?.expiresAt || session.status === "completed" || viewState === "finished") return;

    const expiryTime = new Date(session.expiresAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setSecondsRemaining(diff);
      if (diff <= 0) {
        toast("Time's Up! Timed session limit reached. Finalizing results...", { type: "warning" });
        finishSession(session.id);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.expiresAt, session?.status, session?.id, viewState]);

  // Initial load
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // 4. Submit Answer
  const handleSubmitAnswer = async () => {
    if (!session || !currentQuestion) return;

    const timeTakenMs = Date.now() - questionStartTime;
    setViewState("submitting");

    try {
      const res = await fetch(`/api/drill-sessions/${session.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.questionId,
          answer: userAnswer,
          timeTakenMs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === "SESSION_EXPIRED" || data.code === "SESSION_ENDED") {
          await finishSession(session.id);
          return;
        }
        throw new Error(data.error || "Failed to submit answer");
      }

      if (data.requiresSelfAssessment) {
        setSelfAssessmentModelAnswer(data.modelAnswer);
        setViewState("self_assessment");
        return;
      }

      if (session.mode === "timed") {
        advanceNextQuestion();
      } else {
        setFeedbackData({
          score: data.score,
          isCorrect: data.isCorrect,
          gradingResult: data.gradingResult,
          explanation: data.explanation,
          modelAnswer: data.modelAnswer,
        });
        setViewState("feedback");
      }
    } catch (err: unknown) {
      toast(`Submission Error: ${err instanceof Error ? err.message : "Failed to grade answer"}`, { type: "error" });
      setViewState("answering");
    }
  };

  // 5. Submit Self-Assessment Rating
  const handleSelfAssessmentSubmit = async () => {
    if (!session || !currentQuestion) return;

    try {
      const res = await fetch(`/api/drill-sessions/${session.id}/answer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.questionId,
          selfRating,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save self-assessment");
      }

      toast(`Rating Saved: Self-rating recorded: ${selfRating}/5`, { type: "success" });
      advanceNextQuestion();
    } catch (err: unknown) {
      toast(`Error: ${err instanceof Error ? err.message : "Failed to record rating"}`, { type: "error" });
    }
  };

  // 6. Advance Next Question
  const advanceNextQuestion = () => {
    if (!session || !currentQuestion) return;
    const nextIdx = currentQuestion.index + 1;
    if (nextIdx >= currentQuestion.totalQuestions) {
      finishSession(session.id);
    } else {
      fetchQuestion(session.id, nextIdx);
    }
  };

  // 7. Finish Session
  const finishSession = async (sid: string) => {
    setViewState("submitting");
    try {
      const res = await fetch(`/api/drill-sessions/${sid}/finish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to finish session");
      }

      setFinishData(data);
      setViewState("finished");
    } catch (err: unknown) {
      setViewState("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to finalize session");
    }
  };

  // 8. Submit Question Report
  const handleReportSubmit = async () => {
    if (!session || !currentQuestion) return;
    setReportSubmitting(true);
    try {
      const res = await fetch(`/api/drill-sessions/${session.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.questionId,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      if (!res.ok) throw new Error("Failed to report");

      toast("Report Submitted: Thank you for helping keep PrepAI content accurate.", { type: "success" });
      setShowReportModal(false);
      setReportDetails("");
    } catch {
      toast("Failed to submit report", { type: "error" });
    } finally {
      setReportSubmitting(false);
    }
  };

  // ── Render States ──────────────────────────────────────────────────────────

  if (viewState === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <LatticeLoader label="Loading question..." status="working" />
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <div className="p-3 bg-rose-100 text-rose-700 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-[#0f172a]">Could Not Load Drill</h2>
        <p className="text-xs text-[#64748b]">{errorMessage}</p>
        <Button onClick={() => router.push(`/practice/${drillSlug}`)} variant="secondary" className="text-xs">
          Back to Drill
        </Button>
      </div>
    );
  }

  // ── FINISHED SUMMARY VIEW ──────────────────────────────────────────────────
  if (viewState === "finished" && finishData) {
    const score = finishData.score;
    const isPassing = score >= 70;

    return (
      <div className="h-full w-full max-w-5xl mx-auto p-4 sm:p-5 lg:px-6 lg:py-4 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between">
          <Link
            href={`/practice/${drillSlug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748b] hover:text-[#0f172a]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Drill Details</span>
          </Link>
        </div>

        {/* Score Hero Card */}
        <Card className="shrink-0 p-4 sm:p-5 bg-white border-[#e2e8f0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-6">
            {/* Circular Gauge */}
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-slate-100" strokeWidth="8" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className={`${
                    isPassing ? "stroke-emerald-600" : "stroke-indigo-600"
                  } transition-all duration-1000 ease-out`}
                  strokeWidth="8"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * score) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-[#0f172a]">{score}%</span>
                <span className="text-[9px] uppercase font-mono text-[#64748b] font-medium">Session Score</span>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2">
                <Badge variant={isPassing ? "success" : "purple"} className="text-xs font-bold">
                  {isPassing ? "Passed Benchmark" : "Practice Complete"}
                </Badge>
                <span className="text-xs text-[#64748b]">
                  {finishData.correctCount} of {finishData.totalQuestions} questions correct
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#0f172a]">{session?.drillTitle}</h2>
              <p className="text-xs text-[#64748b]">
                Duration: {Math.floor(finishData.timeElapsed / 60)}m {finishData.timeElapsed % 60}s • Level: {session?.level}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              onClick={() => router.push(`/practice/${drillSlug}`)}
              variant="secondary"
              className="text-xs font-semibold px-4 py-2"
            >
              Back to Drill
            </Button>
            <Button
              onClick={() => router.push(`/practice`)}
              variant="primary"
              className="text-xs font-semibold px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Continue Practice
            </Button>
          </div>
        </Card>

        {/* Breakdown Accordion Table */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <h3 className="shrink-0 text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-2 font-mono">
            Per-Question Breakdown
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {finishData.perQuestion.map((item, idx) => {
              const isExpanded = !!expandedQuestions[idx];
              return (
                <Card key={item.questionId} className="border-[#e2e8f0] overflow-hidden">
                  <div
                    onClick={() =>
                      setExpandedQuestions((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        {item.isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-[#64748b]">Q{idx + 1}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                            {item.type}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-[#0f172a] line-clamp-1 mt-0.5">{item.stem}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-xs text-[#0f172a]">
                        {Math.round(item.score * 100)}%
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-slate-50 border-t border-[#e2e8f0] space-y-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-700">Model Answer:</span>
                        <p className="mt-1 text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                          {item.modelAnswer}
                        </p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">Explanation & Insights:</span>
                        <p className="mt-1 text-[#475569] leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                          {item.explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE QUESTION VIEW ───────────────────────────────────────────────────
  if (!currentQuestion) return null;

  const total = currentQuestion.totalQuestions;
  const currentIdx = currentQuestion.index;
  const progressPercent = Math.round(((currentIdx + 1) / total) * 100);

  return (
    <div className="h-full w-full max-w-5xl mx-auto p-4 sm:p-5 lg:px-6 lg:py-4 flex flex-col justify-between overflow-hidden">
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between pb-2.5 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-3">
          <Link
            href={`/practice/${drillSlug}`}
            className="text-xs font-semibold text-[#64748b] hover:text-[#0f172a] flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Drill</span>
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-bold text-[#0f172a]">{session?.drillTitle}</span>
        </div>

        <div className="flex items-center gap-3">
          {session?.mode === "timed" && secondsRemaining !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-800 text-xs font-mono font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, "0")}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#94a3b8] hover:text-slate-700 transition-colors"
          >
            <Flag className="w-3 h-3" />
            <span>Report</span>
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div className="shrink-0 space-y-1 my-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748b]">
          <span>
            Question {currentIdx + 1} of {total}
          </span>
          <span className="capitalize">{session?.level} Level</span>
        </div>
        <ProgressBar value={progressPercent} size="sm" />
      </div>

      {/* Active Question Scroll Container */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 my-1">
        <Card className="p-4 sm:p-5 bg-white border-[#e2e8f0] shadow-xs space-y-3.5">
        {/* Stem Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              {currentQuestion.type.replace(/_/g, " ")}
            </span>
          </div>
          <h2 className="text-sm md:text-base font-bold text-[#0f172a] leading-relaxed">
            {currentQuestion.payload.stem}
          </h2>
        </div>

        {/* Dynamic Question Renderer */}
        <div className="pt-2">
          <QuestionDispatcher
            payload={currentQuestion.payload}
            value={userAnswer}
            onChange={setUserAnswer}
            disabled={viewState === "submitting" || viewState === "feedback"}
          />
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-[#f1f5f9] flex items-center justify-between">
          <div className="text-[11px] text-[#94a3b8]">
            {session?.mode === "timed" ? "Timed Mode • Answers grade at end" : "Rubric evaluated by AI"}
          </div>

          {viewState === "submitting" ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
              <LatticeLoader status="working" />
              <span>Evaluating answer...</span>
            </div>
          ) : viewState === "feedback" ? (
            <Button
              onClick={advanceNextQuestion}
              variant="primary"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <span>{currentIdx + 1 >= total ? "View Final Results" : "Next Question"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmitAnswer}
              disabled={
                userAnswer === undefined ||
                userAnswer === "" ||
                (Array.isArray(userAnswer) && userAnswer.length === 0)
              }
              variant="primary"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Submit Answer
            </Button>
          )}
        </div>
      </Card>
      {/* Slide-in Feedback Panel (Practice Mode) */}
      {viewState === "feedback" && feedbackData && (
        <Card className="p-6 bg-slate-900 border-slate-800 text-white shadow-lg space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                  feedbackData.isCorrect ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {Math.round(feedbackData.score * 100)}%
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">
                  {feedbackData.isCorrect ? "Correct Solution" : "Partial / Incorrect"}
                </h3>
                <span className="text-[11px] text-slate-400">Rubric Feedback & Educational Insights</span>
              </div>
            </div>

            <Button
              onClick={advanceNextQuestion}
              variant="primary"
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Model Answer & Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {feedbackData.modelAnswer && (
              <div className="p-3 bg-slate-800/80 rounded-xl space-y-1">
                <span className="font-bold text-emerald-400 text-[11px]">Exemplary Model Answer:</span>
                <p className="text-slate-300 leading-relaxed">{feedbackData.modelAnswer}</p>
              </div>
            )}
            <div className="p-3 bg-slate-800/80 rounded-xl space-y-1">
              <span className="font-bold text-indigo-400 text-[11px]">Explanation & Theory:</span>
              <p className="text-slate-300 leading-relaxed">{feedbackData.explanation}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Self-Assessment Fallback UI */}
      {viewState === "self_assessment" && (
        <Card className="p-6 bg-white border-amber-300 shadow-md space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">AI Grader Unavailable — Self Assessment</h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Compare your response against the model answer below and rate your technical accuracy (1 to 5 stars).
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
            <span className="font-bold text-slate-700">Reference Model Answer:</span>
            <p className="text-[#1e293b] leading-relaxed">{selfAssessmentModelAnswer}</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Your Rating:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelfRating(star)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    selfRating === star
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {star}★
                </button>
              ))}
            </div>

            <Button
              onClick={handleSelfAssessmentSubmit}
              variant="primary"
              className="text-xs font-semibold px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
            >
              Submit Rating & Advance
            </Button>
          </div>
        </Card>
      )}
      </div>
      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <Card className="max-w-md w-full p-6 bg-white border-[#e2e8f0] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0f172a]">Report Question</h3>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="incorrect_answer">Incorrect answer</option>
                  <option value="ambiguous_question">Ambiguous question stem</option>
                  <option value="wrong_category">Wrong category / concept</option>
                  <option value="other">Other issue</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Additional Details (Optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Explain what is incorrect or ambiguous..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white min-h-[80px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button onClick={() => setShowReportModal(false)} variant="secondary" className="text-xs">
                Cancel
              </Button>
              <Button
                onClick={handleReportSubmit}
                disabled={reportSubmitting}
                variant="primary"
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
              >
                {reportSubmitting ? "Submitting..." : "Send Report"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function PlayDrillPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center p-8">
          <LatticeLoader label="Loading Technical Practice..." status="working" />
        </div>
      }
    >
      <QuestionPlayer />
    </Suspense>
  );
}
