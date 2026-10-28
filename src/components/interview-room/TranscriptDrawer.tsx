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
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-[#141417]/95 border-l border-white/10 backdrop-blur-2xl flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Live Transcript</span>
          <span className="text-[11px] font-mono text-neutral-400 bg-white/5 px-2 py-0.5 rounded">
            {transcript.length} turns
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Transcript Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {transcript.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
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
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {isAi ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>

                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                    isAi
                      ? "bg-[#181920] border border-white/5 text-neutral-200 rounded-tl-sm"
                      : "bg-purple-600/20 border border-purple-500/30 text-white rounded-tr-sm"
                  }`}
                >
                  <div className="font-semibold text-[10px] text-neutral-400 mb-1 flex items-center justify-between gap-2">
                    <span>{isAi ? "PrepAI" : "You"}</span>
                    <span className="font-mono text-[9px] text-neutral-500">
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
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="max-w-[82%] rounded-2xl px-3.5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 rounded-tr-sm">
              <div className="font-semibold text-[10px] text-emerald-400 mb-1">Speaking...</div>
              <p className="italic">{interimTranscript}</p>
            </div>
          </div>
        )}

        {/* AI Thinking State */}
        {isAiThinking && (
          <div className="flex gap-3 text-xs items-start animate-pulse">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="rounded-2xl px-3.5 py-2 bg-[#181920] border border-white/5 text-neutral-400 rounded-tl-sm flex items-center gap-1.5 font-mono text-[11px]">
              <Sparkles className="w-3 h-3 text-purple-400 animate-spin" />
              <span>Formulating contextual response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error notification */}
      {transcriptError && (
        <div className="p-3 mx-3 mb-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {transcriptError}
        </div>
      )}

      {/* Bottom Input Field for Hybrid Text Response */}
      <div className="p-3 border-t border-white/[0.08] bg-black/40">
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
            className="w-full bg-[#181920] border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-500/60 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!userInput.trim() || turnState !== "user_turn"}
            onClick={() => onSubmit()}
            className="absolute right-2 p-1.5 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-purple-400" />
          </button>
        </div>
        <p className="text-[10px] text-neutral-500 mt-1.5 text-center">
          Equal-citizen typed input. Press <span className="font-mono text-neutral-400">[Enter]</span> to send.
        </p>
      </div>
    </aside>
  );
}
