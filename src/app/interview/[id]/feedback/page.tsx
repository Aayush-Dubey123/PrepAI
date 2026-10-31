"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Award,
  TrendingUp,
  FileText,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  HelpCircle,
  Download,
  RotateCcw,
  User,
  ShieldCheck,
  Cpu,
  Target,
  MessageSquare,
  BookOpen,
  Trash2,
  Share2,
  Check,
} from "lucide-react";
import { useToast } from "@/src/components/ui/ToastProvider";
import { generateFeedbackPdf } from "@/src/lib/pdf-export";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/src/components/ui/Card";
interface FeedbackData {
  overallScore: number;
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  skillAssessments: Array<{
    skill: string;
    demonstrated: boolean;
    confidence: "high" | "medium" | "low";
    notes: string;
  }>;
  questionFeedback: Array<{
    question: string;
    focusArea: string;
    answerQuality: "excellent" | "good" | "fair" | "poor" | "no_answer";
    strengths: string[];
    gaps: string[];
    suggestedImprovement?: string;
  }>;
  recommendedFollowUp?: string;
  hiringRecommendation: "strong_hire" | "hire" | "consider" | "do_not_hire";
  interviewDuration: number;
  integrityEvents?: Array<{
    type: string;
    timestamp: number;
    details?: string;
    durationMs?: number;
  }>;
}

interface TranscriptChunk {
  id: string;
  speaker: "user" | "ai";
  content: string;
  createdAt?: string;
}

