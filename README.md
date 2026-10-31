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

Run the comprehensive automated test suite (18 test suites covering brain logic, follow-ups, rate limiting, phase verification, auth, audio, integrity, drills grading, mastery, seed validation, and live E2E integration):

```bash
# Run all 18 test suites
npm test

# Run TypeScript static type check
npx tsc --noEmit

# Run ESLint validation
npm run lint

# Run Next.js production build
npm run build
```

Individual test suites can also be run directly:

```bash
# Brain Core Logic & Policy Assertions
npx tsx src/tests/brain/brain.test.ts
npx tsx src/tests/brain/brain-step4.test.ts

# Answer Grounding & Signal Extraction
npx tsx src/tests/interview/answer-grounding.test.ts

# Security, Rate Limiting & Auth
npx tsx src/tests/security/rate-limit.test.ts
npx tsx src/tests/security/security.test.ts
npx tsx src/tests/auth/analytics-auth.test.ts

# Drills Engine (Grading, Mastery, Catalog Validation)
npx tsx src/tests/drills/evaluation/drill-grading.test.ts
npx tsx src/tests/drills/mastery/drill-mastery.test.ts
npx tsx src/tests/drills/catalog/drill-seed-validation.test.ts
```

---

## 📂 Repository Structure and Organization Rules

The repository follows a clean, modular, and maintainable folder structure designed for clarity, scalability, and seamless client handover.

### Architectural Rule: Maximum Two Direct Files Per Ordinary Folder

To eliminate folder clutter and keep the codebase structured:
- **Every ordinary parent directory contains a maximum of two direct files** wherever reasonably achievable.
- Larger collections of related files are logically partitioned into focused subdirectories by domain responsibility (e.g., `src/hooks/audio/`, `src/hooks/proctoring/`, `src/hooks/interview/`).
- Shared domain modules expose clean public boundaries via centralized barrel index files where appropriate (e.g., `src/schemas/index.ts`, `src/hooks/index.ts`, `src/components/ui/index.ts`).

### Justified Framework & Tooling Exceptions

The two-file rule is strictly exempted for framework-mandated patterns to prevent tooling breakage:
1. **Root Directory (`.`)**: Project-wide toolchain and build configuration files required by Next.js, TypeScript, ESLint, PostCSS, Drizzle, Docker, and Git (`package.json`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `Dockerfile`, `.dockerignore`, `.env.example`, `AGENTS.md`, `README.md`).
2. **Next.js App Router Segments (`src/app/`, `src/app/practice/`)**: Next.js reserved file conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `template.tsx`, `globals.css`).
3. **Database Core (`src/db/`)**: Contains `index.ts`, `schema.ts`, and `vector.ts` (3 files) so that `schema.ts` remains directly bound to `drizzle.config.ts` without migration or Drizzle Studio path drift.
4. **Drizzle Migration Journal (`src/db/drizzle/meta/`)**: Machine-generated migration snapshots and metadata managed by Drizzle ORM.
5. **Public Root Browser Assets (`public/`)**: Browser-standard discovery assets (`apple-icon.png`, `favicon.ico`, `icon.svg`) that must reside at the root URL path for web clients.
6. **Framework WASM Modules (`public/mediapipe/wasm/`)**: Pre-compiled binary WebAssembly modules loaded by MediaPipe Tasks Vision runtime.
7. **Static Content Question Banks (`content/drills/<track>/`)**: Pre-authored question catalog JSON files partitioned by drill tracks (`algo-logic`, `behavioral-star`, `database-concurrency`, `frontend-arch`, `rapid-screen`, `system-design`).

---

### Complete Directory Architecture

