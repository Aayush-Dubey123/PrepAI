"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, FileCheck, Cpu } from "lucide-react";
import { Button } from "@/src/components/ui/actions/Button";

const Orb = dynamic(() => import("@/src/components/ui/visuals/Orb"), {
  ssr: false,
});

export default function Home() {
  const router = useRouter();

  return (
    <main className="relative min-h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-3.5rem)] w-full flex flex-col justify-between items-center overflow-y-auto md:overflow-hidden bg-[#f4f6fa] text-[#0f172a] px-4 py-6 sm:py-8 selection:bg-indigo-500 selection:text-white select-none">
      {/* Background WebGL Shader Orb */}
      <div className="absolute inset-0 z-0 w-full h-full pointer-events-none opacity-40">
        <Orb
          hoverIntensity={0.5}
          rotateOnHover={true}
          hue={240}
          forceHoverState={false}
          backgroundColor="#f4f6fa"
        />
      </div>

      {/* Subtle radial ambient lighting */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.06)_0%,_transparent_65%)]" />

      {/* Top Spacer / Tag */}
      <div className="relative z-10 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-[#e0e7ff] px-3.5 py-1 text-xs font-mono tracking-wider text-[#4338ca] shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>AUTONOMOUS TECHNICAL INTERVIEWS</span>
        </div>
      </div>

      {/* Center Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-4 my-auto">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#0f172a]">
          Prep<span className="text-[#4f46e5]">AI</span>
        </h1>

        <p className="text-sm sm:text-base text-[#475569] font-normal leading-relaxed max-w-lg">
          Voice-first technical interview simulations with adaptive multi-turn probing, real-time webcam proctoring, and instant diagnostic evaluation reports.
        </p>

        {/* Primary CTA */}
        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push("/dashboard")}
            className="text-sm sm:text-base font-semibold px-8 py-3.5 rounded-full gap-2 bg-[#1e293b] hover:bg-[#0f172a] text-white shadow-md cursor-pointer"
          >
            <span>Start Technical Interview</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Bottom Concise Feature Preview Ribbon */}
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#e0e7ff] flex items-center justify-center text-[#4f46e5] shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-[#0f172a]">Adaptive Probing</div>
              <div className="text-[11px] text-[#64748b]">Contextual depth ladders & dynamic follow-ups</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-[#f0f9ff] border border-[#e0f2fe] flex items-center justify-center text-[#0284c7] shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-[#0f172a]">Integrity Guard</div>
              <div className="text-[11px] text-[#64748b]">MediaPipe baseline face & orientation tracking</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-[#ecfdf5] border border-[#d1fae5] flex items-center justify-center text-[#059669] shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-[#0f172a]">Diagnostic Report</div>
              <div className="text-[11px] text-[#64748b]">Score rubric, model answers & PDF export</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
