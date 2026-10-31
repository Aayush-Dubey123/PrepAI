# PrepAI Development Progress & Architecture Record

## Overview
**PrepAI** is a real-time, voice-enabled, AI-driven technical interview and proctoring platform. Candidates experience realistic, adaptive technical interviews grounded in their resumes and target job roles, with autonomous follow-ups, live integrity monitoring, and comprehensive diagnostic feedback.

---

## Technology Stack

| Layer | Technology | Key Capabilities |
| :--- | :--- | :--- |
| **Framework** | Next.js 16.2.4 (Turbopack, App Router) | Server Components, Route Handlers, Streaming |
| **Language** | TypeScript 5 (Strict Mode) | Type-safe schemas and validated contracts |
| **Database & ORM** | PostgreSQL + Drizzle ORM (`pgvector`) | Relational persistence + 768-dim vector embeddings |
| **Authentication** | Clerk Auth (`@clerk/nextjs`) | Candidate sessions, RBAC admin barriers, IP allowlists |
| **LLM Router** | Free-Tier Multi-Provider Pool | Hedged routing across Groq, Gemini, and OpenRouter |
| **Audio Synthesis** | Sarvam AI (Bulbul v3) + Browser TTS | Natural speech synthesis with seamless browser fallback |
| **Speech Recognition** | Browser Web Speech API | Client-side real-time transcript processing with instant barge-in |
| **Vision Proctoring** | MediaPipe Tasks Vision (Face + Object) | 468-point face mesh, gaze tracking, head pose, multiple-person detection |
| **Document Ingestion**| `unpdf` + `mammoth` | Magic-byte parsing of PDF, DOCX, TXT, and Markdown resumes |
| **Styling & Design** | Tailwind CSS v4 + Lucide Icons | Responsive UI, semantic tokens, animated CSS ripple rings |

---

## Chronological Development Milestones

### Phase 1: Structural Variation & Non-Repetitive Conversational Seeds
- **Per-Interview Seed**: Assigned random seed (0–999) persisted in `interviews.plan` to guarantee distinct interview paths.
- **Dynamic Opening Templates**: 6 structural opening moves (Jump Start, Scenario Opener, Career Story, Expertise First, Growth Opener, Impact Opener) populated dynamically by the LLM using candidate resume details.
- **Topic Order Shuffling**: Controlled randomization of knowledge-base topics so background questions are not invariably turn 1.
- **Multi-Phrasing Question Bank**: 5 distinct phrasings per topic (story-based, hypothetical, direct, comparative, scenario-based) rotated by seed.

### Phase 2: Modular Knowledge Base & Adaptive K-Score Difficulty
- **Knowledge Base Tracks (`src/lib/interview/knowledge-base/`)**: Structured guidelines for `software-engineering`, `frontend`, `backend`, `data-science`, `system-design`, `behavioral`, and `generic-hr`.
- **Rolling K-Score Engine**: Exponentially weighted performance score (0–10) tracking trajectory (`rising`, `flat`, `falling`).
- **Dynamic Depth Ladder**: Probing depth (`easy`, `medium`, `hard`) adapts to performance: rising trajectories escalate depth; struggling answers step down gracefully.
- **Answer Length Adaptation**: Prompts scale based on candidate articulation—concise answers prompt open invitations; deep technical answers invite focused architectural drill-downs.

### Phase 3: Background Pre-Computation & Lobby Offloading
- **Lobby Parallelization**: Knowledge-base coverage selection, candidate opening question generation, and provider pool warm-up execute in the background during hardware checks.
- **Zero-Latency Turn Routing**: Runtime turn endpoints perform zero topic selection overhead, executing directly against pre-computed states.

### Phase 4: Free-Tier LLM Provider Pool & Quota Safeguards
- **Provider Hedging**: Automatic failover across Groq (`gpt-oss-20b`, `qwen3.8-27b`), Gemini (`gemini-3.8-flash`, `gemini-3.5-flash-lite`), and OpenRouter (`llama-3.3-70b-instruct:free`).
- **Cerebras Elimination**: Removed Cerebras completely due to 30-day credit expiration and mandatory credit card verification.
- **OpenRouter Free Tier Guard**: Automatic tracking enforcing the 50 req/day free tier quota with model rotation.

### Phase 5: Multi-Persona Trajectory Simulation & Verification
- Validated system behaviors across three candidate archetypes: Strong Senior Backend Lead, Concise/Weak Frontend Lead, and Adaptive Data Engineer.

### Phase 6: End-Call Lifecycle & Graceful Recovery
- **Graceful Termination**: Instant audio cancellation, camera track release, and automatic transition to feedback generation.
- **Session Resumption**: Turn-by-turn persistence in PostgreSQL enables seamless recovery if a candidate refreshes or loses connection.

