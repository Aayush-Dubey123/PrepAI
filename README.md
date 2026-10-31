# InterviewAI — Voice-Enabled Technical Interview & AI Evaluation Platform

InterviewAI is a production-grade, voice-enabled, AI-driven technical interview platform built with **Next.js 16 (App Router)**, **TypeScript**, **Drizzle ORM + PostgreSQL (`pgvector`)**, **Clerk Auth**, **Sarvam AI (Bulbul v3 TTS)**, and **MediaPipe Vision Proctoring**.

The system conducts realistic, adaptive technical interviews that evaluate candidate technical depth, problem-solving, and communication clarity in real time with sub-second response times, anti-cheat vision proctoring, and structured post-interview evaluations.

---

## 🏗️ Core Architecture & System Map

```
                                  ┌───────────────────────────┐
                                  │      Candidate Browser    │
                                  │  - React 19 Client UI     │
                                  │  - Web Speech API (STT)   │
                                  │  - MediaPipe Vision WASM  │
                                  │  - Audio Queue & Waveform │
                                  └─────────────┬─────────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          │                     │                     │
                  HTTP POST /turn        HTTP POST /tts       HTTP POST /integrity
                          │                     │                     │
                          ▼                     ▼                     ▼
               ┌─────────────────────┐┌──────────────────┐┌──────────────────────┐
               │ /turn Route Handler ││ /tts Proxy (API) ││ /integrity Route     │
               │ - Rate Limit Guard  ││ - SHA-256 Cache  ││ - 10s Debounce       │
               │ - Idempotency Cache ││ - Char Cap Guard ││ - Strike Counter     │
               │ - Server Brain Eval ││ - Markdown Strip ││ - Audit Log          │
               └──────────┬──────────┘└────────┬─────────┘└──────────┬───────────┘
                          │                    │                     │
                          ▼                    ▼                     │
               ┌─────────────────────┐┌──────────────────┐           │
               │ Resilient LLM Router││ Sarvam AI API    │           │
               │ - Groq / Gemini     ││ (Bulbul v3 TTS)  │           │
               │ - 1500ms Hedging    │└──────────────────┘           │
               │ - Circuit Breaker   │                               │
               └──────────┬──────────┘                               │
                          │                                          │
                          ▼                                          ▼
               ┌─────────────────────────────────────────────────────────┐
               │               PostgreSQL Database (Drizzle ORM)         │
               │  - resumes: Structured candidate profile                │
               │  - interviews: Server state (interviews.plan JSONB)     │
               │  - transcript_chunks: pgvector (768-dim RAG embeddings) │
               └─────────────────────────────────────────────────────────┘
```

---

## ✨ Everything We Have Built

### 1. 🧠 Server-Owned Conversation State Machine (`src/lib/interview`)
- **5-Phase Progression Ladder**: `intro` → `warmup` → `core` → `wrapup` → `closing`.
- **Dynamic Coverage Generation**: Generates 4–8 customized interview coverage goals tailored to candidate resume and job role.
- **Answer-Grounded Follow-Up Engine**:
  - `extractSignalsFromAnswer`: Pure deterministic parser extracting technologies, architectural claims, and open threads from candidate responses without LLM overhead.
  - `ACTIVE THREAD` context block: Keeps the interviewer anchored to the candidate's actual projects and tech choices before advancing topics.
  - Thread depth counter (caps probing at 2–3 turns to prevent rabbit holes).
- **Intent-Driven Classification**: Classifies utterances into 10 explicit intents (`answer`, `partial`, `repeat_request`, `meta`, `question_to_ai`, `smalltalk`, `offtopic`, `unprofessional`, `garbled`, `stop`).
- **Deterministic Guardrails & Policy Enforcement**:
  - **Scoring Isolation**: Only `answer` and `partial` receive numerical scores (0–10). Meta questions, greetings, or clarifications never dilute scores.
  - **Clarification Ladder**: 3-step progressive prompt for garbled/unclear speech, culminating in a text-box prompt.
  - **Jaccard Similarity Guard**: Token overlap threshold (`0.50`) prevents repeating similar questions across the last 8 turns.
  - **Phrase-Level Repeat Guard**: Checks 3-word sentence openers against recent history to eliminate repetitive conversational filler.
  - **Professionalism Nudge**: Polite boundary statement on 1st unprofessional utterance; silent topic redirect on subsequent occurrences.
  - **Pure State Updates**: State transitions (`activateNextTopic`, `closeActiveTopic`) are idempotent pure functions.