```
prepai/
├── content/                                # Static drill content repositories
│   └── drills/                             # Question banks partitioned by track
│       ├── algo-logic/                     # Algorithm & data structure questions (.json)
│       ├── behavioral-star/                # STAR method behavioral questions (.json)
│       ├── database-concurrency/           # RDBMS, locking, & ACID questions (.json)
│       ├── frontend-arch/                  # React & frontend systems questions (.json)
│       ├── rapid-screen/                   # Fast-paced screening questions (.json)
│       └── system-design/                  # High-scale architecture questions (.json)
│
├── public/                                 # Static public web assets
│   ├── mediapipe/wasm/                     # MediaPipe vision binary WASM modules
│   ├── apple-icon.png                      # Mobile touch icon
│   ├── favicon.ico                         # Browser tab icon
│   └── icon.svg                            # Application vector icon
│
├── scripts/                                # Maintenance, seeding & CLI scripts
│   └── content/                            # Drill content lifecycle scripts
│       ├── auditing/                       # Content quality audits & question generation
│       ├── curation/                       # Review and approval workflows
│       ├── seeding/                        # Database seeding & seed bank generators
│       └── taxonomy/                       # Drill taxonomy & validation schemas
│
├── src/                                    # Application source code
│   ├── app/                                # Next.js 16 App Router (routes & API handlers)
│   │   ├── admin/                          # Admin dashboard & login gates
│   │   ├── analytics/                      # Candidate metrics & performance view
│   │   ├── api/                            # Backend REST & RPC API route handlers
│   │   │   ├── admin/                      # Admin analytics & auth check
│   │   │   ├── cron/                       # Scheduled background jobs (purge-audit)
│   │   │   ├── dev/                        # Developer diagnostics & limit resets
│   │   │   ├── drill-sessions/             # Drill interactive session lifecycle
│   │   │   ├── drills/                     # Drill track catalog & sets
│   │   │   ├── eval/                       # Latency benchmarks & audio recording
│   │   │   ├── interviews/                 # Turn, initialize, prewarm, snapshot, feedback
│   │   │   ├── parse-resume/               # Magic-byte multi-format document parser
│   │   │   ├── tts/                        # Sarvam AI Bulbul v3 voice synthesis proxy
│   │   │   └── user/                       # User analytics and profile endpoints
│   │   ├── dashboard/                      # Candidate dashboard & past sessions
│   │   ├── interview/                      # Interview room, lobby & feedback report
│   │   ├── practice/                       # Practice Gym tracks & active player
│   │   ├── sign-in/ & sign-up/             # Clerk authentication views
│   │   ├── globals.css                     # Global Tailwind CSS styles
│   │   ├── layout.tsx                      # Root HTML layout with Clerk Provider
│   │   ├── page.tsx                        # Public landing page
│   │   └── template.tsx                    # Page transition container
│   │
│   ├── components/                         # Modular React components
│   │   ├── compliance/                     # Cookie consent and legal notices
│   │   ├── dashboard/                      # Dashboard charts, metrics & history
│   │   ├── gym/                            # Practice drill player & question renderers
│   │   ├── interview-room/                 # Active interview room interface
│   │   │   ├── chrome/                     # Header bar and integrity alert banner
│   │   │   ├── controls/                   # Control buttons & transcript drawer
│   │   │   ├── modals/                     # End interview confirmation modal
│   │   │   └── tiles/                      # Candidate webcam & interviewer avatar tiles
│   │   ├── lobby/                          # Hardware calibration lobby before interview
│   │   │   ├── audio/                      # Speaker test & speech recognition check
│   │   │   ├── hardware/                   # Camera calibration & microphone check
│   │   │   └── status/                     # Readiness progress bar
│   │   ├── navigation/                     # Global navigation header & progress bar
│   │   ├── onboarding/                     # Resume upload and parsing flow
│   │   ├── sidebar/                        # Collapsible application sidebar
│   │   └── ui/                             # Reusable design system primitives
│   │       ├── actions/                    # Button, Badge
│   │       ├── containers/                 # Card, ProgressBar
│   │       ├── feedback/                   # Toast, ToastProvider
│   │       ├── forms/                      # Input, Textarea
│   │       ├── loaders/                    # LatticeLoader, AudioVisualizer
│   │       ├── overlays/                   # Dialog, Tabs
│   │       ├── visuals/                    # Orb ambient lighting
│   │       └── index.ts                    # Unified barrel export for UI components
│   │
│   ├── db/                                 # Database schema & Drizzle ORM client
│   │   ├── drizzle/                        # Drizzle Kit migration files & journal
│   │   ├── index.ts                        # PostgreSQL connection pool & Drizzle client
│   │   ├── schema.ts                       # Database tables, enums & relational schema
│   │   └── vector.ts                       # pgvector custom Drizzle type definition
│   │
│   ├── eval/                               # Latency benchmark and evaluation harnesses
│   │   ├── analytics/                      # Evaluation logging & metrics collection
│   │   ├── benchmarks/                     # Latency collector & report generator
│   │   ├── exporters/                      # Question and conversation turn exporters
│   │   └── reporting/                      # Formal viva documentation generator
│   │
│   ├── hooks/                              # Custom React subsystem hooks
│   │   ├── audio/                          # useAudioPlayback, useSpeechInput
│   │   ├── interview/                      # useTurnOrchestrator, useSilenceNudge
│   │   ├── proctoring/                     # useIntegrityMonitor, useWebcamStream
│   │   └── index.ts                        # Unified barrel export for hooks
│   │
│   ├── lib/                                # Domain logic and business services
│   │   ├── ai/                             # Gemini pgvector 768-dim embeddings
│   │   ├── analytics/                      # User analytics calculations
│   │   ├── auth/                           # Admin authorization & role guards
│   │   ├── core/                           # Environment config & shared utility helpers
│   │   ├── documents/                      # PDF export & default interview plans
│   │   ├── drills/                         # Practice Gym progression engine
│   │   │   ├── evaluation/                 # Deterministic & LLM grading, scoring
│   │   │   └── progression/                # Concept mastery EMA & smart set builder
│   │   ├── integrity/                      # Vision proctoring detector & config
│   │   ├── interview/                      # Interview state machine & knowledge base
│   │   │   ├── config/                     # Brain configuration & K-Score weights
│   │   │   ├── knowledge-base/             # Domain question taxonomies by discipline
│   │   │   │   ├── architecture/           # System design & behavioral rubrics
│   │   │   │   ├── domains/                # Frontend & backend domain tracks
│   │   │   │   ├── engineering/            # Data science & software engineering tracks
│   │   │   │   ├── general/                # HR general questions & common types
│   │   │   │   └── index.ts                # Unified knowledge base registry
│   │   │   └── orchestration/              # Adaptive prompt builder & state machine
│   │   ├── llm/                            # Resilient multi-provider LLM routing
│   │   │   ├── adapters/                   # Gemini & OpenAI-compatible adapters
│   │   │   ├── core/                       # LLM router configuration & model definitions
│   │   │   ├── providers/                  # OpenRouter integration & circuit breaker
│   │   │   └── index.ts                    # Hedging LLM router entry point
│   │   └── security/                       # Sliding-window rate limiters & audit logging
│   │
│   ├── schemas/                            # Zod schemas & runtime type contracts
│   │   ├── candidate/                      # Resume & chat session schemas
│   │   ├── evaluation/                     # Brain turn response & feedback schemas
│   │   ├── interview/                      # Interview state & transcript schemas
│   │   ├── practice/                       # Drill sessions & integrity schemas
│   │   └── index.ts                        # Unified barrel export for all schemas
│   │
│   └── tests/                              # Automated test suites & test runner
│       ├── audio/                          # Audio conversation & room UI smoke tests
│       ├── auth/                           # Admin auth barriers & interview retention tests
│       ├── brain/                          # Brain core logic & step 4 assertion tests
│       ├── drills/                         # Practice Gym test suites
│       │   ├── catalog/                    # Seed validation & targeted session tests
│       │   ├── evaluation/                 # Drill grading & idempotency tests
│       │   └── mastery/                    # Mastery EMA & smart set builder tests
│       ├── e2e/                            # Live end-to-end integration test suite
│       ├── integrity/                      # Proctoring debounce & cadence tests
│       ├── interview/                      # Answer grounding & phase verification tests
│       ├── security/                       # Rate limiting & security tests
│       └── run-all.ts                      # Master test runner (npm test)
│
├── drizzle.config.ts                       # Drizzle ORM configuration
├── eslint.config.mjs                       # ESLint flat configuration
├── next.config.ts                          # Next.js 16 configuration
├── package.json                            # Project dependencies and npm scripts
├── postcss.config.mjs                      # PostCSS / Tailwind CSS configuration
├── tsconfig.json                           # TypeScript compiler configuration
└── README.md                               # Repository documentation
```

