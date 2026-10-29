"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  Brain,
  Mic,
  Camera,
  Trash2,
  Shield,
  CheckCircle2,
  RotateCcw,
  X,
} from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { useToast } from "@/src/components/ui/ToastProvider";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      .catch(() => {
        // Non-admin or unauthenticated
      });
    return () => {
      ignore = true;
    };
  }, []);
  const handleClearCache = () => {
    try {
      localStorage.removeItem("prepai_interview_draft");
      localStorage.removeItem("prepai_active_session");
      toast("Local session cache cleared successfully.", { type: "success" });
    } catch (e) {
      toast("Failed to clear local storage cache.", { type: "error" });
    }
  };

  const handleResetCookies = () => {
    try {
      localStorage.removeItem("prepai_cookie_consent");
      localStorage.removeItem("intervia_cookie_consent");
      toast("Cookie preferences reset. Reload to re-configure.", { type: "info" });
    } catch (e) {
      toast("Failed to reset cookie preferences.", { type: "error" });
    }
  };

  const handleClearLocalSessions = () => {
    try {
      document.cookie = "prepai_interview_ids=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "intervia_interview_ids=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      toast("Local session tracking unlinked. Refreshing view...", { type: "info" });
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast("Failed to reset session tracking cookies.", { type: "error" });
    }
  };

  const handleTestHardware = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach((track) => track.stop());
        toast("Audio & Camera hardware access verified successfully!", { type: "success" });
      } else {
        toast("Media devices API not available in this environment.", { type: "warning" });
      }
    } catch (err) {
      toast("Microphone or camera permission denied or unavailable.", { type: "warning" });
    }
  };

  return (
    <>
      <aside className="w-56 shrink-0 h-screen border-r border-[#e2e8f0] bg-white flex flex-col justify-between p-4 select-none">
        <div className="space-y-6">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 px-2 group">
            <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] transition-transform group-hover:scale-105 shadow-sm">
              <Brain className="w-4 h-4" />
            </div>
            <span className="font-bold text-base text-[#0f172a] tracking-tight">
              PrepAI
            </span>
          </Link>

          {/* Navigation Items */}
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                pathname === "/dashboard"
                  ? "bg-[#e0e7ff] text-[#3730a3] font-semibold shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]"
              }`}
            >
              <LayoutDashboard
                className={`w-4 h-4 ${
                  pathname === "/dashboard" ? "text-[#4f46e5]" : "text-[#64748b]"
                }`}
              />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/analytics"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                pathname === "/analytics"
                  ? "bg-[#e0e7ff] text-[#3730a3] font-semibold shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]"
              }`}
            >
              <BarChart3
                className={`w-4 h-4 ${
                  pathname === "/analytics" ? "text-[#4f46e5]" : "text-[#64748b]"
                }`}
              />
              <span>Analytics Console</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  pathname === "/admin"
                    ? "bg-[#e0e7ff] text-[#3730a3] font-semibold shadow-xs"
                    : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Shield
                    className={`w-4 h-4 ${
                      pathname === "/admin" ? "text-[#4f46e5]" : "text-[#64748b]"
                    }`}
                  />
                  <span>Admin Console</span>
                </div>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  STAFF
                </span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-all cursor-pointer text-left"
            >
              <Settings className="w-4 h-4 text-[#64748b]" />
              <span>Settings & Preferences</span>
            </button>
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="border-t border-[#e2e8f0] pt-3 px-2 flex items-center gap-2.5">
          <UserButton />
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold text-[#0f172a] truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Candidate Account"}
            </span>
            <span className="text-[10px] text-[#94a3b8] truncate">
              {user?.primaryEmailAddress?.emailAddress || "Authenticated"}
            </span>
          </div>
        </div>
      </aside>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="relative w-full max-w-lg bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-2xl space-y-5 text-[#0f172a]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0f172a]">Settings & Preferences</h3>
                  <p className="text-xs text-[#64748b]">Configure hardware, session storage, and telemetry</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-[#64748b] hover:text-[#0f172a] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hardware Status */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider font-mono">
                Hardware Diagnostics
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <Mic className="w-4 h-4 text-[#4f46e5]" />
                  <div>
                    <div className="text-xs font-semibold text-[#0f172a]">Microphone</div>
                    <div className="text-[10px] text-[#15803d] flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <Camera className="w-4 h-4 text-[#4f46e5]" />
                  <div>
                    <div className="text-xs font-semibold text-[#0f172a]">Camera</div>
                    <div className="text-[10px] text-[#15803d] flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> WebRTC Active
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestHardware}
                className="w-full text-xs text-[#334155] border-[#e2e8f0] hover:bg-[#f1f5f9]"
              >
                Quick Hardware Test
              </Button>
            </div>

            {/* Privacy & Cache */}
            <div className="space-y-2.5 border-t border-[#e2e8f0] pt-4">
              <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider font-mono">
                Privacy & Storage
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <div>
                    <div className="font-semibold text-[#0f172a]">Local Session Cache</div>
                    <div className="text-[11px] text-[#64748b]">Clear temporary interview drafts and active session state</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearCache}
                    className="text-xs gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <div>
                    <div className="font-semibold text-[#0f172a]">Cookie Preferences</div>
                    <div className="text-[11px] text-[#64748b]">Reset cookie consents to change preferences</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetCookies}
                    className="text-xs gap-1.5 text-[#334155] border-[#e2e8f0] hover:bg-[#f1f5f9]"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <div>
                    <div className="font-semibold text-[#0f172a]">Unlink Local Sessions</div>
                    <div className="text-[11px] text-[#64748b]">Unlink guest tracking cookies and start fresh</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearLocalSessions}
                    className="text-xs gap-1.5 text-[#334155] border-[#e2e8f0] hover:bg-[#f1f5f9]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Unlink
                  </Button>
                </div>
              </div>
            </div>

            {/* Platform Version Footer */}
            <div className="border-t border-[#e2e8f0] pt-3 flex items-center justify-between text-xs text-[#64748b]">
              <div className="flex items-center gap-2">
                <Badge variant="purple" className="font-mono text-[10px]">
                  PrepAI v0.1.0 (Build 2026.10)
                </Badge>
                <span className="text-[10px]">Production</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsSettingsOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