### 2. 🛡️ Resilient Multi-Provider LLM Routing Engine (`src/lib/llm`)
- **Cross-Provider Hedging (`generateWithHedging`)**: Dispatches live candidate turns to primary fast models (Groq `openai/gpt-oss-20b`); if no response within `1500ms`, simultaneously fires a race request to Gemini (`gemini-3.8-flash`). Fastest valid response wins.
- **In-Memory Circuit Breaker (`src/lib/llm/circuit-breaker.ts`)**: Automatically trips open for 5 minutes after 2 consecutive failures per model/provider to prevent cascade latency.
- **Fallback Question Bank**: Multi-phrasing deterministic fallback question bank ensuring interviews continue smoothly even if all external LLM APIs experience an outage.
- **Non-Crashing Bootstrapping**: Formatted startup registry table prints active/disabled providers without crashing on missing secondary keys.

### 3. ⚡ Single-Pass Turn Hot-Path (`src/app/api/interviews/[id]/turn/route.ts`)
- **Sub-500ms Execution**: Combined evaluation, intent classification, action decision, and spoken response generation into a single Zod-validated structured prompt.
- **Idempotency & Replay Protection**: `clientRequestId` and hash verification instantly returns cached turn payloads on network retries without double-charging quotas or advancing state.
- **Async Database & Vector Persistence via `after()`**: Next.js 15+ `after()` schedules state persistence and vector embedding generation in the background, eliminating blocking DB I/O from the user's turn roundtrip.

### 4. 📄 Multi-Format Resume Ingestion Engine (`src/app/api/parse-resume/route.ts`)
- **Multi-Format Extraction**: Parses PDF (`unpdf`), Word documents (`mammoth`), Plain Text (`.txt`), and Markdown (`.md`).
- **Binary Magic-Byte Verification**: Inspects `%PDF-` and `PK\x03\x04` file headers for safety rather than relying on unverified file extensions (5 MB hard limit).
- **Heuristic Regex Fallback (`heuristicParse`)**: Extracts candidate names, emails, years of experience, and skills if LLM quotas are exhausted, guaranteeing candidates never get blocked from interview entry.

### 5. 🔊 Enhanced Voice Proxy (`src/app/api/tts/route.ts`)
- **High-Fidelity Indian-English Audio**: Powered by Sarvam AI (`bulbul:v3`).
- **Text Sanitization (`stripForTTS`)**: Strips Markdown asterisks, backticks, URLs, code blocks, and emojis before synthesis.
- **SHA-256 Cache**: In-memory LRU cache keyed by `sha256(speaker:cleanText)` provides instant repeat playback.
- **Budget Protection & Browser Fallback**: Daily user limit (`5,000 chars`) and global limit (`200,000 chars`) with automatic browser `window.speechSynthesis` fallback.

### 6. 👁️ Real-Time Vision & Browser Integrity Proctoring (`src/lib/integrity`)
- **MediaPipe WASM in Browser**:
  - **Face Landmarker**: 3D Head Yaw/Pitch angles and Eye Gaze blendshapes (`eyeLookOut`, `eyeLookIn`, `eyeLookUp`) detect sustained off-screen glances.
  - **Multi-Face & Absence**: Detects when candidate leaves the frame or an unauthorized person enters.
  - **Object Detector**: Real-time detection of unauthorized physical items (`cell phone`, `book`, `laptop`).
- **Lifecycle Interception**: Tab switches (`visibilitychange`), Fullscreen exit (`fullscreenchange`), and Clipboard paste (`paste`).
- **Debounced Strike System**: Time-thresholded debouncing (1.0s–3.0s) and a 10s cooldown per violation category prevent false positives.

