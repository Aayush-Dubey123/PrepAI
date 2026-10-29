import Link from "next/link";
import { Brain } from "lucide-react";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] w-full flex flex-col items-center justify-center p-4 bg-[#f4f6fa] text-[#0f172a] overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] shadow-xs transition-transform group-hover:scale-105">
            <Brain className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-[#0f172a] tracking-tight">
            PrepAI
          </span>
        </Link>

        <div className="rounded-2xl shadow-xl border border-[#e2e8f0] bg-white overflow-hidden">
          <SignUp />
        </div>
      </div>
    </div>
  );
}
