/**
 * Interview Room Component Smoke Verification
 *
 * Exercises rendering and DOM tree verification for:
 * 1. InterviewerTile (Dual visual modes, Persona Core ripple rings, Dialogue Card in all turn states)
 * 2. InterviewHeader (Proctoring mode, Fullscreen toggle, Explanatory disabled state)
 * 3. IntegrityAlertBanner (Visual guidance nudges vs Verified strikes vs Termination)
 */

import React from "react";
import { renderToString } from "react-dom/server";
import { InterviewerTile } from "@/src/components/interview-room/tiles/InterviewerTile";
import { InterviewHeader } from "@/src/components/interview-room/chrome/InterviewHeader";
import { IntegrityAlertBanner } from "@/src/components/interview-room/chrome/IntegrityAlertBanner";
import { InterviewHistory } from "@/src/components/dashboard/interview-history";
import { ToastProvider } from "@/src/components/ui/feedback/ToastProvider";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log("\n=======================================================");
console.log("       INTERVIEW ROOM SMOKE VERIFICATION SUITE         ");
console.log("=======================================================\n");

let passedCount = 0;

// 1. InterviewerTile: AI Speaking Turn State & Dialogue Card
console.log("▶ Test 1: InterviewerTile in 'ai_speaking' state");
{
  const testPrompt = "Could you walk me through how you designed your payment gateway caching layer?";
  const html = renderToString(
    React.createElement(InterviewerTile, {
      turnState: "ai_speaking",
      isAiThinking: false,
      aiProvider: "groq (gpt-oss-20b)",
      currentPrompt: testPrompt,
      currentPhase: "core",
    })
  );

  assert(html.includes("AI Evaluator Speaking"), "Must show 'AI Evaluator Speaking' badge");
  assert(html.includes("payment gateway caching layer"), "Must display active spoken prompt in dialogue card");
  assert(html.includes("animate-persona-ring-1"), "Must render animated Persona Core ripple ring 1");
  assert(html.includes("animate-persona-ring-2"), "Must render animated Persona Core ripple ring 2");
  assert(html.includes("animate-persona-ring-3"), "Must render animated Persona Core ripple ring 3");
  assert(html.includes("groq (gpt-oss-20b)"), "Must display active engine badge");
  console.log("  ✅ AI Speaking state correctly displays live question in dialogue card & animated Persona Core");
  passedCount++;
}

// 2. InterviewerTile: Candidate Turn State (Question Persists in Dialogue Card for Reference)
console.log("▶ Test 2: InterviewerTile in 'user_turn' state (Candidate Answering)");
{
  const activeQuestion = "How do you prevent cache stampedes under high concurrency?";
  const html = renderToString(
    React.createElement(InterviewerTile, {
      turnState: "user_turn",
      isAiThinking: false,
      aiProvider: "gemini (gemini-3.8-flash)",
      currentPrompt: activeQuestion,
      currentPhase: "core",
    })
  );

  assert(html.includes("Listening to Candidate"), "Must show 'Listening to Candidate' badge");
  assert(html.includes("Active Question:"), "Must display 'Active Question:' section header");
  assert(html.includes("cache stampedes under high concurrency"), "Must retain question so candidate can reference it continuously");
  assert(!html.includes("Delivering interview question..."), "Must not display fallback when question is provided");
  console.log("  ✅ Candidate turn state keeps active question accessible without opening transcript drawer");
  passedCount++;
}

// 3. InterviewerTile: AI Thinking State
console.log("▶ Test 3: InterviewerTile in 'processing' state (AI Evaluating Depth)");
{
  const html = renderToString(
    React.createElement(InterviewerTile, {
      turnState: "processing",
      isAiThinking: true,
      aiProvider: "groq",
      currentPrompt: "Previous question",
      currentPhase: "core",
    })
  );

  assert(html.includes("Evaluating Technical Depth"), "Must show 'Evaluating Technical Depth' badge");
  assert(html.includes("Analyzing technical signals and calibrating follow-up probe..."), "Must show evaluation text");
  assert(html.includes("animate-shimmer-dot-1"), "Must include shimmer animation dot 1");
  assert(html.includes("animate-shimmer-dot-2"), "Must include shimmer animation dot 2");
  console.log("  ✅ AI Thinking state renders technical depth calibration badge & shimmer dots");
  passedCount++;
}

// 4. InterviewerTile: Idle State (Zero Blank Space / Zero WebGL Crash)
console.log("▶ Test 4: InterviewerTile in 'idle' state (Initialized)");
{
  const html = renderToString(
    React.createElement(InterviewerTile, {
      turnState: "idle",
      isAiThinking: false,
      currentPrompt: null,
      currentPhase: "intro",
    })
  );

  assert(html.includes("Evaluator Ready"), "Must show 'Evaluator Ready' status");
  assert(html.includes("Session initialized"), "Must show session initialized message");
  assert(html.includes("PrepAI Evaluator"), "Must render PrepAI Evaluator badge");
  assert(html.length > 500, "Tile must render rich DOM elements, never empty/blank");
  console.log("  ✅ Idle state renders complete Persona Core without blank whitespace");
  passedCount++;
}