### Phase 7: Production Frontend Architecture Makeover
- **Modular Component Library**: Extracted monolithic page templates into focused components: `CandidateTile`, `InterviewerTile`, `InterviewHeader`, `InterviewControls`, `TranscriptDrawer`, and `IntegrityAlertBanner`.
- **Pre-Flight Hardware Lobby**: Structured interactive checklist for camera alignment, microphone audio level, speaker playback, and speech recognition readiness.
- **Personal Candidate Analytics**: Dashboard tracking completion history, performance trajectories, skill confidence distributions, and targeted practice recommendations.
- **Vector PDF Diagnostic Export**: Client-side vector-rendered PDF reports (`jspdf`) featuring dimension radars, feedback breakdowns, and hiring recommendations.

### Phase 8: Security & Reliability Hardening
- **Multi-Tenant Protection**: Eliminated unauthorized cross-user interview queries; unauthenticated requests return clean empty sets.
- **Audit Purge Authorization**: Enforced fail-closed authorization requiring valid `CRON_SECRET` on cleanup endpoints.
- **Admin Barriers**: Restricted admin routes and metrics to verified user IDs and allowlisted CIDR/IP addresses with HTTP 403 enforcement.
- **Database Connection Pooling**: Implemented global singleton pooling (`globalThis.__pgPool`) preventing connection exhaustion in serverless runtimes.
- **TTL Rate Limiting**: Added automated cache sweeps to prevent unbounded memory retention.

### Phase 9: Live Camera Performance, AI Evaluator Persona & Human-Centric Warnings
- **Main-Thread Lag Elimination**: Decoupled 468-point MediaPipe face-mesh execution from 60 FPS video rendering. Throttled inference to ~15 FPS (`66ms` interval), freeing ~40ms per frame window for fluid camera playback.
- **Timestamp Disentanglement**: Separated wall-clock inference throttling (`lastFaceInferenceTime`) from monotonically increasing MediaPipe timestamps (`lastMediaPipeTimestamp`).
- **Frame-Drop Grace Tolerance**: Added a 150ms grace tolerance window in `checkCondition` to preserve sustained tracking during transient lighting/pose flickers.
- **AI Persona Core & WebGL Fallback**: Dual-mode visualizer (`avatar` | `orb`) with concentric CSS animated ripple rings reacting dynamically to speaking (Indigo), analyzing (Cyan), and listening (Emerald) states, backed by a React ErrorBoundary.
- **Live Dialogue Card**: Displays active question continuously during candidate turns, allowing candidates to reference multi-part questions without opening the side drawer.
- **Fullscreen Proctoring Mode**: Header toggle with explanatory disabled state and tooltip for restricted iframe/sandbox environments.
- **Two-Tier Visual Warnings**: Eliminated all `speechSynthesis` warnings to avoid voice collisions and barge-in interruptions. Separated real-time non-punitive guidance nudges (camera obstructed, fullscreen minimized) from official server-audited strikes.

### Phase 10: Audio Concurrency, Race Condition & Overlap Elimination
- **Playback Token Generation Counter**: Added `playbackIdRef` counter to `useAudioPlayback.ts`. Every new speech request or barge-in increments the token, immediately invalidating any in-flight fetches or subsequent chunk playback.
- **In-Flight Network Abort**: Wired `AbortController` to TTS requests so cancelled speech aborts network requests immediately.
- **Unblocking Chunk Resolvers**: Added `currentChunkResolverRef` to resolve hanging chunk promises immediately when `stopAiSpeech()` is called.
- **Instant Interim Voice Barge-In**: Updated `useSpeechInput.ts` to trigger `onBargeIn()` on the first detected word in `onresult`, cutting off AI audio instantaneously.
- **TurnState Synchronization**: Wired `useTurnOrchestrator.ts` to explicitly transition `turnState` to `"ai_speaking"` during audio delivery and `"user_turn"` upon completion or interruption.
- **API Middleware Hardening**: Updated `src/proxy.ts` to return HTTP 401 JSON on unauthenticated `/api/*` requests instead of redirecting to `/sign-in` HTML, preventing client JSON parse errors.

### Phase 11: Record Deletion, Retention Controls & UX Quick Actions
- **Cascade Deletion Route (`DELETE /api/interviews/[id]`)**: Authenticated deletion endpoint verifying user ownership or tracking cookies, cascade-purging dependent `transcriptChunks`, `auditEvents`, and the root `interviews` row.
- **Bulk Retention Cleanup (`DELETE /api/interviews?clearCompleted=true`)**: Single-click retention control allowing candidates to purge historical completed interviews while preserving in-progress sessions.
- **Row-Level Delete with Inline Confirmation**: In `src/components/interview-history.tsx`, added a `Trash2` delete button with a 2-step inline confirm state (`[Confirm]` / `Cancel`) and live toast feedback. Parent Dashboard metrics recompute optimistically without full page reloads.
- **Feedback Page Delete & Share Controls**: In `src/app/interview/[id]/feedback/page.tsx`, added a `Delete Record` button with confirmation modal and automatic redirection to `/dashboard`, a `Share / Copy Link` action, and a delete action on the error notice screen for invalid sessions.

