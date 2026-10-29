"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignIn, useUser, useClerk } from "@clerk/nextjs";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  ArrowRight,
  LogOut,
  LayoutDashboard,
  Brain,
  AlertTriangle,
} from "lucide-react";

export default function AdminLoginPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      setChecking(true);
      fetch("/api/admin/check")
        .then((res) => res.json())
        .then((data) => {
          if (data.isAdmin) {
            setIsAdmin(true);
            router.replace("/admin");
          } else {
            setIsAdmin(false);
          }
        })
        .catch(() => {
          setIsAdmin(false);
        })
        .finally(() => {
          setChecking(false);
        });
    }
  }, [isSignedIn, router]);

  const candidateEmail = user?.primaryEmailAddress?.emailAddress || "Candidate Account";

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between bg-[#f4f6fa] text-[#0f172a] select-none relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Top Header */}
      <header className="w-full h-16 border-b border-[#e2e8f0] bg-white/80 backdrop-blur-md px-6 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] transition-transform group-hover:scale-105">
            <Brain className="w-4 h-4" />
          </div>
          <span className="font-bold text-base text-[#0f172a] tracking-tight">
            PrepAI
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            Staff Authorization Portal
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-md space-y-6">
          {/* Security Banner Card */}
          <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-sm space-y-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] mx-auto shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#0f172a] tracking-tight">
                Operations & Admin Console
              </h2>
              <p className="text-xs text-[#64748b] leading-relaxed">
                Restricted system. Access is strictly limited to authorized platform administrators and internal evaluators. All access attempts are audited.
              </p>
            </div>
          </div>

          {/* Conditional State: Already Signed in as Non-Admin */}
          {isLoaded && isSignedIn && isAdmin === false && !checking && (
            <div className="p-6 rounded-2xl bg-white border border-amber-200 shadow-md space-y-4">
              <div className="flex items-start gap-3 text-amber-800">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-sm text-[#0f172a]">
                    Non-Administrator Account Detected
                  </p>
                  <p className="text-[#64748b]">
                    You are currently authenticated as{" "}
                    <strong className="text-[#0f172a] font-medium">{candidateEmail}</strong>.
                    This account is not authorized for administrative platform operations.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <Link
                  href="/dashboard"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#4f46e5] text-white text-xs font-semibold text-center hover:bg-[#4338ca] transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Return to Candidate Cockpit</span>
                </Link>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full py-2 px-4 rounded-xl border border-[#e2e8f0] bg-white text-xs font-medium text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out to Switch Accounts</span>
                </button>
              </div>
            </div>
          )}

          {/* Checking status spinner */}
          {isLoaded && isSignedIn && checking && (
            <div className="p-8 rounded-2xl bg-white border border-[#e2e8f0] shadow-sm flex flex-col items-center justify-center space-y-3">
              <div className="w-7 h-7 border-2 border-[#4f46e5] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[#64748b]">Verifying administrative credentials...</p>
            </div>
          )}

          {/* Clerk SignIn form for Unauthenticated users */}
          {(!isSignedIn || (isLoaded && !isSignedIn)) && (
            <div className="flex justify-center">
              <SignIn
                routing="hash"
                fallbackRedirectUrl="/admin"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-md border border-[#e2e8f0] rounded-2xl bg-white w-full",
                    headerTitle: "text-[#0f172a] text-base font-bold",
                    headerSubtitle: "text-[#64748b] text-xs",
                    formButtonPrimary: "bg-[#4f46e5] hover:bg-[#4338ca] text-xs font-semibold rounded-xl",
                    footerActionLink: "text-[#4f46e5] hover:text-[#4338ca] font-medium text-xs",
                  },
                }}
              />
            </div>
          )}

          {/* Candidate Dashboard Link */}
          <div className="text-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#0f172a] transition-colors"
            >
              <span>Looking for candidate technical assessments? Go to Candidate Cockpit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-[#94a3b8] border-t border-[#e2e8f0] bg-white/40">
        PrepAI Autonomous Assessment Architecture • Administrative Audit Zone
      </footer>
    </div>
  );
}