// 5. InterviewHeader: Fullscreen Supported vs Unsupported
console.log("▶ Test 5: InterviewHeader Fullscreen Controls");
{
  // 5a. Supported, not in fullscreen
  const htmlNotFs = renderToString(
    React.createElement(InterviewHeader, {
      jobRole: "Senior Systems Engineer",
      currentPhase: "core",
      elapsedSeconds: 145,
      strikes: 0,
      onEndCall: () => {},
      isFullscreen: false,
      isFullscreenSupported: true,
    })
  );
  assert(htmlNotFs.includes("Fullscreen"), "Must show Fullscreen button");
  assert(!htmlNotFs.includes("Exit Fullscreen"), "Must not show Exit Fullscreen when not in fullscreen");

  // 5b. Supported, currently in fullscreen
  const htmlFs = renderToString(
    React.createElement(InterviewHeader, {
      jobRole: "Senior Systems Engineer",
      currentPhase: "core",
      elapsedSeconds: 180,
      strikes: 0,
      onEndCall: () => {},
      isFullscreen: true,
      isFullscreenSupported: true,
    })
  );
  assert(htmlFs.includes("Exit Fullscreen"), "Must show Exit Fullscreen button when in fullscreen");

  // 5c. Unsupported / restricted iframe environment
  const htmlUnsupported = renderToString(
    React.createElement(InterviewHeader, {
      jobRole: "Senior Systems Engineer",
      currentPhase: "core",
      elapsedSeconds: 200,
      strikes: 0,
      onEndCall: () => {},
      isFullscreenSupported: false,
    })
  );
  assert(htmlUnsupported.includes("Fullscreen Locked"), "Must show explanatory disabled button when unsupported");
  assert(htmlUnsupported.includes("Fullscreen is unavailable in this browser environment"), "Must provide explanatory title tooltip");
  console.log("  ✅ Fullscreen toggle accurately handles supported (Enter/Exit) and unsupported (Explanatory Disabled) states");
  passedCount++;
}

// 6. IntegrityAlertBanner: Two Distinct Layers (Guidance Nudge vs Strike Alert vs Termination)
console.log("▶ Test 6: IntegrityAlertBanner visual hierarchy");
{
  // 6a. Guidance: Camera Check (no_face)
  const htmlNoFace = renderToString(
    React.createElement(IntegrityAlertBanner, {
      warning: null,
      guidance: {
        type: "no_face",
        message: "Camera Check: Your face is not visible in the camera frame. Please ensure your camera is uncovered and unobstructed.",
      },
      isTerminated: false,
    })
  );
  assert(htmlNoFace.includes("Camera Check"), "Must show Camera Check title");
  assert(htmlNoFace.includes("Your face is not visible in the camera frame"), "Must display camera check guidance message");
  assert(!htmlNoFace.includes("Integrity Strike"), "Guidance must NOT be styled as an integrity strike");

  // 6b. Guidance: Fullscreen Minimized with Restore Action
  const htmlFsExit = renderToString(
    React.createElement(IntegrityAlertBanner, {
      warning: null,
      guidance: {
        type: "fullscreen_exit",
        message: "Fullscreen Notice: Fullscreen mode was minimized. Click below to restore fullscreen.",
      },
      isTerminated: false,
      onRestoreFullscreen: () => {},
    })
  );
  assert(htmlFsExit.includes("Fullscreen Focus Reminder"), "Must show Fullscreen Focus Reminder title");
  assert(htmlFsExit.includes("Restore Fullscreen"), "Must offer clickable Restore Fullscreen button");

  // 6c. Guidance: Feed Restored (emerald confirmation)
  const htmlRestored = renderToString(
    React.createElement(IntegrityAlertBanner, {
      warning: null,
      guidance: {
        type: "face_restored",
        message: "Face detected • Resumed",
      },
      isTerminated: false,
    })
  );
  assert(htmlRestored.includes("Visual Feed Restored"), "Must show Visual Feed Restored title");
  assert(htmlRestored.includes("Face detected • Resumed"), "Must show green resumed message");

  // 6d. Layer 2: Verified Server Strike Warning
  const htmlStrike = renderToString(
    React.createElement(IntegrityAlertBanner, {
      warning: "⚠️ Integrity Strike (1/3): Sustained GAZE AWAY detected",
      guidance: null,
      isTerminated: false,
    })
  );
  assert(htmlStrike.includes("Proctoring Integrity Strike Assessed"), "Must show strike assessed title");
  assert(htmlStrike.includes("⚠️ Integrity Strike (1/3)"), "Must display strike count");

  // 6e. Termination: 3 Strikes reached
  const htmlTerm = renderToString(
    React.createElement(IntegrityAlertBanner, {
      warning: null,
      guidance: null,
      isTerminated: true,
    })
  );
  assert(htmlTerm.includes("Interview Terminated due to Repeated Integrity Violations"), "Must show termination banner");
  assert(htmlTerm.includes("Session limit reached (3 strikes)"), "Must explain session limit reached");
  console.log("  ✅ Alert banner cleanly differentiates guidance nudges, server strikes, and termination");
  passedCount++;
}

// 7. InterviewHistory: One-Line Full-Width Space Utilization
console.log("▶ Test 7: InterviewHistory One-Line Header & Full Width Space Utilization");
{
  const html = renderToString(
    React.createElement(ToastProvider, null, React.createElement(InterviewHistory, null))
  );
  assert(html.includes("Interview Records"), "Must render 'Interview Records' title");
  assert(html.includes("w-full"), "Must span full width of container");
  console.log("  ✅ InterviewHistory layout occupies full container width with balanced elements");
  passedCount++;
}
console.log("\n=======================================================");
console.log(`Results: ${passedCount} passed  0 failed  (${passedCount} total)`);
console.log("=======================================================\n");
process.exit(0);