### 7. 📊 Grounded Post-Interview Feedback Engine (`src/app/api/interviews/[id]/feedback/generate/route.ts`)
- **Code-Calculated Metrics**: Overall score and hiring recommendation (`strong_hire`, `hire`, `consider`, `do_not_hire`) are computed mathematically in TypeScript code—never hallucinated by an LLM.
- **Low-Confidence Isolation**: Turns with confidence `< 0.5` are categorized under "Insufficient Evidence" rather than counted as candidate gaps.
- **Evidence-Backed Notes**: Synthesizes strengths and gaps with citations directly from actual candidate transcript quotes.

---

## 🚦 Conversation Logic Evaluation: Current State vs Generic Engine

### Current Strengths
1. **Deterministic Quality**: Code enforces rules (turn caps, score thresholds, repeat guards, clarify ladders) so the LLM cannot derail the interview structure.
2. **Answer Grounding**: Dynamic signal extraction prevents the AI from ignoring candidate answers and jumping across unrelated topics.
3. **Speed**: Sub-second roundtrip via single-pass prompts, cross-provider hedging, and `after()` async DB writes.

### Areas Where More Generic Conversation Logic is Beneficial
| Capability | Current Platform Implementation | Generic Conversation Engine Potential |
|---|---|---|
| **Dialogue Stack & Agenda** | Linear `activeThread` string with single depth counter. | Hierarchical dialogue agenda allowing multi-topic branching, push/pop sub-dialogues, and returning to pending threads. |
| **Mixed-Initiative Dialogues** | AI responds to `question_to_ai` with brief answer and waits. | AI answers candidate clarification *and* immediately re-anchors the technical question in one fluid conversational turn. |
| **Full-Duplex Voice & Interruption** | Half-duplex turn submission via STT button / silence timer. | WebRTC streaming voice with real-time Voice Activity Detection (VAD) and barge-in / audio cancellation. |
| **Semantic In-Session RAG** | Recent 12 messages in context; vector embeddings stored in DB via `after()`. | Real-time cosine similarity search across 30+ minute transcripts to cross-reference earlier claims. |
| **Multi-Domain Extensibility** | Pre-configured 5-phase ladder for Software Engineering. | Declarative statecharts (XState / Statebox) allowing System Design canvas rounds, Behavioral STAR interviews, or PM cases. |

---

## 🤖 LLM Provider Verification & Privacy Matrix (Phase 4)

The platform exclusively uses verified free-tier providers without credit card requirements or trial expiration risks:

| Provider | Free Tier Terms (Verified Sep 2026) | Card Required? | Data Used for Training? | Known Gotchas & Architecture Role |
|---|---|---|---|---|
| **Groq** | Generous free tier (30 RPM, 14,400 RPD on models like `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`). Sub-500ms TTFT. | **No** | **No** (Groq does not use customer API inputs for model training) | **Primary Live Turn Engine**. Blazing speed. Occasional peak traffic 429s handled by circuit breaker. |
| **Google Gemini** | Free tier on `gemini-3.8-flash`, `gemini-3.5-flash-lite` (15 RPM, 1,500 RPD, 1M context tokens). | **No** | ⚠️ **YES (Flagged)**: Google AI Studio Unpaid tier logs prompts for human review & model improvement. | **Primary Heavy Task / Hedge Engine**. 1M token window ideal for resume parsing and comprehensive feedback reports. |
| **OpenRouter** | Free models ending in `:free` (dynamic roster e.g. `meta-llama/llama-3.3-70b-instruct:free`). 20 RPM, 50 req/day limit. | **No** | **Varies** (routed to upstream provider free tiers). | **Secondary / Overflow Provider**. Daily 50-request cap is tracked in memory to prevent burning daily quota. |
| **Cerebras** | ❌ **EXCLUDED**. Requires credit card verification and trial credit expires in 30 days. | **Yes** | N/A | Excluded completely to prevent financial risk and credit expiration locks. |
| **Mistral** | ⏸️ **EXCLUDED (Pending)**. Free tier underwent restructuring in 2026; terms unverified. | Pending | Pending | Left out of active rotation pool until stable free-tier terms are confirmed. |