export default function InterviewFeedbackPage() {
  const params = useParams<{ id: string }>();
  const interviewId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [jobRole, setJobRole] = useState("Software Engineering");
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([]);
  const [candidateSnapshot, setCandidateSnapshot] = useState<string | null>(null);
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Record<number, boolean>>({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      toast("Report link copied to clipboard", { type: "info" });
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleDeleteRecord = async () => {
    if (!interviewId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}`, { method: "DELETE" });
      if (res.ok) {
        toast("Interview record deleted", { type: "info" });
        router.push("/dashboard");
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || "Could not delete record", { type: "error" });
        setIsDeleting(false);
        setShowDeleteModal(false);
      }
    } catch {
      toast("Delete request failed", { type: "error" });
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };
  const handleDownloadPdf = () => {
    if (!feedback) return;
    setIsExportingPdf(true);
    try {
      generateFeedbackPdf(feedback, jobRole, interviewId || "session", transcript);
    } catch (err) {
      console.error("[PDF_EXPORT_ERROR]", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  useEffect(() => {
    if (!interviewId) return;

    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;

    async function fetchFeedback() {
      try {
        const res = await fetch(`/api/interviews/${interviewId}/feedback`);
        if (!res.ok) {
          const genRes = await fetch(`/api/interviews/${interviewId}/feedback/generate`, {
            method: "POST",
          });
          if (genRes.ok) {
            const genData = await genRes.json();
            if (isMounted) {
              setFeedback(genData);
              setLoading(false);
            }
            return;
          }
          throw new Error(`Failed to load report (Status ${res.status})`);
        }

        const data = await res.json();
        if (data.feedback && data.feedback.overallScore !== undefined) {
          if (isMounted) {
            setFeedback(data.feedback);
            if (data.interview?.jobRole) setJobRole(data.interview.jobRole);
            setLoading(false);
          }
          if (pollInterval) clearInterval(pollInterval);
        } else {
          attempts++;
          if (attempts > 20) {
            if (pollInterval) clearInterval(pollInterval);
            if (isMounted) {
              setError("Report generation timed out. Please refresh to try again.");
              setLoading(false);
            }
          }
        }
      } catch (err: unknown) {
        console.warn("[FEEDBACK_FETCH]", err);
        attempts++;
        if (attempts > 15) {
          if (pollInterval) clearInterval(pollInterval);
          if (isMounted) {
            setError(err instanceof Error ? err.message : "Failed to load feedback report.");
            setLoading(false);
          }
        }
      }
    }

    void fetchFeedback();
    pollInterval = setInterval(fetchFeedback, 2500);

    fetch(`/api/interviews/transcript?interviewId=${interviewId}`)
      .then((r) => r.json())
      .then((tData) => {
        if (isMounted) {
          if (tData.chunks) setTranscript(tData.chunks);
          if (tData.interview?.candidateSnapshot) {
            setCandidateSnapshot(tData.interview.candidateSnapshot);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      clearInterval(pollInterval!);
    };
  }, [interviewId]);

  const toggleQuestion = (idx: number) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Clamped duration calculation to prevent extreme numbers like 573m
  const displayDuration = (() => {
    const t0 = transcript[0]?.createdAt;
    const tEnd = transcript[transcript.length - 1]?.createdAt;
    if (transcript.length >= 2 && t0 && tEnd) {
      const first = new Date(t0).getTime();
      const last = new Date(tEnd).getTime();
      const diffMin = Math.round((last - first) / 60000);
      if (diffMin > 0 && diffMin <= 60) return diffMin;
    }
    const raw = feedback?.interviewDuration || 5;
    return raw > 60 ? 15 : Math.max(raw, 5);
  })();

  const isEarlyConcluded =
    (feedback?.overallScore === 0 && (feedback?.questionFeedback?.length ?? 0) === 0) ||
    feedback?.summary?.includes("before any technical questions were answered");

  const getRecommendationDetails = (rec: string) => {
    if (isEarlyConcluded) {
      return { label: "PRACTICE RUN (EARLY EXIT)", variant: "purple" as const };
    }
    switch (rec) {
      case "strong_hire":
        return { label: "STRONG HIRE", variant: "success" as const };
      case "hire":
        return { label: "HIRE", variant: "success" as const };
      case "consider":
        return { label: "CONSIDER", variant: "warning" as const };
      default:
        return { label: "REQUIRES PRACTICE", variant: "warning" as const };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fa] text-[#0f172a] flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center space-y-6 shadow-xl">
          <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-[#4f46e5] animate-spin" />
            <Sparkles className="w-7 h-7 text-[#4f46e5] animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">Generating Technical Evaluation...</h2>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Synthesizing adaptive turn progression, multi-turn citations, and rubric scores across all covered topics.
            </p>
          </div>
          <div className="w-full bg-[#f1f5f9] rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-[#4338ca] h-full w-2/3 animate-pulse" />
          </div>
          <p className="text-[11px] text-[#94a3b8] font-mono">Session ID: {interviewId?.slice(0, 8)}…</p>
        </div>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="min-h-screen bg-[#f4f6fa] text-[#0f172a] flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full rounded-2xl border border-rose-200 bg-white p-8 text-center space-y-6 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#0f172a]">Evaluation Notice</h2>
            <p className="text-xs text-[#64748b]">{error || "Could not retrieve feedback report."}</p>
          </div>
          <div className="flex flex-wrap gap-2.5 justify-center">
            <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-1.5">
                <LayoutDashboard size={14} />
                <span>Return to Cockpit</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteRecord}
              isLoading={isDeleting}
              className="gap-1.5 text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Delete Record</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const recBadge = getRecommendationDetails(feedback.hiringRecommendation);
  const scorePercent = Math.min(100, Math.max(0, feedback.overallScore));

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-3.5rem)] bg-[#f4f6fa] text-[#0f172a] font-sans flex flex-col justify-start md:justify-between overflow-y-auto md:overflow-hidden select-none">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 h-12 shrink-0 bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Cockpit</span>
            </Button>
          </Link>
          <div className="h-4 w-px bg-[#e2e8f0] hidden sm:block" />
          <div className="hidden sm:block">
            <h1 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">{jobRole}</h1>
            <p className="text-[10px] text-[#94a3b8] font-mono">Performance Evaluation Report</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="text-xs h-7 gap-1 text-[#475569] hover:text-[#0f172a]"
            title="Copy report link"
          >
            {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3 text-[#4f46e5]" />}
            <span className="hidden md:inline">{copiedLink ? "Copied" : "Share"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            isLoading={isExportingPdf}
            className="text-xs h-7 gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTranscriptDrawer(true)}
            className="text-xs h-7 gap-1"
          >
            <FileText className="w-3 h-3 text-[#4f46e5]" />
            <span>Transcript ({transcript.length})</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="text-xs h-7 gap-1 border-rose-200 text-rose-600 bg-rose-50/50 hover:bg-rose-100/70 cursor-pointer"
            title="Delete this interview report"
          >
            <Trash2 className="w-3 h-3 text-rose-600" />
            <span className="hidden md:inline">Delete</span>
          </Button>
        </div>
      </header>

      {/* Main Report Container - Viewport Fit with Scrollable Inner Content */}
      <main className="flex-1 min-h-0 max-w-6xl w-full mx-auto p-3 sm:p-5 flex flex-col justify-between gap-3 overflow-visible md:overflow-hidden">
        {/* Hero Score Card (Pinned Top) */}
        <section className="shrink-0 relative rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-xs overflow-hidden">
          <div className="pointer-events-none absolute -right-12 -top-12 w-64 h-64 bg-[#e0e7ff]/40 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 w-64 h-64 bg-[#f0f9ff]/40 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Score Ring + Verdict */}
            <div className="flex items-center gap-4 text-center sm:text-left">
              {/* Circular Gauge */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    className="stroke-[#e2e8f0]"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-[#4f46e5] transition-all duration-1000 ease-out"
                    strokeWidth="8"
                    strokeDasharray={251}
                    strokeDashoffset={251 - (251 * (isEarlyConcluded ? 35 : scorePercent)) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl sm:text-2xl font-extrabold text-[#0f172a] tracking-tight">
                    {isEarlyConcluded ? "—" : feedback.overallScore}
                  </span>
                  <span className="text-[9px] uppercase font-mono text-[#64748b] font-medium">
                    {isEarlyConcluded ? "Practice" : "/ 100"}
                  </span>
                </div>
              </div>

              {/* Verdict & Role Info */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={recBadge.variant} pulse className="text-[11px] font-bold px-2.5 py-0.5">
                    {recBadge.label}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded-full border border-[#e2e8f0]">
                    <Clock className="w-3 h-3 text-[#94a3b8]" />
                    <span>{displayDuration}m active duration</span>
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
                  {jobRole} Technical Evaluation
                </h2>
                <p className="text-xs text-[#64748b] max-w-md line-clamp-2">
                  {isEarlyConcluded
                    ? "Preliminary practice assessment. Answer full multi-turn questions in your next round to calibrate deep competency ratings."
                    : "Objective score computed from grounded citations, code answers, and architectural depth ladders."}
                </p>
              </div>
            </div>

            {/* Candidate Snapshot & Quick Actions */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#e2e8f0] bg-slate-100 shadow-inner flex items-center justify-center">
                  {candidateSnapshot ? (
                    <Image
                      src={candidateSnapshot}
                      alt="Verified Candidate Snapshot"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-[#94a3b8]" />
                  )}
                </div>
                <span className="text-[9px] font-mono text-[#94a3b8] flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-[#4f46e5]" />
                  Proctored
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadPdf}
                  isLoading={isExportingPdf}
                  className="font-semibold text-xs gap-1.5 h-8 px-3 bg-[#1e293b] hover:bg-[#0f172a] text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report</span>
                </Button>
                <Link href="/dashboard">
                  <Button variant="secondary" size="sm" className="w-full text-xs font-semibold gap-1.5 h-8 px-3">
                    <RotateCcw className="w-3.5 h-3.5 text-[#4f46e5]" />
                    <span>Practice Again</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Scrollable Report Body */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {/* Executive Synthesis */}
          <Card glass className="p-4 space-y-2">
            <CardHeader className="p-0 flex flex-row items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#4f46e5]" />
              <CardTitle className="text-sm font-semibold text-[#0f172a]">Executive Synthesis</CardTitle>
            </CardHeader>
            <p className="text-xs text-[#475569] leading-relaxed">
              {isEarlyConcluded
                ? "This technical session concluded before comprehensive technical topics were completed. In upcoming sessions, engage with the AI's follow-up probes across algorithms and system design to unlock advanced rubric scoring."
                : feedback.summary}
            </p>
          </Card>

          {/* 4-Pillar Humanized Evaluation Matrix */}
          <Card glass className="p-4 space-y-3">
            <CardHeader className="p-0 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#4f46e5]" />
                <CardTitle className="text-sm font-semibold text-[#0f172a]">
                  Technical Competency Matrix
                </CardTitle>
              </div>
              <span className="text-[10px] font-mono text-[#64748b]">Core Engineering Pillars</span>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Pillar 1: Problem Solving */}
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
                    <Target className="w-3.5 h-3.5 text-[#4f46e5]" />
                    <span>Problem Solving</span>
                  </div>
                  <Badge variant={isEarlyConcluded ? "neutral" : "purple"} className="text-[9px] py-0 px-1.5">
                    {isEarlyConcluded ? "Developing" : "Analyzed"}
                  </Badge>
                </div>
                <p className="text-[11px] text-[#475569] leading-relaxed">
                  {isEarlyConcluded
                    ? "Clarify requirements, state assumptions upfront, and test boundary edge cases."
                    : feedback.skillAssessments?.[0]?.notes || "Demonstrated structured analytical problem decomposition."}
                </p>
              </div>

              {/* Pillar 2: System Design */}
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
                    <Cpu className="w-3.5 h-3.5 text-[#0284c7]" />
                    <span>System Design</span>
                  </div>
                  <Badge variant={isEarlyConcluded ? "neutral" : "cyan"} className="text-[9px] py-0 px-1.5">
                    {isEarlyConcluded ? "Next Focus" : "Evaluated"}
                  </Badge>
                </div>
                <p className="text-[11px] text-[#475569] leading-relaxed">
                  {isEarlyConcluded
                    ? "Focus on high-level architecture: caching, asynchronous message queues, and horizontal partitioning."
                    : feedback.skillAssessments?.[1]?.notes || "Addressed distributed systems reliability and latency budgets."}
                </p>
              </div>

              {/* Pillar 3: Technical Fundamentals */}
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
                    <BookOpen className="w-3.5 h-3.5 text-[#16a34a]" />
                    <span>Tech Breadth</span>
                  </div>
                  <Badge variant={isEarlyConcluded ? "neutral" : "success"} className="text-[9px] py-0 px-1.5">
                    {isEarlyConcluded ? "Foundational" : "Demonstrated"}
                  </Badge>
                </div>
                <p className="text-[11px] text-[#475569] leading-relaxed">
                  {isEarlyConcluded
                    ? "Deepen proficiency in your core stack (data structures, concurrency, API design)."
                    : feedback.skillAssessments?.[2]?.notes || "Solid command of language idioms, schema design, and runtime patterns."}
                </p>
              </div>

              {/* Pillar 4: Communication */}
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                    <span>Articulation</span>
                  </div>
                  <Badge variant={isEarlyConcluded ? "neutral" : "warning"} className="text-[9px] py-0 px-1.5">
                    {isEarlyConcluded ? "Active" : "Observed"}
                  </Badge>
                </div>
                <p className="text-[11px] text-[#475569] leading-relaxed">
                  {isEarlyConcluded
                    ? "Vocalize technical tradeoffs out loud before choosing specific architectural directions."
                    : "Clear communicative cadence with proactive clarification of design tradeoffs."}
                </p>
              </div>
            </div>
          </Card>

          {/* 2-Column: Demonstrated Strengths & Growth Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Strengths */}
            <Card glass className="p-4 space-y-2 border-emerald-200/80 bg-white">
              <CardHeader className="p-0 flex flex-row items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-sm font-semibold text-emerald-700">
                  Key Strengths
                </CardTitle>
              </CardHeader>
              <ul className="space-y-1.5 text-xs text-[#334155] leading-relaxed pt-1">
                {feedback.strengths.length > 0 && !isEarlyConcluded ? (
                  feedback.strengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <span>{str}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <span>Initiated session setup with successful audio & video calibration</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <span>Engaged with the autonomous interview pipeline</span>
                    </li>
                  </>
                )}
              </ul>
            </Card>

            {/* Growth Areas */}
            <Card glass className="p-4 space-y-2 border-amber-200/80 bg-white">
              <CardHeader className="p-0 flex flex-row items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-sm font-semibold text-amber-700">
                  Recommended Focus Areas
                </CardTitle>
              </CardHeader>
              <ul className="space-y-1.5 text-xs text-[#334155] leading-relaxed pt-1">
                {feedback.areasForImprovement.length > 0 && !isEarlyConcluded ? (
                  feedback.areasForImprovement.map((gap, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                      <span>{gap}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                      <span>Practice answering 3–5 multi-turn follow-ups in technical rounds</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                      <span>Structure answers using the STAR method for architectural discussions</span>
                    </li>
                  </>
                )}
              </ul>
            </Card>
          </div>

          {/* Diagnostic Question Accordion (if questions exist) */}
          {feedback.questionFeedback && feedback.questionFeedback.length > 0 && (
            <Card glass className="p-4 space-y-3">
              <CardHeader className="p-0 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#4f46e5]" />
                  <CardTitle className="text-sm font-semibold text-[#0f172a]">
                    Question-by-Question Diagnostic ({feedback.questionFeedback.length} Questions)
                  </CardTitle>
                </div>
                <span className="text-[10px] font-mono text-[#64748b]">Grounded Probing Analysis</span>
              </CardHeader>

              <div className="space-y-2 pt-1">
                {feedback.questionFeedback.map((q, idx) => {
                  const isExpanded = expandedQuestions[idx] ?? false;

                  const qualityVariant =
                    q.answerQuality === "excellent"
                      ? "success"
                      : q.answerQuality === "good"
                      ? "purple"
                      : q.answerQuality === "fair"
                      ? "warning"
                      : "error";

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] overflow-hidden transition-all shadow-xs"
                    >
                      <button
                        type="button"
                        onClick={() => toggleQuestion(idx)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-200/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 pr-3">
                          <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white border border-[#e2e8f0] font-mono text-[10px] font-semibold text-[#64748b] shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-[#0f172a] leading-snug">
                              {q.question}
                            </div>
                            <div className="text-[9px] text-[#64748b] font-mono mt-0.5">
                              {q.focusArea}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={qualityVariant} className="text-[9px] font-bold uppercase py-0 px-1.5">
                            {q.answerQuality.replace("_", " ")}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#64748b]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#64748b]" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[#e2e8f0] p-3 bg-white space-y-2 text-xs leading-relaxed animate-in fade-in duration-150">
                          {q.strengths.length > 0 && (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                                Strengths Observed:
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-[#334155] text-[11px]">
                                {q.strengths.map((str, sIdx) => (
                                  <li key={sIdx}>{str}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {q.gaps.length > 0 && (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                                Key Gaps:
                              </span>
                              <ul className="list-disc list-inside space-y-0.5 text-[#334155] text-[11px]">
                                {q.gaps.map((gap, gIdx) => (
                                  <li key={gIdx}>{gap}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {q.suggestedImprovement && (
                            <div className="space-y-0.5 rounded-lg bg-indigo-50 border border-indigo-200 p-2.5">
                              <span className="text-[10px] font-bold text-[#4338ca] uppercase tracking-wider">
                                Recommended Model Answer:
                              </span>
                              <p className="text-[#3730a3] text-xs mt-0.5">{q.suggestedImprovement}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Transcript Drawer Overlay */}
      {showTranscriptDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowTranscriptDrawer(false)}
          />
          <div className="relative z-50 w-full max-w-md bg-white border-l border-[#e2e8f0] p-5 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200 text-[#0f172a]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
              <h3 className="text-sm font-bold text-[#0f172a]">Full Session Transcript</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranscriptDrawer(false)}
                className="h-7 text-xs"
              >
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {transcript.map((chunk) => {
                const isAi = chunk.speaker === "ai";
                return (
                  <div
                    key={chunk.id}
                    className={`p-2.5 rounded-xl text-xs space-y-1 ${
                      isAi
                        ? "bg-[#f1f5f9] border border-[#e2e8f0] text-[#0f172a]"
                        : "bg-[#e0e7ff] border border-[#c7d2fe] text-[#3730a3]"
                    }`}
                  >
                    <span className="font-bold text-[10px] text-[#64748b]">
                      {isAi ? "Interviewer" : "Candidate"}
                    </span>
                    <p className="whitespace-pre-wrap">{chunk.content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          />
          <div className="relative z-50 w-full max-w-sm bg-white rounded-2xl border border-rose-200 p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0f172a]">Delete Interview Record?</h3>
                <p className="text-[11px] text-[#64748b]">This action is permanent and cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-[#334155] leading-relaxed">
              All transcript turns, scores, AI feedback, and records for this session will be permanently deleted from your account.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isDeleting}
                onClick={handleDeleteRecord}
                className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white"
              >
                Delete Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
