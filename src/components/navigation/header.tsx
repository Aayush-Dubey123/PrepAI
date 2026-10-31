"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ChevronRight, ShieldCheck, LogOut, Sparkles, BarChart3, LayoutDashboard, Brain } from "lucide-react";
import { Badge } from "@/src/components/ui/actions/Badge";
import { Button } from "@/src/components/ui/actions/Button";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAbout, setShowAbout] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/check")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data?.isAdmin) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);
  // 1. Marketing Mode: strictly root ("/")
  const isMarketing = pathname === "/";

  // 2. Live Interview Stage: /interview/[id] (NOT lobby, NOT feedback)
  // To avoid duplicate headers, the live stage page renders its own specialized InterviewHeader.
  const isLobby = pathname.endsWith("/lobby");
  const isFeedback = pathname.endsWith("/feedback");
  const isLiveStage =
    pathname.startsWith("/interview/") && !isLobby && !isFeedback;

  if (
    isLiveStage ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/practice") ||
    pathname.startsWith("/gym")
  ) {
    return null;
  }

  // Extract interview session ID if on feedback or lobby
  const interviewIdMatch = pathname.match(/\/interview\/([^/]+)/);
  const interviewId = interviewIdMatch ? interviewIdMatch[1] : null;

  // Lobby Header Mode
  if (isLobby) {
    return (
      <>
        <header className="sticky top-0 z-40 h-14 w-full bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] transition-transform group-hover:scale-105">
                <Brain className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[#0f172a] tracking-tight">
                PrepAI
              </span>
            </Link>
            <div className="h-4 w-px bg-[#e2e8f0] hidden sm:block" />
            <span className="text-xs text-[#64748b] font-medium hidden sm:inline-flex items-center gap-1.5">
              Pre-Flight Hardware Calibration
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="purple" pulse className="px-2.5 py-0.5 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Proctored
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExitConfirm(true)}
              className="text-[#64748b] hover:text-rose-600 hover:bg-rose-50 gap-1.5 h-8 text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit to Dashboard</span>
            </Button>
          </div>
        </header>

        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white border border-[#e2e8f0] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-[#0f172a]">Exit Calibration?</h3>
              <p className="text-xs text-[#64748b] leading-relaxed">
                Are you sure you want to exit? Your session is saved and you can return to it anytime from your dashboard.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExitConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setShowExitConfirm(false);
                    router.push("/dashboard");
                  }}
                >
                  Confirm Exit
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // App Mode Header (for other app pages)
  if (!isMarketing) {
    return (
      <header className="sticky top-0 z-40 h-14 w-full bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] px-4 sm:px-8 flex items-center justify-between">
        {/* Left: Brand + Breadcrumbs */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] transition-transform group-hover:scale-105">
              <Brain className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm sm:text-base text-[#0f172a] tracking-tight">
              PrepAI
            </span>
          </Link>

          <ChevronRight className="w-3.5 h-3.5 text-[#cbd5e1] shrink-0" />

          {/* Interactive Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium min-w-0">
            <Link
              href="/dashboard"
              className={
                pathname === "/dashboard"
                  ? "text-[#0f172a] font-bold"
                  : "hidden sm:inline text-[#64748b] hover:text-[#0f172a] transition-colors"
              }
            >
              Dashboard
            </Link>

            {isFeedback && interviewId && (
              <>
                <ChevronRight className="w-3 h-3 text-[#cbd5e1] hidden sm:inline" />
                <span className="text-[#64748b] font-mono text-xs hidden md:inline">
                  #{interviewId.slice(0, 8)}
                </span>
                <ChevronRight className="w-3 h-3 text-[#cbd5e1] hidden sm:inline" />
                <span className="text-[#4f46e5] font-semibold truncate max-w-[120px] sm:max-w-none">Evaluation</span>
              </>
            )}

            {pathname === "/analytics" && (
              <>
                <ChevronRight className="w-3 h-3 text-[#cbd5e1] hidden sm:inline" />
                <span className="text-[#4f46e5] font-semibold truncate max-w-[140px] sm:max-w-none">Performance Analytics</span>
              </>
            )}

            {pathname === "/admin" && (
              <>
                <ChevronRight className="w-3 h-3 text-[#cbd5e1] hidden sm:inline" />
                <span className="text-[#4f46e5] font-semibold truncate max-w-[140px] sm:max-w-none">Admin Telemetry</span>
              </>
            )}

            {pathname.startsWith("/practice") && (
              <>
                <ChevronRight className="w-3 h-3 text-[#cbd5e1] hidden sm:inline" />
                <span className="text-[#4f46e5] font-semibold truncate max-w-[140px] sm:max-w-none">Technical Practice</span>
              </>
            )}
          </div>
        </div>

        {/* Center/Right: Navigation links + Clerk UserButton */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-medium">
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 transition-colors px-2.5 py-1.5 rounded-lg ${
              pathname === "/dashboard"
                ? "bg-[#eef2ff] text-[#4f46e5] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Dashboard</span>
          </Link>

          <Link
            href="/analytics"
            className={`flex items-center gap-1.5 transition-colors px-2.5 py-1.5 rounded-lg ${
              pathname === "/analytics"
                ? "bg-[#eef2ff] text-[#4f46e5] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Analytics</span>
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 transition-colors px-2.5 py-1.5 rounded-lg ${
                pathname === "/admin"
                  ? "bg-[#eef2ff] text-[#4f46e5] font-semibold"
                  : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}
          <div className="h-4 w-px bg-[#e2e8f0] mx-1" />
          <UserButton />
        </div>
      </header>
    );
  }

  // Marketing Mode Header ("/")
  return (
    <>
      <header className="sticky top-0 z-50 h-14 w-full bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] px-4 sm:px-8 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] transition-transform group-hover:scale-105">
            <Brain className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm sm:text-base text-[#0f172a] tracking-tight">
            PrepAI
          </span>
        </Link>

        {/* Navigation & Auth */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer px-2 py-1"
          >
            About
          </button>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="text-[#334155] hover:text-[#0f172a] transition-colors px-2 py-1 cursor-pointer">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="bg-[#1e293b] text-white font-semibold text-xs rounded-full px-3.5 py-1.5 transition-all hover:bg-[#0f172a] active:scale-95 shadow-xs cursor-pointer">
                Sign up
              </button>
            </SignUpButton>
          </Show>

          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 bg-[#1e293b] text-white font-semibold text-xs rounded-full px-3.5 py-1.5 hover:bg-[#0f172a] transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#818cf8]" />
              <span>Cockpit</span>
            </Link>
            <UserButton />
          </Show>
        </div>
      </header>

      {/* About Modal */}
      {showAbout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 animate-in fade-in duration-200"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white rounded-2xl p-4 sm:p-6 border border-[#e2e8f0] text-[#0f172a] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                  <Brain className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#0f172a] tracking-tight">
                  About PrepAI
                </h3>
              </div>
              <button
                onClick={() => setShowAbout(false)}
                className="text-[#64748b] hover:text-[#0f172a] text-xl leading-none p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              PrepAI is a Tier-1 autonomous technical interview platform powered by adaptive AI models.
              It conducts dynamic code evaluations, real-time voice & text technical dialogue, and instant candidate feedback loops.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-1">
                <div className="font-bold text-[#0f172a]">Adaptive Probing</div>
                <div className="text-[#64748b] text-[11px]">Contextual multi-turn depth scaling.</div>
              </div>
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-1">
                <div className="font-bold text-[#0f172a]">Instant Scoring</div>
                <div className="text-[#64748b] text-[11px]">Comprehensive feedback and breakdown reports.</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAbout(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