---

### Developer Guide: Where to Add New Code

| If you want to add... | Place files in... | Architectural Convention |
|---|---|---|
| **A new user-facing route or page** | `src/app/<feature>/page.tsx` | Use Next.js App Router conventions (`page.tsx`, `layout.tsx`, `loading.tsx`). |
| **A new backend API endpoint** | `src/app/api/<feature>/route.ts` | Validate inputs with Zod (`src/schemas/`), protect with rate limiter (`src/lib/security/rate-limit.ts`). |
| **New UI primitives or design widgets** | `src/components/ui/<category>/` | Max 2 files per folder (e.g. `Component.tsx`, `Component.types.ts`). Re-export in `src/components/ui/index.ts`. |
| **A new domain feature component** | `src/components/<feature>/<subdomain>/` | Keep components small, focused, and grouped by responsibility. |
| **A custom React hook** | `src/hooks/<domain>/` | Max 2 files per hook category. Re-export in `src/hooks/index.ts`. |
| **New Zod validation schemas / contracts** | `src/schemas/<domain>/` | Group schemas by domain. Re-export in `src/schemas/index.ts`. |
| **New business logic or AI orchestration** | `src/lib/<domain>/<subdomain>/` | Pure deterministic functions where possible; keep side effects isolated. |
| **A new database table or enum** | `src/db/schema.ts` | Export table schema, then run `npm run db:generate` followed by `npm run db:push`. |
| **A new automated test suite** | `src/tests/<subdomain>/<feature>.test.ts` | Add the suite to `testSuites` in `src/tests/run-all.ts` so `npm test` runs it. |
| **A new drill topic or content bank** | `content/drills/<track>/` | Authored as JSON; validate with `npm run content:audit`. |
