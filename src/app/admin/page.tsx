"use client";

import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Shield,
  Activity,
  Users,
  FileText,
  TrendingUp,
  Award,
  Database,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  RefreshCcw,
  Cpu,
  HelpCircle,
  Zap,
  Lock,
  Download,
  Globe,
  Wifi,
  Layers,
  Info,
  Camera,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface CandidateSnapshotItem {
  id: string;
  candidateName: string;
  jobRole: string;
  status: string;
  score: number | null;
  createdAt: string;
  candidateSnapshot: string | null;
}

interface AnalyticsData {
  platform: {
    totalInterviews: number;
    completedInterviews: number;
    ongoingInterviews: number;
    failedInterviews: number;
    totalTranscriptChunks: number;
    totalAuditEvents: number;
    totalGeminiCalls: number;
    totalQuestionsEvaluated: number;
  };
  scoring: {
    averageScore: number | null;
    meanScore: number | null;
    medianScore: number | null;
    stdDevScore: number | null;
    averageTurns: number | null;
    scoreDistribution: Record<string, number>;
  };
  hiringRecommendations: Record<string, number>;
  skillConfidences: { high: number; medium: number; low: number };
  answerQualityDistribution: Record<string, number>;
  sessionsPerDay: Record<string, number>;
  candidateSnapshots?: CandidateSnapshotItem[];
  clientNetwork?: {
    clientIp: string;
    allowedIpsConfigured: boolean;
    adminUserIdsConfigured: boolean;
    isLocalhost: boolean;
  };
  researchMetricsNote: string;
  generatedAt: string;
}