---

## 🛠️ Technology Stack

| Layer | Technology | Role |
|---|---|---|
| **Framework** | Next.js 16.2.4 (App Router) | Web application & API orchestration |
| **Language** | TypeScript 5 (Strict Mode) | Full type safety, Zod validation |
| **Database & ORM** | PostgreSQL + Drizzle ORM (`pgvector`) | Relational persistence & vector embeddings |
| **Authentication** | Clerk Auth (`@clerk/nextjs`) | User management & session verification |
| **LLM Routing** | Custom Resilient Router (`src/lib/llm`) | Multi-provider hedging (Groq, Gemini, OpenRouter) |
| **Voice Synthesis** | Sarvam AI (`bulbul:v3`) | Indian-English speech synthesis |
| **Speech Recognition** | Web Speech API | Client-side real-time transcript capture |
| **Vision Proctoring** | MediaPipe Tasks Vision | Real-time browser face landmarker & object detection |
| **Document Parsing** | `unpdf` + `mammoth` | Magic-byte multi-format document extraction |
| **Validation** | Zod 4.4 | Runtime schema validation across all boundaries |

---

## 🚦 Environment Setup

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
# PostgreSQL Connection (pgvector enabled)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/interviewai"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# LLM Providers (At least one required; Groq + Gemini recommended)
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key

# Optional: Disable specific LLM providers during tests/simulations
# LLM_DISABLE_PROVIDERS="openrouter"

# Voice Synthesis (Sarvam AI)
SARVAM_API_KEY=your_sarvam_key

# Optional: Upstash Redis for distributed cache
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## 🏃 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Push database schema migrations
npx drizzle-kit push

# 3. Start Next.js development server
npm run dev
```

Visit `http://localhost:3000` to access the application.

---

## 🧪 Test Suite & Verification

Run the automated assertion test suites:

```bash
# 1. Run Answer Grounding & Signal Extraction Suite (28 tests)
npx tsx --env-file=.env.local src/tests/answer-grounding.test.ts

# 2. Run Brain Policy & Repeat Guard Assertions (7 tests)
npx tsx --env-file=.env.local src/tests/brain-step4.test.ts

# 3. Run Rate Limiter & Idempotency Suite (22 tests)
npx tsx --env-file=.env.local src/tests/rate-limit.test.ts

# 4. Run TypeScript Static Type Check
npx tsc --noEmit --skipLibCheck
```

---

## 📂 Project Directory Structure

```
interview-ai/
├── src/
│   ├── app/                                # Next.js App Router
│   │   ├── api/
│   │   │   ├── dev/                        # Dev diagnostics & limit resets
│   │   │   ├── interviews/                 # Turn, initialize, feedback, transcript
│   │   │   ├── parse-resume/               # Magic-byte document extraction
│   │   │   └── tts/                        # Sarvam AI Bulbul v3 proxy
│   │   ├── interview/                      # Interview room & setup lobby UI
│   │   ├── dashboard/                      # Candidate interview dashboard
│   │   └── layout.tsx                      # Root layout with Clerk Auth
│   ├── components/                         # UI components & upload flows
│   ├── db/                                 # Drizzle schema & Postgres connection
│   ├── lib/
│   │   ├── integrity/                      # MediaPipe vision proctoring engine
│   │   ├── interview/                      # Conversation state, prompt, brain config
│   │   ├── llm/                            # Resilient multi-provider router & circuit breaker
│   │   ├── gemini-embeddings.ts            # 768-dim pgvector embedding helpers
│   │   └── rate-limit.ts                   # Sliding-window rate limiters & replay cache
│   ├── schemas/                            # Zod schemas (brain, feedback, resume, transcript)
│   └── tests/                              # Automated assertion test suites
├── drizzle.config.ts                       # Drizzle ORM configuration
├── package.json                            # Dependencies and scripts
└── README.md                               # Project documentation
```
omp --resume 01a18fc2-d5a1-778c-b118-e203cef2c17a