### Phase 12: Container UI Makeover & Advanced Security Remediation
- **Interview Records Container Makeover (`src/components/interview-history.tsx`)**:
  - Transformed header into a clean single-line full-width layout with icon, `Interview Records [count]`, subtitle `Verified sessions & evaluations`, and action buttons (`RotateCw`, `Clear Completed`) spanning the full width in one cohesive line.
  - Replaced clumsy stacked filters with a unified side-by-side toolbar integrating the search bar on the left and segmented filter controls on the right.
  - Balanced each interview card into a modern 3-zone layout: Left (Role, status badge, date, turn count, ID hash), Middle (Score badge or live phase indicator), and Right (Resume/Report action button + Delete button with 2-step inline confirm).
  - Eliminated full-card skeleton unmount flash so the header is always anchored immediately on the first frame.
- **IDOR / Broken Access Control Remediation**:
  - In `src/app/api/interviews/[id]/feedback/route.ts`: Fixed critical authorization bypass where unauthenticated callers (`userId === null`) bypassed ownership checks; now strictly enforces ownership against `userId` or session cookie `prepai_interview_ids`.
  - In `src/app/api/interviews/[id]/prewarm/route.ts`: Enforced ownership verification to prevent unauthorized attackers from invoking expensive background LLM prewarming.
- **Database Storage DoS Prevention**:
  - In `src/app/api/interviews/[id]/snapshot/route.ts`: Added strict 500KB cap and MIME data URI regex validation (`^data:image/(jpeg|png|webp);base64,`) on candidate snapshot uploads to prevent arbitrary payload or unbounded data storage.
- **Timing Attack Remediation**:
  - In `src/app/api/cron/purge-audit/route.ts`: Replaced standard `===` string equality with `crypto.timingSafeEqual` to eliminate observable timing discrepancies on secret token authorization.

---

## Automated Verification Suite

The repository maintains 18 comprehensive test suites executed via `src/tests/run-all.ts`:

```bash
npm run test
```

| Suite | Focus | Assertions |
| :--- | :--- | :--- |
| **Brain Core Logic** | ConversationState schema, phase transitions, decision policies | 11 passed |
| **Brain Step 4 Assertions** | System prompt bounds, language nudges, repeat guards, scoring | 7 passed |
| **Answer Grounding & Follow-ups** | Signal extraction, novel tech filters, active threads, follow-up caps | 28 passed |
| **Rate Limit Assertions** | Bucket isolation, 429 Retry-After headers, replay guards, dev bypass | 22 passed |
| **Phase 1–6 Verification Harness** | Full system multi-turn simulation across 3 candidate archetypes | 6 phases passed |
| **Analytics & Admin Auth Barriers**| Role authorization, IP allowlists, trajectory computation, null safety | 49 passed |
| **Integrity Debounce & Cadence** | ~15 FPS cadence, 150ms grace tolerance, 10s cooldown | 7 passed |
| **Interview Room UI & Smoke** | Dialogue Card states, Persona Core rings, Fullscreen controls, Alert layers | 6 passed |
| **Audio Conversation & Overlap** | Generation token invalidation, instant barge-in, turn transitions | 4 passed |
| **Interview Deletion & Retention** | Cascade purge, ownership guard, bulk cleanup, cookie pruning | 3 passed |
| **Security & Access Control** | IDOR barrier isolation, snapshot payload constraints, timing safety | 3 passed |
| **Drill Deterministic & LLM Grading** | Rubric parsing, MCQ, multi-select, code trace, and fallback grading | 7 passed |
| **Drill Smart Set Builder** | Adaptive mastery ranking, overdue concepts, recent-exclusion logic | 4 passed |
| **Drill Mastery EMA & Spaced Repetition** | Exponential moving average (0.3/0.7), SM-2 intervals, monotonic gates | 7 passed |
| **Drill Idempotency & Concurrency** | ClientRequestId deduplication, answer replay guards, index locks | 3 passed |
| **Drill Seed Data Validation** | All 6 categories, 248 validated questions, valid option mapping | 5 passed |
| **Drill Targeted Sessions & Feature Guards** | Precedence flags, 403 guards, targeted index pinning, 201 launch | 7 passed |
| **Drills, Interview & Analytics E2E Integration** | Live session lifecycle, grading, EMA update, feedback normalization, blindspot-to-drill bridging, gym analytics | 8 passed |

**Production Build Gate**:
```bash
npm run build
```
Compiled with Next.js 16 (Turbopack) and strict TypeScript typechecking with zero errors (24/24 static pages generated).