type TabType = "overview" | "scoring" | "research" | "network" | "snapshots";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const emptySubscribe = () => () => {};
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const reportRef = useRef<HTMLDivElement>(null);


  const fetchData = async (isManual = true) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await fetch("/api/admin/analytics");
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (res.status === 403) {
        const body = await res.json();
        setError(body.error || "Forbidden — Admin privileges required.");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load analytics data";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      await Promise.resolve();
      if (!ignore) {
        await fetchData(false);
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, []);

  const handleDownloadPdf = async () => {
    if (!reportRef.current || downloadingPdf) return;
    try {
      setDownloadingPdf(true);
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f4f6fa",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const dateStr = new Date().toISOString().split("T")[0];
      pdf.save(`PrepAI_Admin_Analytics_Report_${dateStr}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Error generating PDF report. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fa] text-[#0f172a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-[#4f46e5] animate-spin" />
          <p className="text-xs text-[#64748b] font-mono tracking-widest uppercase font-semibold">Initializing Telemetry Engine...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f6fa] text-[#0f172a] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-5 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
            <Lock size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#0f172a] tracking-tight">Access Restricted</h2>
            <p className="text-xs text-[#64748b] leading-relaxed">{error}</p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="px-4 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
            >
              Return to Candidate Dashboard
            </Link>
            <Link
              href="/admin/login"
              className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-[#e2e8f0] text-[#0f172a] rounded-xl text-xs font-semibold transition-all shadow-xs"
            >
              Sign in with Admin Credentials
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { platform, scoring, hiringRecommendations, skillConfidences, answerQualityDistribution, sessionsPerDay, clientNetwork } = data;

  // Formatting session days data for Recharts
  const sessionChartData = Object.entries(sessionsPerDay).map(([date, count]) => ({
    date: date.slice(5),
    fullDate: date,
    sessions: count,
  }));

  // Score distribution data for Recharts
  const scoreChartData = Object.entries(scoring.scoreDistribution)
    .sort(([a], [b]) => parseInt(a.split("-")[0]) - parseInt(b.split("-")[0]))
    .map(([bucket, count]) => ({
      bucket: `Score ${bucket}`,
      shortBucket: bucket,
      count,
    }));

  // Hiring recommendation pie chart data
  const hiringPieColors: Record<string, string> = {
    strong_hire: "#10b981",
    hire: "#22c55e",
    consider: "#f59e0b",
    do_not_hire: "#f43f5e",
    unknown: "#52525b",
  };

  const hiringChartData = Object.entries(hiringRecommendations)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: key.replace("_", " ").toUpperCase(),
      value,
      color: hiringPieColors[key] || "#71717a",
    }));

  const totalRecs = Object.values(hiringRecommendations).reduce((a, b) => a + b, 0);

  // Answer quality chart data
  const qualityChartData = Object.entries(answerQualityDistribution)
    .filter(([, v]) => v > 0)
    .map(([quality, count]) => ({
      quality: quality.replace("_", " ").toUpperCase(),
      count,
    }));

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-[#0f172a] font-sans pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-50 h-14 bg-white/90 backdrop-blur-xl border-b border-[#e2e8f0] px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-[#e2e8f0] text-xs font-semibold text-[#334155] hover:text-[#0f172a] hover:bg-slate-200 transition-all"
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-[1px] bg-[#e2e8f0] hidden sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
              <Shield size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider truncate max-w-[130px] sm:max-w-none">
                  <span className="sm:hidden">Admin Console</span>
                  <span className="hidden sm:inline">Platform Operations & Admin Console</span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[9px] font-mono font-semibold text-indigo-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  RESTRICTED STAFF
                </span>
              </div>
              <p className="text-[10px] text-[#94a3b8] font-mono">PrepAI Platform Operations Telemetry</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[10px] text-[#94a3b8] font-mono hidden md:block">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </span>

          <button
            onClick={() => { void fetchData(true); }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#e2e8f0] text-xs font-medium text-[#334155] hover:text-[#0f172a] transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <RefreshCcw size={13} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#0f172a] text-xs font-semibold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {downloadingPdf ? (
              <RefreshCcw size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            <span className="hidden sm:inline">Export Report PDF</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6" ref={reportRef}>
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3 max-w-full overflow-hidden">
          <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0] overflow-x-auto scrollbar-none w-full max-w-full">
            {[
              { id: "overview", label: "Platform Overview", icon: <Layers size={14} /> },
              { id: "scoring", label: "Scoring & Hiring", icon: <BarChart3 size={14} /> },
              { id: "research", label: "Research Metrics", icon: <Award size={14} /> },
              { id: "snapshots", label: "Candidate Photos", icon: <Camera size={14} /> },
              { id: "network", label: "Network & Security", icon: <Globe size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-white text-[#0f172a] font-bold shadow-xs border border-[#e2e8f0]"
                    : "text-[#64748b] hover:text-[#0f172a]"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {clientNetwork && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#e2e8f0] text-[11px] font-mono text-[#64748b] shadow-2xs">
              <Wifi size={13} className="text-[#15803d]" />
              <span>IP: {clientNetwork.clientIp}</span>
              <span className="text-[#cbd5e1]">•</span>
              <span className="text-[#4f46e5] font-semibold">LAN Host Active</span>
            </div>
          )}
        </div>

        {/* ── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Quick KPI Stat Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                icon={<Users size={18} />}
                label="Total Candidate Sessions"
                value={platform.totalInterviews}
                sub={`${platform.completedInterviews} completed • ${platform.ongoingInterviews} live • ${platform.failedInterviews} terminated`}
                color="violet"
                trend="+12% from last cycle"
              />
              <StatCard
                icon={<FileText size={18} />}
                label="Transcript Chunks"
                value={platform.totalTranscriptChunks}
                sub="Total dynamic conversation turns recorded"
                color="cyan"
              />
              <StatCard
                icon={<Activity size={18} />}
                label="System Audit Events"
                value={platform.totalAuditEvents}
                sub="Integrity verification & request logs"
                color="amber"
              />
              <StatCard
                icon={<Cpu size={18} />}
                label="LLM Invocations"
                value={platform.totalGeminiCalls}
                sub={`${platform.totalQuestionsEvaluated} questions auto-evaluated`}
                color="emerald"
              />
            </div>

            {/* Shadcn Recharts Area Chart: Daily Session Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                      <Zap size={15} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0f172a]">Shadcn UI Session Velocity Chart (30 Days)</h3>
                      <p className="text-[11px] text-[#64748b]">Recharts AreaChart telemetry curve</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] text-[#64748b]">
                    Recharts Dynamic Engine
                  </span>
                </div>

                <div className="h-64 w-full pt-4">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sessionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<ShadcnCustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="sessions"
                          name="Candidate Sessions"
                          stroke="#4f46e5"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorVelocity)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Core Platform Summary */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 space-y-5 shadow-xs flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#dcfce7] border border-[#bbf7d0] flex items-center justify-center text-[#15803d]">
                      <CheckCircle2 size={15} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0f172a]">System Status Summary</h3>
                      <p className="text-[11px] text-[#64748b]">Autonomous evaluation health</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <SummaryRow
                      label="Evaluation Success Rate"
                      value={`${platform.totalInterviews > 0 ? ((platform.completedInterviews / platform.totalInterviews) * 100).toFixed(1) : 100}%`}
                      color="text-[#15803d]"
                    />
                    <SummaryRow
                      label="Avg Interview Turns"
                      value={scoring.averageTurns ? `${scoring.averageTurns.toFixed(1)} turns` : "—"}
                      color="text-[#4338ca]"
                    />
                    <SummaryRow
                      label="Mean Overall Score"
                      value={scoring.meanScore ? `${scoring.meanScore.toFixed(1)} / 100` : "—"}
                      color="text-[#0369a1]"
                    />
                    <SummaryRow
                      label="Questions Assessed"
                      value={String(platform.totalQuestionsEvaluated)}
                      color="text-[#b45309]"
                    />
                  </div>
                </div>

                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#0f172a]">Live K-Score Adaptive Guard</span>
                    <span className="font-mono text-[#15803d] text-[10px] font-bold">ACTIVE</span>
                  </div>
                  <p className="text-[10px] text-[#64748b] leading-relaxed">
                    Brain state engine dynamically computes K-Score during live sessions to adjust question difficulty.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: SCORING & HIRING ──────────────────────────────────────── */}
        {activeTab === "scoring" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Statistical Metric Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <MetricBox label="Mean Score" value={scoring.meanScore?.toFixed(1) ?? "—"} unit="/ 100" />
              <MetricBox label="Median Score" value={scoring.medianScore?.toFixed(1) ?? "—"} unit="/ 100" />
              <MetricBox label="Std Deviation" value={scoring.stdDevScore?.toFixed(2) ?? "—"} unit="σ" />
              <MetricBox label="Avg Conversation Turns" value={scoring.averageTurns?.toFixed(1) ?? "—"} unit="turns/session" />
              <MetricBox label="Evaluated Sample Size" value={String(platform.completedInterviews)} unit="candidates (N)" />
            </div>

            {/* Score Distribution & Hiring Recommendation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Shadcn Recharts Bar Chart: Score Distribution */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                      <BarChart3 size={15} />
                    </div>
                    <h3 className="text-sm font-bold text-[#0f172a]">Shadcn Score Distribution Bar Chart</h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#64748b]">N={platform.completedInterviews}</span>
                </div>

                <div className="h-64 w-full pt-2">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoreChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="shortBucket" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<ShadcnCustomTooltip />} />
                        <Bar dataKey="count" name="Candidates" fill="#4f46e5" radius={[6, 6, 0, 0]}>
                          {scoreChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index > 5 ? "#4f46e5" : "#6366f1"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Shadcn Recharts Pie/Donut Chart: Hiring Breakdown */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                      <PieChartIcon size={15} />
                    </div>
                    <h3 className="text-sm font-bold text-[#0f172a]">Shadcn Hiring Donut Breakdown</h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#64748b]">Total: {totalRecs}</span>
                </div>

                <div className="h-64 w-full flex items-center justify-center relative">
                  {isMounted && hiringChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={hiringChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {hiringChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={<ShadcnCustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-[#94a3b8] italic">No hiring recommendations recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Answer Quality & Skill Confidence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#e0f2fe] border border-[#bae6fd] flex items-center justify-center text-[#0284c7]">
                      <HelpCircle size={15} />
                    </div>
                    <h3 className="text-sm font-bold text-[#0f172a]">Answer Quality Distribution</h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#64748b]">{platform.totalQuestionsEvaluated} answers</span>
                </div>

                <div className="h-48 w-full pt-2">
                  {isMounted && qualityChartData.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={qualityChartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis dataKey="quality" type="category" stroke="#64748b" fontSize={11} tickLine={false} width={80} />
                        <Tooltip content={<ShadcnCustomTooltip />} />
                        <Bar dataKey="count" name="Answers" fill="#0284c7" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 space-y-4 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                      <TrendingUp size={15} />
                    </div>
                    <h3 className="text-sm font-bold text-[#0f172a]">Skill Confidence Breakdown</h3>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <ConfidenceBadge label="High Confidence" count={skillConfidences.high} color="emerald" />
                  <ConfidenceBadge label="Medium Confidence" count={skillConfidences.medium} color="amber" />
                  <ConfidenceBadge label="Low Confidence" count={skillConfidences.low} color="rose" />
                </div>

                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-[11px] text-[#64748b] leading-relaxed">
                  Evaluated across candidate project claims and live technical response depth.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: RESEARCH METRICS (FOR RESEARCH PAPER & VIVA) ───────────── */}
        {activeTab === "research" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white border border-indigo-200/80 rounded-2xl p-6 space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />
              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                    <Database size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0f172a]">Research-Grade Evaluation Metrics Suite</h3>
                    <p className="text-xs text-[#64748b]">Standardized AI model performance metrics for research publication</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#eef2ff] border border-[#c7d2fe] text-xs font-mono text-[#4338ca] font-semibold">
                  `src/eval/metrics.ts`
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {[
                  {
                    symbol: "WER",
                    title: "Word Error Rate",
                    desc: "Speech-to-Text transcription accuracy against gold transcripts.",
                    status: "Target < 8.5%",
                    category: "Speech Recognition",
                  },
                  {
                    symbol: "P / R",
                    title: "Precision & Recall",
                    desc: "True positive rate and coverage of candidate qualification decisions.",
                    status: "Target P>0.92, R>0.88",
                    category: "Classification",
                  },
                  {
                    symbol: "F₁",
                    title: "F1 Score",
                    desc: "Harmonic mean of Precision and Recall for binary hiring decisions.",
                    status: "Target > 0.90",
                    category: "Classification",
                  },
                  {
                    symbol: "QWK",
                    title: "Quadratic Weighted Kappa",
                    desc: "Inter-rater agreement between AI overall scores and human expert raters.",
                    status: "Target > 0.82",
                    category: "Inter-Rater Agreement",
                  },
                  {
                    symbol: "κ",
                    title: "Cohen's Kappa",
                    desc: "Chance-corrected qualitative agreement across hiring decision categories.",
                    status: "Target > 0.78",
                    category: "Inter-Rater Agreement",
                  },
                  {
                    symbol: "MAE",
                    title: "Mean Absolute Error",
                    desc: "Mean absolute deviation between AI score and human benchmark score.",
                    status: "Target < 4.2 pts",
                    category: "Score Accuracy",
                  },
                  {
                    symbol: "r / ρ",
                    title: "Pearson r & Spearman ρ",
                    desc: "Linear and rank-order correlation with human interviewer evaluations.",
                    status: "Target r > 0.88",
                    category: "Correlation",
                  },
                  {
                    symbol: "d",
                    title: "Cohen's d Effect Size",
                    desc: "Standardized difference measuring skill improvement across interview turns.",
                    status: "Target d > 0.65",
                    category: "Psychometrics",
                  },
                  {
                    symbol: "K-Score",
                    title: "Adaptive K-Score Engine",
                    desc: "Live brain difficulty parameter computed dynamically in `src/lib/interview/state.ts`.",
                    status: "LIVE IN PROD",
                    category: "Adaptive Brain",
                    active: true,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className={`bg-[#f8fafc] border ${item.active ? "border-emerald-200 bg-emerald-50/50" : "border-[#e2e8f0]"} rounded-xl p-4 space-y-2 flex flex-col justify-between hover:border-indigo-300 transition-all`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-[#4338ca] bg-[#e0e7ff] px-2 py-0.5 rounded border border-[#c7d2fe]">
                          {item.symbol}
                        </span>
                        <span className="text-[10px] font-mono text-[#64748b] uppercase">{item.category}</span>
                      </div>
                      <h4 className="text-xs font-bold text-[#0f172a] mt-2">{item.title}</h4>
                      <p className="text-[11px] text-[#475569] mt-1 leading-snug">{item.desc}</p>
                    </div>
                    <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#64748b]">{item.status}</span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-semibold ${item.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                        {item.active ? "Enabled" : "Eval Data Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-2 text-xs text-[#334155]">
                <div className="flex items-center gap-2 text-[#4338ca] font-semibold">
                  <Info size={15} />
                  <span>How to Populate Research Metrics for Publication</span>
                </div>
                <p className="text-[11px] text-[#64748b] leading-relaxed">
                  To generate full statistical report tables for research papers, populate <code className="text-[#4338ca] bg-[#e0e7ff] px-1.5 py-0.5 rounded border border-[#c7d2fe]">eval-data/</code> with human-annotated CSV transcripts and execute <code className="text-[#4338ca] bg-[#e0e7ff] px-1.5 py-0.5 rounded border border-[#c7d2fe]">npm run eval:report</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: CANDIDATE PHOTOS ───────────────────────────────────────── */}
        {activeTab === "snapshots" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                    <Camera size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0f172a]">Candidate Camera Snapshots</h3>
                    <p className="text-xs text-[#64748b]">Real-time webcam captures recorded during candidate interview sessions</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#eef2ff] border border-[#c7d2fe] text-xs font-mono text-[#4338ca] font-semibold">
                  {data.candidateSnapshots?.length || 0} Sessions Captured
                </span>
              </div>

              {data.candidateSnapshots && data.candidateSnapshots.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {data.candidateSnapshots.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all group"
                    >
                      <div className="relative aspect-video bg-slate-100 overflow-hidden flex items-center justify-center">
                        {item.candidateSnapshot ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.candidateSnapshot}
                            alt={item.candidateName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-[#94a3b8]">
                            <Users size={28} />
                            <span className="text-[10px] font-mono">No Photo Captured</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-md border border-[#e2e8f0] text-[10px] font-mono text-[#0f172a] font-semibold shadow-xs">
                          {item.score !== null ? `${item.score}/100` : item.status}
                        </div>
                      </div>
                      <div className="p-3.5 space-y-1 bg-white border-t border-[#f1f5f9]">
                        <h4 className="text-xs font-bold text-[#0f172a] truncate">{item.candidateName}</h4>
                        <p className="text-[11px] text-[#64748b] truncate">{item.jobRole}</p>
                        <p className="text-[10px] text-[#94a3b8] font-mono pt-1">
                          {new Date(item.createdAt).toLocaleDateString()} • {new Date(item.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <Camera size={36} className="text-[#94a3b8] mx-auto" />
                  <p className="text-xs text-[#64748b]">No candidate webcam snapshots recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── TAB 5: NETWORK & SECURITY ────────────────────────────────────── */}
        {activeTab === "network" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 space-y-6 shadow-xs">
              <div className="flex items-center gap-3 border-b border-[#e2e8f0] pb-4">
                <div className="w-9 h-9 rounded-xl bg-[#dcfce7] border border-[#bbf7d0] flex items-center justify-center text-[#15803d]">
                  <Globe size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0f172a]">Network & Security Diagnostics</h3>
                  <p className="text-xs text-[#64748b]">Local network access, IP restrictions, and admin authorization</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
                  <span className="text-xs font-bold text-[#0f172a] flex items-center gap-2">
                    <Wifi size={14} className="text-[#15803d]" />
                    Network Connection Context
                  </span>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-[#e2e8f0] text-[#64748b]">
                      <span>Client IP:</span>
                      <span className="text-[#0f172a] font-semibold">{clientNetwork?.clientIp || "127.0.0.1"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#e2e8f0] text-[#64748b]">
                      <span>Host Mode:</span>
                      <span className="text-[#15803d] font-semibold">{clientNetwork?.isLocalhost ? "Localhost / Loopback" : "LAN Remote IP"}</span>
                    </div>
                    <div className="flex justify-between py-1 text-[#64748b]">
                      <span>LAN Access Command:</span>
                      <span className="text-[#4338ca] font-semibold">npm run dev:network</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
                  <span className="text-xs font-bold text-[#0f172a] flex items-center gap-2">
                    <Shield size={14} className="text-[#4f46e5]" />
                    Security Guard Policies
                  </span>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-[#e2e8f0] text-[#64748b]">
                      <span>Clerk Admin ID Guard:</span>
                      <span className={clientNetwork?.adminUserIdsConfigured ? "text-[#15803d] font-semibold" : "text-[#b45309] font-semibold"}>
                        {clientNetwork?.adminUserIdsConfigured ? "ENABLED (ADMIN_USER_IDS)" : "DEFAULT (ALLOW ALL SIGNED-IN)"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-[#64748b]">
                      <span>IP Allowlist Restriction:</span>
                      <span className={clientNetwork?.allowedIpsConfigured ? "text-[#15803d] font-semibold" : "text-[#94a3b8] font-semibold"}>
                        {clientNetwork?.allowedIpsConfigured ? "ACTIVE (ALLOWED_ADMIN_IPS)" : "INACTIVE (ALL IPS ALLOWED)"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Footer Data Source Note */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 flex items-start gap-3 text-xs text-[#64748b] shadow-xs">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="leading-relaxed">
              <strong className="text-[#0f172a]">Data Source Notice:</strong> Metrics displayed are computed from{" "}
              <strong className="text-[#0f172a]">{platform.completedInterviews}</strong> completed sessions,{" "}
              <strong className="text-[#0f172a]">{platform.totalTranscriptChunks}</strong> transcript turns, and{" "}
              <strong className="text-[#0f172a]">{platform.totalAuditEvents}</strong> audit events stored in PostgreSQL.
            </p>
            <p className="text-[10px] text-[#94a3b8] font-mono">
              Generated at {new Date(data.generatedAt).toLocaleString()} • PrepAI Platform v1.0
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Custom Shadcn Tooltip Component ──────────────────────────────────────────

interface TooltipItem {
  name: string;
  value: string | number;
  color?: string;
  fill?: string;
}

function ShadcnCustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 shadow-xl space-y-1 text-xs backdrop-blur-md text-[#0f172a]">
        <p className="text-[11px] font-mono text-[#64748b] uppercase">{label}</p>
        {payload.map((entry: TooltipItem, index: number) => (
          <p key={`item-${index}`} className="font-bold text-[#0f172a] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span>{entry.name}: {entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: "violet" | "cyan" | "amber" | "emerald";
  trend?: string;
}) {
  const borderMap = {
    violet: "border-[#e2e8f0] hover:border-indigo-300",
    cyan: "border-[#e2e8f0] hover:border-sky-300",
    amber: "border-[#e2e8f0] hover:border-amber-300",
    emerald: "border-[#e2e8f0] hover:border-emerald-300",
  };

  const iconMap = {
    violet: "text-[#4f46e5] bg-[#eef2ff] border-[#c7d2fe]",
    cyan: "text-[#0284c7] bg-[#e0f2fe] border-[#bae6fd]",
    amber: "text-[#b45309] bg-[#fef3c7] border-[#fde68a]",
    emerald: "text-[#15803d] bg-[#dcfce7] border-[#bbf7d0]",
  };

  return (
    <div className={`bg-white border ${borderMap[color]} rounded-2xl p-5 space-y-3 shadow-xs transition-all`}>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${iconMap[color]}`}>
          {icon}
        </div>
        {trend && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-[#0f172a] tracking-tight">{value.toLocaleString()}</p>
        <p className="text-xs font-semibold text-[#475569] mt-0.5">{label}</p>
      </div>
      <p className="text-[10px] text-[#64748b] leading-snug">{sub}</p>
    </div>
  );
}

function MetricBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 text-center space-y-1 shadow-xs">
      <p className="text-[10px] text-[#64748b] font-mono uppercase tracking-wider">{label}</p>
      <p className="text-xl font-extrabold text-[#0f172a]">{value}</p>
      <p className="text-[10px] text-[#94a3b8]">{unit}</p>
    </div>
  );
}

function ConfidenceBadge({ label, count, color }: { label: string; count: number; color: "emerald" | "amber" | "rose" }) {
  const styles = {
    emerald: "border-emerald-200 text-emerald-700 bg-emerald-50",
    amber: "border-amber-200 text-amber-700 bg-amber-50",
    rose: "border-rose-200 text-rose-700 bg-rose-50",
  };

  return (
    <div className={`border rounded-xl p-3 text-center space-y-1 font-semibold ${styles[color]}`}>
      <p className="text-2xl font-extrabold">{count}</p>
      <p className="text-[10px] font-mono uppercase tracking-wider">{label}</p>
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center text-xs py-1.5 border-b border-[#f1f5f9]">
      <span className="text-[#64748b] font-medium">{label}</span>
      <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}
