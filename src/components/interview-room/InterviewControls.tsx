"use client";

import React from "react";
import { Mic, MicOff, Camera, CameraOff, MessageSquare, PhoneOff, HelpCircle, RotateCcw, Check } from "lucide-react";
import { Button } from "@/src/components/ui/Button";

export interface InterviewControlsProps {
  isListening: boolean;
  isCameraOn: boolean;
  isAiSpeaking: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleTranscript: () => void;
  isTranscriptOpen: boolean;
  onQuickPrompt: (promptText: string) => void;
  onEndCall: () => void;
  supportsSpeechRecognition: boolean;
}

export function InterviewControls({
  isListening,
  isCameraOn,
  isAiSpeaking,
  onToggleMic,
  onToggleCamera,
  onToggleTranscript,
  isTranscriptOpen,
  onQuickPrompt,
  onEndCall,
  supportsSpeechRecognition,
}: InterviewControlsProps) {
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-2xl mx-auto">
      {/* Quick Prompt Chips */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => onQuickPrompt("Could you please repeat or rephrase the question?")}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0] text-[#475569] hover:text-[#0f172a] hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition-all cursor-pointer shadow-2xs"
        >
          <RotateCcw className="w-3 h-3 text-[#4f46e5]" />
          <span>Repeat Question</span>
        </button>

        <button
          type="button"
          onClick={() => onQuickPrompt("Could you provide a hint or narrow the scope of what you are looking for?")}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0] text-[#475569] hover:text-[#0f172a] hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition-all cursor-pointer shadow-2xs"
        >
          <HelpCircle className="w-3 h-3 text-amber-500" />
          <span>Need a Hint</span>
        </button>

        <button
          type="button"
          onClick={() => onQuickPrompt("I have completed my answer. Let's move to the next part.")}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0] text-[#475569] hover:text-[#0f172a] hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition-all cursor-pointer shadow-2xs"
        >
          <Check className="w-3 h-3 text-emerald-600" />
          <span>Finished Answer</span>
        </button>
      </div>

      {/* Floating Glass Dock */}
      <div className="flex items-center gap-3 sm:gap-4 px-5 py-3 rounded-2xl bg-white/95 border border-[#e2e8f0] shadow-xl backdrop-blur-xl">
        {/* Mic / Push to Talk */}
        {supportsSpeechRecognition ? (
          <Button
            variant={isListening ? "glow" : "secondary"}
            size="md"
            onClick={onToggleMic}
            className={`h-11 px-4 gap-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              isListening ? "bg-[#4f46e5] text-white shadow-md shadow-indigo-500/20" : ""
            }`}
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 text-white animate-pulse" />
                <span>Listening... [M]</span>
              </>
            ) : isAiSpeaking ? (
              <>
                <Mic className="w-4 h-4 text-amber-500" />
                <span>Barge-in [M]</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-[#4f46e5]" />
                <span>Speak [M]</span>
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="md"
            onClick={onToggleTranscript}
            className="h-11 px-4 gap-2 rounded-xl text-xs"
          >
            <MicOff className="w-4 h-4 text-[#64748b]" />
            <span>Type Answer</span>
          </Button>
        )}

        {/* Camera Toggle */}
        <Button
          variant={isCameraOn ? "secondary" : "outline"}
          size="icon"
          onClick={onToggleCamera}
          className="h-11 w-11 rounded-xl"
          title={isCameraOn ? "Mute camera preview" : "Enable camera preview"}
        >
          {isCameraOn ? (
            <Camera className="w-4 h-4 text-[#334155]" />
          ) : (
            <CameraOff className="w-4 h-4 text-rose-500" />
          )}
        </Button>

        {/* Transcript Drawer Toggle */}
        <Button
          variant={isTranscriptOpen ? "primary" : "secondary"}
          size="icon"
          onClick={onToggleTranscript}
          className="h-11 w-11 rounded-xl"
          title="Toggle transcript drawer"
        >
          <MessageSquare className="w-4 h-4" />
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-[#e2e8f0]" />

        {/* End Interview */}
        <Button
          variant="danger"
          size="md"
          onClick={onEndCall}
          className="h-11 px-4 gap-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="hidden sm:inline">End Call</span>
        </Button>
      </div>
    </div>
  );
}
