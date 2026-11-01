"use client";

import React from "react";
import { Mic, Camera, CameraOff, MessageSquare, PhoneOff, HelpCircle, RotateCcw, Check, Sparkles } from "lucide-react";

export interface InterviewControlsProps {
  isListening: boolean;
  isCameraOn: boolean;
  isAiSpeaking: boolean;
  isProcessing?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleTranscript: () => void;
  isTranscriptOpen: boolean;
  onQuickPrompt: (promptText: string) => void;
  onFinishedAnswer?: () => void;
  onEndCall: () => void;
  supportsSpeechRecognition: boolean;
}

export function InterviewControls({
  isListening,
  isCameraOn,
  isAiSpeaking,
  isProcessing = false,
  onToggleMic,
  onToggleCamera,
  onToggleTranscript,
  isTranscriptOpen,
  onQuickPrompt,
  onFinishedAnswer,
  onEndCall,
  supportsSpeechRecognition,
}: InterviewControlsProps) {
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-2xl mx-auto">
      {/* Quick Prompt Chips */}
      <div className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 max-w-full overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-nowrap sm:flex-wrap px-1">
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => onQuickPrompt("Could you please repeat or rephrase the question?")}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full bg-white border border-[#e2e8f0] text-[#475569] hover:text-[#0f172a] hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#4f46e5]" />
          <span>Repeat Question</span>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => onQuickPrompt("Could you provide a hint or narrow the scope of what you are looking for?")}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full bg-white border border-[#e2e8f0] text-[#475569] hover:text-[#0f172a] hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
          <span>Need a Hint</span>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={onFinishedAnswer || (() => onQuickPrompt("I have completed my answer. Let's move to the next part."))}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full bg-white border border-[#e2e8f0] text-[#475569] hover:text-[#0f172a] hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>Finished Answer</span>
        </button>
      </div>

      {/* Floating Glass Dock */}
      <div className="flex items-center flex-nowrap gap-1.5 sm:gap-4 px-2.5 sm:px-5 py-2 sm:py-3 rounded-2xl bg-white/95 border border-[#e2e8f0] shadow-xl backdrop-blur-xl max-w-full overflow-x-auto scrollbar-none">
        {/* Mic / Push to Talk */}
        {supportsSpeechRecognition ? (
          <button
            type="button"
            disabled={isProcessing}
            onClick={onToggleMic}
            className={`inline-flex items-center justify-center h-10 px-3 sm:h-11 sm:px-4 gap-1.5 sm:gap-2 rounded-xl text-xs sm:text-sm font-semibold transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 active:scale-[0.98] shrink-0 pointer-events-auto ${
              isProcessing
                ? "bg-[#6366f1] text-white shadow-md shadow-indigo-500/20 cursor-wait opacity-95"
                : isListening
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 cursor-pointer"
                : isAiSpeaking
                ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                : "bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-md shadow-indigo-500/20 cursor-pointer"
            }`}
          >
            {isProcessing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-purple-200" />
                <span>Evaluating...</span>
              </>
            ) : isListening ? (
              <>
                <Mic className="w-4 h-4 text-white animate-pulse" />
                <span>Mute Mic <span className="hidden sm:inline">[M]</span></span>
              </>
            ) : isAiSpeaking ? (
              <>
                <Mic className="w-4 h-4 text-amber-600" />
                <span>Barge-in <span className="hidden sm:inline">[M]</span></span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-white" />
                <span>Unmute Mic <span className="hidden sm:inline">[M]</span></span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleTranscript}
            className="inline-flex items-center justify-center h-10 px-3 sm:h-11 sm:px-4 gap-2 rounded-xl text-xs font-semibold shrink-0 pointer-events-auto cursor-pointer bg-[#f1f5f9] hover:bg-[#e2e8f0] border border-[#e2e8f0] text-[#334155] transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 active:scale-[0.98]"
          >
            <MessageSquare className="w-4 h-4 text-[#4f46e5]" />
            <span>Type Answer</span>
          </button>
        )}

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className="inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl shrink-0 pointer-events-auto cursor-pointer bg-[#f1f5f9] hover:bg-[#e2e8f0] border border-[#e2e8f0] text-[#334155] transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 active:scale-[0.98]"
          title={isCameraOn ? "Mute camera preview" : "Enable camera preview"}
        >
          {isCameraOn ? (
            <Camera className="w-4 h-4 text-[#334155]" />
          ) : (
            <CameraOff className="w-4 h-4 text-rose-500" />
          )}
        </button>

        {/* Transcript Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleTranscript}
          className={`inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl shrink-0 pointer-events-auto cursor-pointer border transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 active:scale-[0.98] ${
            isTranscriptOpen
              ? "bg-[#4f46e5] text-white border-transparent hover:bg-[#4338ca] shadow-xs"
              : "bg-[#f1f5f9] border-[#e2e8f0] text-[#334155] hover:bg-[#e2e8f0]"
          }`}
          title="Toggle transcript drawer"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-[#e2e8f0]" />

        {/* End Interview */}
        <button
          type="button"
          onClick={onEndCall}
          className="inline-flex items-center justify-center h-10 px-3 sm:h-11 sm:px-4 gap-1.5 sm:gap-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 active:scale-[0.98] shrink-0 pointer-events-auto"
        >
          <PhoneOff className="w-4 h-4 text-rose-600" />
          <span>End Call</span>
        </button>
      </div>
    </div>
  );
}
