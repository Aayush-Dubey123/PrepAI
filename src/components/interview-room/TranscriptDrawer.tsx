"use client";

import React, { useEffect, useRef } from "react";
import { X, Send, Bot, User, Sparkles } from "lucide-react";
import { type TranscriptEntry } from "@/src/hooks/useTurnOrchestrator";

export interface TranscriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: TranscriptEntry[];
  interimTranscript: string;
  userInput: string;
  onUserInputChange: (val: string) => void;
  onSubmit: (text?: string) => void;
  turnState: string;
  isAiThinking: boolean;
  onBargeIn: () => void;
  transcriptError: string | null;
}

export function TranscriptDrawer({
  isOpen,
  onClose,
  transcript,
  interimTranscript,
  userInput,
  onUserInputChange,
  onSubmit,
  turnState,
  isAiThinking,
  onBargeIn,
  transcriptError,
}: TranscriptDrawerProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimTranscript]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (userInput.trim().length > 0 && turnState === "user_turn") {
        onSubmit();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Dismissal backdrop overlay to isolate drawer and block accidental background clicks */}
      <div
        className="fixed inset-0 z-[35] bg-black/30 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white/95 border-l border-[#e2e8f0] text-[#0f172a] backdrop-blur-2xl flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#e2e8f0] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#0f172a]">Live Transcript</span>
          <span className="text-[11px] font-mono text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] px-2 py-0.5 rounded">
            {transcript.length} turns
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
          title="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Transcript Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {transcript.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#64748b]">
            Transcript is empty. Dialogue turns will appear here in real-time.
          </div>
        ) : (
          transcript.map((entry) => {
            const isAi = entry.speaker === "ai";

            return (
              <div
                key={entry.id}
                className={`flex gap-3 text-xs leading-relaxed ${
                  isAi ? "items-start" : "items-start flex-row-reverse"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isAi
                      ? "bg-[#eef2ff] text-[#4f46e5] border border-[#c7d2fe]"
                      : "bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]"
                  }`}
                >
                  {isAi ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>

                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                    isAi
                      ? "bg-[#f1f5f9] border border-[#e2e8f0] text-[#0f172a] rounded-tl-sm"
                      : "bg-[#e0e7ff] border border-[#c7d2fe] text-[#3730a3] rounded-tr-sm"
                  }`}
                >
                  <div className="font-semibold text-[10px] text-[#64748b] mb-1 flex items-center justify-between gap-2">
                    <span>{isAi ? "PrepAI" : "You"}</span>
                    <span className="font-mono text-[9px] text-[#94a3b8]">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                </div>
              </div>
            );
          })
        )}

        {/* Interim spoken transcript */}
        {interimTranscript && (
          <div className="flex gap-3 text-xs items-start flex-row-reverse animate-pulse">
            <div className="w-6 h-6 rounded-lg bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0] flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="max-w-[82%] rounded-2xl px-3.5 py-2.5 bg-[#dcfce7]/40 border border-[#bbf7d0] text-[#15803d] rounded-tr-sm">
              <div className="font-semibold text-[10px] text-[#15803d] mb-1">Speaking...</div>
              <p className="italic">{interimTranscript}</p>
            </div>
          </div>
        )}

        {/* AI Thinking State */}
        {isAiThinking && (
          <div className="flex gap-3 text-xs items-start animate-pulse">
            <div className="w-6 h-6 rounded-lg bg-[#eef2ff] text-[#4f46e5] border border-[#c7d2fe] flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="rounded-2xl px-3.5 py-2 bg-[#f1f5f9] border border-[#e2e8f0] text-[#64748b] rounded-tl-sm flex items-center gap-1.5 font-mono text-[11px]">
              <Sparkles className="w-3 h-3 text-[#4f46e5] animate-spin" />
              <span>Formulating contextual response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error notification */}
      {transcriptError && (
        <div className="p-3 mx-3 mb-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {transcriptError}
        </div>
      )}

      {/* Bottom Input Field for Hybrid Text Response */}
      <div className="p-3 border-t border-[#e2e8f0] bg-[#f8fafc]">
        <div className="relative flex items-center">
          <input
            type="text"
            value={userInput}
            onChange={(e) => {
              onUserInputChange(e.target.value);
              onBargeIn(); // Barge-in on candidate typing
            }}
            onFocus={() => onBargeIn()}
            onKeyDown={handleKeyDown}
            placeholder={
              turnState === "user_turn"
                ? "Type your response and hit [Enter]..."
                : "Waiting for AI turn..."
            }
            disabled={turnState !== "user_turn"}
            className="w-full bg-white border border-[#e2e8f0] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!userInput.trim() || turnState !== "user_turn"}
            onClick={() => onSubmit()}
            className="absolute right-2 p-1.5 rounded-lg text-[#64748b] hover:text-[#4f46e5] disabled:opacity-30 disabled:hover:text-[#64748b] transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-[#94a3b8] mt-1.5 text-center">
          Equal-citizen typed input. Press <span className="font-mono text-[#64748b]">[Enter]</span> to send.
        </p>
      </div>
    </aside>
    </>
  );
}
