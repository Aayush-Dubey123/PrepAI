"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { Textarea } from "@/src/components/ui/Textarea";
import { Input } from "@/src/components/ui/Input";
import { useSpeechInput } from "@/src/hooks/useSpeechInput";
import {
  Mic,
  MicOff,
  Lightbulb,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { ClientQuestionPayload } from "@/src/schemas/drills";

interface RendererProps {
  payload: ClientQuestionPayload;
  value: unknown;
  onChange: (val: unknown) => void;
  disabled?: boolean;
}

export function McqRenderer({ payload, value, onChange, disabled }: RendererProps) {
  if (payload.type !== "mcq") return null;
  const selected = typeof value === "string" ? value : "";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {payload.options.map((opt) => {
          const isSelected = selected === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.key)}
              className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 focus:outline-hidden ${
                isSelected
                  ? "bg-indigo-50/80 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-300"
                  : "bg-white border-[#e2e8f0] text-[#1e293b] hover:bg-slate-50/80 hover:border-slate-300"
              } ${disabled ? "opacity-75 cursor-default" : "cursor-pointer"}`}
            >
              <div
                className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-[#f8fafc] border-[#cbd5e1] text-[#64748b]"
                }`}
              >
                {opt.key}
              </div>
              <span className="text-xs font-medium leading-relaxed pt-0.5">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MultiSelectRenderer({ payload, value, onChange, disabled }: RendererProps) {
  if (payload.type !== "multi_select") return null;
  const selectedSet = new Set(Array.isArray(value) ? value.map(String) : []);

  const toggleKey = (key: string) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[#64748b] font-medium">Select all options that apply:</p>
      <div className="space-y-2">
        {payload.options.map((opt) => {
          const isSelected = selectedSet.has(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              disabled={disabled}
              onClick={() => toggleKey(opt.key)}
              className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 focus:outline-hidden ${
                isSelected
                  ? "bg-indigo-50/80 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-300"
                  : "bg-white border-[#e2e8f0] text-[#1e293b] hover:bg-slate-50/80 hover:border-slate-300"
              } ${disabled ? "opacity-75 cursor-default" : "cursor-pointer"}`}
            >
              <div
                className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center shrink-0 border ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-[#f8fafc] border-[#cbd5e1] text-[#64748b]"
                }`}
              >
                {isSelected ? <Check className="w-3.5 h-3.5" /> : opt.key}
              </div>
              <span className="text-xs font-medium leading-relaxed pt-0.5">{opt.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ShortAnswerRenderer({ payload, value, onChange, disabled }: RendererProps) {
  if (payload.type !== "short_answer") return null;
  const text = typeof value === "string" ? value : "";
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const maxWords = payload.max_words ?? 200;

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your structured technical answer here..."
        className="min-h-[160px] text-xs leading-relaxed font-normal bg-white resize-y"
      />
      <div className="flex items-center justify-between text-[11px] text-[#64748b]">
        <span>Aim for conciseness and technical accuracy.</span>
        <span className={wordCount > maxWords ? "text-rose-600 font-bold" : ""}>
          {wordCount} / {maxWords} words
        </span>
      </div>
    </div>
  );
}

export function ScenarioRenderer({ payload, value, onChange, disabled }: RendererProps) {
  if (payload.type !== "scenario") return null;
  const text = typeof value === "string" ? value : "";
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const maxWords = payload.max_words ?? 400;

  return (
    <div className="space-y-4">
      {payload.context && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-[#334155] space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Scenario Context</span>
          <p className="text-xs leading-relaxed font-medium italic">{payload.context}</p>
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Outline your architectural solution, tradeoffs, and failure mitigation..."
          className="min-h-[180px] text-xs leading-relaxed font-normal bg-white resize-y"
        />
        <div className="flex items-center justify-between text-[11px] text-[#64748b]">
          <span>Address tradeoffs, bottlenecks, and recovery mechanisms.</span>
          <span className={wordCount > maxWords ? "text-rose-600 font-bold" : ""}>
            {wordCount} / {maxWords} words
          </span>
        </div>
      </div>
    </div>
  );
}

export function CodeTraceRenderer({ payload, value, onChange, disabled }: RendererProps) {
  if (payload.type !== "code_trace") return null;
  const ans = typeof value === "string" ? value : "";

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#0f172a] shadow-inner">
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span>{payload.language}</span>
          <span className="text-[10px] text-slate-500">Trace execution output</span>
        </div>
        <pre className="p-4 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
          <code>{payload.code}</code>
        </pre>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#0f172a]">Expected Output (Exact string/number):</label>
        <Input
          type="text"
          disabled={disabled}
          value={ans}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 42 or [1, 2, 3] or true"
          className="font-mono text-xs bg-white"
        />
      </div>
    </div>
  );
}

export function FixTheBugRenderer({ payload, value, onChange, disabled }: RendererProps) {
  if (payload.type !== "fix_the_bug") return null;
  const code = typeof value === "string" ? value : payload.buggy_code;
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (value === undefined || value === "") {
      onChange(payload.buggy_code);
    }
  }, [payload.buggy_code, value, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#0f172a]">Edit code to fix the defect:</span>
        {payload.hint && (
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{showHint ? "Hide Hint" : "Show Hint"}</span>
          </button>
        )}
      </div>

      {showHint && payload.hint && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{payload.hint}</span>
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#0f172a] shadow-inner">
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-slate-400">
          {payload.language} — code editor
        </div>
        <textarea
          disabled={disabled}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-4 font-mono text-xs text-emerald-400 bg-transparent resize-y min-h-[160px] focus:outline-hidden"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export function StarPromptRenderer({ payload, value, onChange, disabled }: RendererProps) {
  if (payload.type !== "star_prompt") return null;
  const starObj = (value && typeof value === "object" ? value : {}) as Record<string, string>;

  const updateField = (field: "situation" | "task" | "action" | "result", text: string) => {
    if (disabled) return;
    const next = { ...starObj, [field]: text };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {payload.situation_hint && (
        <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>{payload.situation_hint}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">1. Situation</label>
          <Textarea
            disabled={disabled}
            value={starObj.situation || ""}
            onChange={(e) => updateField("situation", e.target.value)}
            placeholder="What was the business context, outage, or project background?"
            className="min-h-[100px] text-xs bg-white resize-y"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">2. Task</label>
          <Textarea
            disabled={disabled}
            value={starObj.task || ""}
            onChange={(e) => updateField("task", e.target.value)}
            placeholder="What were you specifically responsible for delivering or fixing?"
            className="min-h-[100px] text-xs bg-white resize-y"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">3. Action (Your Initiative)</label>
          <Textarea
            disabled={disabled}
            value={starObj.action || ""}
            onChange={(e) => updateField("action", e.target.value)}
            placeholder="What concrete engineering steps and decisions did YOU take?"
            className="min-h-[100px] text-xs bg-white resize-y"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">4. Result (Metrics)</label>
          <Textarea
            disabled={disabled}
            value={starObj.result || ""}
            onChange={(e) => updateField("result", e.target.value)}
            placeholder="What was the measurable outcome, latency drop, or SLA result?"
            className="min-h-[100px] text-xs bg-white resize-y"
          />
        </div>
      </div>
    </div>
  );
}

export function VoiceAnswerRenderer({ payload, value, onChange, disabled }: RendererProps) {
  if (payload.type !== "voice_answer") return null;
  const text = typeof value === "string" ? value : "";
  const maxDuration = payload.max_duration_seconds ?? 120;
  const [secondsLeft, setSecondsLeft] = useState(maxDuration);

  const { isListening, interimTranscript, startListening, stopListening, supportsSpeechRecognition } =
    useSpeechInput({
      onFinalTranscript: (chunk) => {
        const next = text ? `${text} ${chunk}` : chunk;
        onChange(next.trim());
      },
    });

  // Countdown timer while speaking
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          stopListening();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isListening, stopListening]);

  return (
    <div className="space-y-4">
      {/* Speech Control Bar */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled || !supportsSpeechRecognition}
            onClick={() => (isListening ? stopListening() : startListening())}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-xs ${
              isListening
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <div>
            <div className="text-xs font-bold text-[#0f172a]">
              {isListening ? "Listening... Speak your answer" : "Click microphone to record"}
            </div>
            <div className="text-[11px] text-[#64748b]">
              {isListening ? `${secondsLeft}s remaining (max ${maxDuration}s)` : "Or type directly in the box below"}
            </div>
          </div>
        </div>

        {isListening && (
          <div className="w-24 bg-rose-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-rose-600 h-full transition-all duration-1000"
              style={{ width: `${(secondsLeft / maxDuration) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Live Transcript / Fallback text */}
      <div className="space-y-2">
        {interimTranscript && (
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 italic">
            &ldquo;{interimTranscript}&rdquo;
          </div>
        )}

        <Textarea
          disabled={disabled}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Speech transcript will appear here. You can also edit or type manually..."
          className="min-h-[140px] text-xs bg-white leading-relaxed resize-y"
        />
      </div>
    </div>
  );
}

export function QuestionDispatcher({ payload, value, onChange, disabled }: RendererProps) {
  switch (payload.type) {
    case "mcq":
      return <McqRenderer payload={payload} value={value} onChange={onChange} disabled={disabled} />;
    case "multi_select":
      return <MultiSelectRenderer payload={payload} value={value} onChange={onChange} disabled={disabled} />;
    case "short_answer":
      return <ShortAnswerRenderer payload={payload} value={value} onChange={onChange} disabled={disabled} />;
    case "scenario":
      return <ScenarioRenderer payload={payload} value={value} onChange={onChange} disabled={disabled} />;
    case "code_trace":
      return <CodeTraceRenderer payload={payload} value={value} onChange={onChange} disabled={disabled} />;
    case "fix_the_bug":
      return <FixTheBugRenderer payload={payload} value={value} onChange={onChange} disabled={disabled} />;
    case "star_prompt":
      return <StarPromptRenderer payload={payload} value={value} onChange={onChange} disabled={disabled} />;
    case "voice_answer":
      return <VoiceAnswerRenderer payload={payload} value={value} onChange={onChange} disabled={disabled} />;
    default:
      return <ShortAnswerRenderer payload={payload} value={value} onChange={onChange} disabled={disabled} />;
  }
}
