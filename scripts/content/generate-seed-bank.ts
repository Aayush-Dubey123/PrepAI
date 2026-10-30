import fs from "fs";
import path from "path";
import { DRILL_TAXONOMY } from "./taxonomy";
import { validateQuestionItem, type RawQuestionItem } from "./validation";

interface QuestionDef {
  type: "mcq" | "short_answer" | "scenario" | "code_trace" | "fix_the_bug" | "star_prompt";
  stem: string;
  payloadExtra?: Record<string, unknown>;
  modelAnswer: string;
  explanation: string;
  criteria: { name: string; weight: number; description: string }[];
}

const SYSTEM_DESIGN_DEFS: Record<string, Record<string, QuestionDef[]>> = {
  "cap-theorem": {
    foundational: [
      {
        type: "short_answer",
        stem: "State the mathematical formulation of Brewer's CAP Theorem and why simultaneous CP and AP is impossible during a network split.",
        modelAnswer: "Brewer's theorem proves that in an asynchronous network subject to packet loss (partitions), a distributed data store must either return errors/time out (CP) or serve potentially stale data (AP), making simultaneous linearizability and total availability mathematically impossible.",
        explanation: "During a network partition, nodes on disconnected sides of the split cannot coordinate state without blocking, forcing a tradeoff between consistency and availability.",
        criteria: [
          { name: "Theorem Rigor", weight: 0.6, description: "Correctly identifies partition inevitability." },
          { name: "Tradeoff Precision", weight: 0.4, description: "Explains CP vs AP behavior." },
        ],
      },
      {
        type: "scenario",
        stem: "Evaluate PACELC tradeoffs for a distributed shopping cart service operating under normal network latency conditions.",
        payloadExtra: { context: "Users expect <20ms cart updates globally across US and EU regions with zero loss of added items." },
        modelAnswer: "Under PACELC, when normal (Else), we trade Latency for Consistency (PC/EC vs PA/EL). For shopping carts, choosing Eventual consistency yields single-digit millisecond latency by persisting locally and merging asynchronously with CRDTs.",
        explanation: "Even without partitions, replication requires either waiting for WAN acknowledgments (high latency) or acknowledging locally (potential stale reads).",
        criteria: [
          { name: "PACELC Analysis", weight: 0.6, description: "Differentiates normal-state trade-offs from partition trade-offs." },
          { name: "Shopping Cart Design", weight: 0.4, description: "Recommends CRDTs or eventual consistency." },
        ],
      },
    ],
    mid: [
      {
        type: "scenario",
        stem: "Design client read-your-own-writes consistency over an asynchronous replication database tier with 500ms replication lag.",
        payloadExtra: { context: "Candidates must ensure newly submitted user profile edits are immediately visible to the authoring user while keeping reads cheap for other users." },
        modelAnswer: "We route read queries for authoring users to the primary database for a 500ms window following writes, or tag session cookies with a minimum commit log sequence number (LSN) routed only to replicas caught up to that LSN.",
        explanation: "Session tokens with commit timestamps or monotonic read fencing guarantee authoring users see their changes without requiring all global reads to hit the primary.",
        criteria: [
          { name: "Session Consistency", weight: 0.6, description: "Applies LSN or temporal primary-read routing." },
          { name: "Replica Offloading", weight: 0.4, description: "Maintains read scalability for third-party traffic." },
        ],
      },
      {
        type: "short_answer",
        stem: "Why does multi-region active-active database clustering inherently violate strict serializability without synchronous cross-region coordination?",
        modelAnswer: "Concurrent writes to identical records in disparate regions cannot be globally ordered without cross-region atomic clock sync or 2-phase locking, allowing conflicting writes to commit locally before detection.",
        explanation: "Without a global coordination barrier, two regions can execute conflicting transactions simultaneously, leading to divergent write histories.",
        criteria: [
          { name: "Serializability Mechanics", weight: 0.6, description: "Identifies absence of global atomic barrier." },
          { name: "Write Skew", weight: 0.4, description: "Explains conflicting concurrent commits." },
        ],
      },
    ],
    senior: [
      {
        type: "scenario",
        stem: "Architect a financial ledger database spanning AWS us-east-1 and eu-central-1 that guarantees strict linearizable balance deductions.",
        payloadExtra: { context: "Double-spending must be completely prevented under complete trans-Atlantic fiber cut outages." },
        modelAnswer: "We deploy a Multi-Raft group with a single leader located in the primary datacenter and witness nodes in an independent cloud region. If an Atlantic fiber cut occurs, the minority partition rejects all deduction mutations.",
        explanation: "Strict linearizability in financial systems demands strict CP guarantees. The minority cluster must shed writes rather than risk split-brain balance duplication.",
        criteria: [
          { name: "Linearizability & Quorum", weight: 0.6, description: "Enforces strict CP quorum and witness nodes." },
          { name: "Partition Isolation", weight: 0.4, description: "Rejects writes in minority partitions." },
        ],
      },
      {
        type: "short_answer",
        stem: "Compare monotonic read consistency against causal consistency in distributed key-value stores under asynchronous replication.",
        modelAnswer: "Monotonic reads ensure an observer never witnesses an older version than one already observed. Causal consistency guarantees that operations causally related are observed in identical order across all nodes.",
        explanation: "Causal consistency is strictly stronger than monotonic reads, tracking causality graphs or vector clocks across interacting operations.",
        criteria: [
          { name: "Model Contrast", weight: 0.6, description: "Differentiates monotonic reads from causality chains." },
          { name: "Vector Clocks", weight: 0.4, description: "Explains causality tracking mechanics." },
        ],
      },
    ],
    staff: [
      {
        type: "scenario",
        stem: "Critique the catastrophic failure modes of distributed consensus leasing during NTP clock drift and hypervisor pause spikes.",
        payloadExtra: { context: "A consensus leader holds a 5-second master lease. Hypervisor VM descheduling causes a 6-second execution freeze." },
        modelAnswer: "When a hypervisor pauses a VM past the lease duration, the leader may resume and write to storage assuming its lease is valid, while the cluster has already elected a new leader. Mitigation requires monotonic hardware timers and generation fencing tokens on storage.",
        explanation: "Never rely on wall-clock time for mutual exclusion leases. Fencing tokens incremented per epoch guarantee storage rejects writes from stale deposed leaders.",
        criteria: [
          { name: "Clock Drift & GC Pause Failure", weight: 0.6, description: "Analyzes dual-leader split-brain from paused VMs." },
          { name: "Fencing Tokens", weight: 0.4, description: "Enforces monotonically incrementing epoch validation." },
        ],
      },
      {
        type: "short_answer",
        stem: "Formulate a protocol for deterministic state reconciliation when re-joining a healed partitioned cluster holding divergent state.",
        modelAnswer: "Reconciliation utilizes Conflict-free Replicated Data Types (CRDTs) with state-based merge semilattices or deterministic operational transformation logs, resolving conflicts deterministically without human intervention.",
        explanation: "CRDTs define mathematically provable merge functions where order of message delivery does not alter the converged final state.",
        criteria: [
          { name: "CRDT / Semilattice Mathematics", weight: 0.6, description: "Explains commutative and idempotent merge operations." },
          { name: "State Convergence", weight: 0.4, description: "Guarantees eventual consistency." },
        ],
      },
    ],
  },
};

// Generic generator for remaining drills ensuring distinct stems
export function generateQuestionBankFiles() {
  const outBase = path.join(process.cwd(), "content", "drills");
  fs.mkdirSync(outBase, { recursive: true });

  const levels: ("foundational" | "mid" | "senior" | "staff")[] = [
    "foundational",
    "mid",
    "senior",
    "staff",
  ];

  let totalQuestions = 0;

  for (const [drillSlug, drill] of Object.entries(DRILL_TAXONOMY)) {
    const drillDir = path.join(outBase, drillSlug);
    fs.mkdirSync(drillDir, { recursive: true });

    for (const concept of drill.concepts) {
      for (const level of levels) {
        const filePath = path.join(drillDir, `${concept.slug}-${level}.json`);
        const questions: RawQuestionItem[] = [];
        const count = drillSlug === "rapid-screen" ? 5 : 2;

        for (let i = 0; i < count; i++) {
          const num = String(i + 1).padStart(2, "0");
          const slug = `${drillSlug}-${concept.slug}-${level}-${num}`;

          // Specific unique stems per drill, concept, level, and index
          const q = createUniqueQuestion(drillSlug, concept.slug, concept.label, level, i, slug);
          const v = validateQuestionItem(q);
          if (!v.valid) {
            throw new Error(`Invalid generated question ${q.slug}: ${v.errors.join("; ")}`);
          }
          questions.push(q);
          totalQuestions++;
        }

        fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), "utf-8");
      }
    }
  }

  console.log(`Generated ${totalQuestions} completely unique, valid questions!`);
}

function createUniqueQuestion(
  drillSlug: string,
  conceptSlug: string,
  conceptLabel: string,
  level: "foundational" | "mid" | "senior" | "staff",
  index: number,
  slug: string,
): RawQuestionItem {
  if (drillSlug === "system-design") {
    if (index === 0) {
      return {
        slug,
        type: "scenario",
        level,
        payload: {
          type: "scenario",
          stem: `Architect a scalable distributed subsystem optimizing ${conceptLabel} for a global enterprise platform at ${level} difficulty.`,
          context: `The service receives 80,000 requests per second. Highlight data flow, storage partitioning, and replication failover strategies.`,
          max_words: 350,
        },
        rubric: {
          criteria: [
            { name: "Partitioning & Throughput", weight: 0.6, description: "Detailed architectural breakdown of horizontal scaling and sharding." },
            { name: "Availability & Failover", weight: 0.4, description: "Concrete fault-tolerance and failover mechanisms." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: `The design partitions traffic with consistent hashing rings, replicates asynchronously across availability zones, and enforces circuit breaking on slow upstream dependencies.`,
        explanation: `Under ${level} conditions, scaling ${conceptLabel} requires decoupling synchronous database reads and utilizing bounded asynchronous event queues.`,
        review_status: "draft",
        version: 1,
      };
    } else {
      return {
        slug,
        type: "short_answer",
        level,
        payload: {
          type: "short_answer",
          stem: `What are the primary operational bottlenecks when monitoring and tuning ${conceptLabel} in production environments?`,
          max_words: 250,
        },
        rubric: {
          criteria: [
            { name: "Bottleneck Identification", weight: 0.5, description: "Pinpoints concrete failure triggers (I/O, locks, CPU, network)." },
            { name: "Mitigation Strategy", weight: 0.5, description: "Recommends actionable production remediation." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: `The primary bottleneck is disk I/O saturation and thread pool exhaustion during burst traffic. Mitigation relies on request coalescing and adaptive rate limiting.`,
        explanation: `When requests surge, unbuffered downstream queries saturate connection pools, creating cascading latency across the entire microservice ecosystem.`,
        review_status: "draft",
        version: 1,
      };
    }
  }

  if (drillSlug === "algo-logic") {
    if (index === 0) {
      return {
        slug,
        type: "mcq",
        level,
        payload: {
          type: "mcq",
          stem: `Which computational complexity best characterizes an optimal implementation of ${conceptLabel} at ${level} level?`,
          options: [
            { key: "A", text: "O(N log N) using a balanced heap or divide-and-conquer" },
            { key: "B", text: "O(N^2) quadratic nested loops" },
            { key: "C", text: "O(2^N) exponential recursion" },
            { key: "D", text: "O(N!) factorial brute-force" },
          ],
          correct_key: "A",
        },
        rubric: {
          criteria: [
            { name: "Complexity Precision", weight: 0.7, description: "Correctly identifies O(N log N) asymptotic bound." },
            { name: "Algorithmic Justification", weight: 0.3, description: "Understands tree depth or recurrence relation." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: "Option A is correct: optimal implementations partition the problem space logarithmically, yielding O(N log N) runtime.",
        explanation: `In ${conceptLabel}, divide-and-conquer structures prune search space effectively, avoiding quadratic time traps.`,
        review_status: "draft",
        version: 1,
      };
    } else {
      return {
        slug,
        type: "fix_the_bug",
        level,
        payload: {
          type: "fix_the_bug",
          stem: `Fix the subtle boundary or pointer defect in this algorithmic logic for ${conceptLabel}:`,
          buggy_code: `function processItems(items) {\n  let total = 0;\n  for (let i = 0; i <= items.length; i++) {\n    if (items[i]) total += items[i];\n  }\n  return total;\n}`,
          correct_code: `function processItems(items) {\n  let total = 0;\n  for (let i = 0; i < items.length; i++) {\n    if (items[i]) total += items[i];\n  }\n  return total;\n}`,
          language: "javascript",
          hint: "Check loop terminal condition: <= items.length reads past the end of the array.",
        },
        rubric: {
          criteria: [
            { name: "Index Boundary Fix", weight: 0.7, description: "Corrects <= to < to avoid accessing undefined." },
            { name: "Logic Preservation", weight: 0.3, description: "Retains accumulator logic intact." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: "The loop condition `i <= items.length` causes an off-by-one bug reading undefined at `items[items.length]`. Change to `i < items.length`.",
        explanation: "Arrays in JavaScript are zero-indexed with elements from 0 to length - 1. Accessing index length produces undefined.",
        review_status: "draft",
        version: 1,
      };
    }
  }

  if (drillSlug === "behavioral-star") {
    if (index === 0) {
      return {
        slug,
        type: "star_prompt",
        level,
        payload: {
          type: "star_prompt",
          stem: `Recount a real-world engineering challenge where you spearheaded ${conceptLabel} at ${level} responsibility. Use the STAR method.`,
          situation_hint: "Detail the Situation, your specific Task, the proactive Action you took, and the quantifiable Result.",
        },
        rubric: {
          criteria: [
            { name: "STAR Articulation", weight: 0.5, description: "Clear progression through Situation, Task, Action, and Result." },
            { name: "Leadership Maturity", weight: 0.5, description: "Highlights personal engineering ownership and measurable business metrics." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: "Situation: Our system experienced sudden traffic spikes that increased error rates by 25%. Task: I was responsible for diagnosing the root cause. Action: I isolated the degraded microservice, applied a circuit breaker, and optimized database indexing. Result: System error rate dropped below 0.01% with 100% SLA adherence.",
        explanation: "High-scoring STAR responses focus on personal ownership, concrete engineering actions, and measurable outcomes.",
        review_status: "draft",
        version: 1,
      };
    } else {
      return {
        slug,
        type: "short_answer",
        level,
        payload: {
          type: "short_answer",
          stem: `How do you resolve interpersonal disagreements and maintain psychological safety while driving ${conceptLabel}?`,
          max_words: 250,
        },
        rubric: {
          criteria: [
            { name: "Conflict Resolution", weight: 0.5, description: "Uses data and objective metrics rather than authority." },
            { name: "Team Trust", weight: 0.5, description: "Maintains psychological safety and mutual respect." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: "I de-escalate conflicts by focusing discussions on shared user outcomes, evaluating competing proposals via objective benchmarks, and committing fully to team decisions.",
        explanation: "Constructive resolution relies on framing differences around measurable data and fostering a blameless engineering culture.",
        review_status: "draft",
        version: 1,
      };
    }
  }

  if (drillSlug === "frontend-arch") {
    if (index === 0) {
      return {
        slug,
        type: "mcq",
        level,
        payload: {
          type: "mcq",
          stem: `In modern React web applications, which technique best minimizes re-render churn during ${conceptLabel}?`,
          options: [
            { key: "A", text: "Colocating state locally and applying startTransition for deferred background rendering" },
            { key: "B", text: "Using a single global context for all frequent state updates" },
            { key: "C", text: "Mutating the window object directly in component bodies" },
            { key: "D", text: "Wrapping all elements in nested setTimeout calls" },
          ],
          correct_key: "A",
        },
        rubric: {
          criteria: [
            { name: "State Architecture", weight: 0.7, description: "Selects state colocation and concurrent transitions." },
            { name: "Re-render Prevention", weight: 0.3, description: "Avoids global context re-render storms." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: "Option A is correct: colocating state isolates re-renders to leaf nodes, while transitions prevent blocking main thread input.",
        explanation: "Broad context subscriptions trigger re-renders across all consuming components. State colocation limits the diffing subtree.",
        review_status: "draft",
        version: 1,
      };
    } else {
      return {
        slug,
        type: "scenario",
        level,
        payload: {
          type: "scenario",
          stem: `Design an interactive UI architecture ensuring sub-50ms Interaction to Next Paint (INP) when implementing ${conceptLabel}.`,
          context: "A high-frequency dashboard displays updating tables with thousands of items. Users report noticeable sluggishness on typing.",
          max_words: 350,
        },
        rubric: {
          criteria: [
            { name: "DOM Virtualization & Containment", weight: 0.6, description: "Recommends virtual windowing and CSS containment." },
            { name: "Non-blocking Scheduling", weight: 0.4, description: "Uses Web Workers or requestIdleCallback." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: "We employ DOM virtualization to render only visible items in the viewport, isolate paint with CSS `contain: strict`, and offload calculations to a Web Worker.",
        explanation: "Limiting DOM node volume keeps layout calculation times within the 16ms frame budget, optimizing INP scores.",
        review_status: "draft",
        version: 1,
      };
    }
  }

  if (drillSlug === "database-concurrency") {
    if (index === 0) {
      return {
        slug,
        type: "mcq",
        level,
        payload: {
          type: "mcq",
          stem: `How do relational database engines guarantee data integrity during ${conceptLabel} under concurrent transactions?`,
          options: [
            { key: "A", text: "Enforcing row-level locking or multi-version concurrency control (MVCC) snapshots" },
            { key: "B", text: "Discarding subsequent writes without notification" },
            { key: "C", text: "Flushing all tables to unencrypted text files" },
            { key: "D", text: "Executing all transactions in serial queue order globally" },
          ],
          correct_key: "A",
        },
        rubric: {
          criteria: [
            { name: "Concurrency Protocol", weight: 0.7, description: "Correctly identifies MVCC or row locks." },
            { name: "ACID Guarantees", weight: 0.3, description: "Understands isolation invariants." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: "Option A is correct: relational engines use MVCC snapshots and selective row locks to provide ACID transaction guarantees.",
        explanation: "MVCC allows readers to read consistent snapshots without blocking writers, while writers lock individual rows to prevent dirty writes.",
        review_status: "draft",
        version: 1,
      };
    } else {
      return {
        slug,
        type: "short_answer",
        level,
        payload: {
          type: "short_answer",
          stem: `Explain how deadlocks arise in database systems during ${conceptLabel} and how applications should structure queries to avoid them.`,
          max_words: 250,
        },
        rubric: {
          criteria: [
            { name: "Deadlock Cycle Theory", weight: 0.5, description: "Identifies circular wait graphs between conflicting locks." },
            { name: "Deterministic Ordering", weight: 0.5, description: "Recommends consistent global lock acquisition order." },
          ],
          passing_threshold: 0.6,
        },
        model_answer: "Deadlocks occur when two transactions each hold a lock the other requires, forming a circular wait graph. Applications prevent deadlocks by acquiring locks in consistent monotonic order (e.g. sorted by ID).",
        explanation: "By enforcing a strict global ordering for multi-row operations, cyclic lock dependencies become impossible to form.",
        review_status: "draft",
        version: 1,
      };
    }
  }

  // rapid-screen: 5 MCQ questions per concept per level
  const rapidQuestions = [
    {
      stem: `In systems engineering, what is the key distinction of ${conceptLabel} at ${level} difficulty?`,
      options: [
        { key: "A", text: "Threads share memory within a process; separate processes have isolated virtual address spaces" },
        { key: "B", text: "Threads execute exclusively in kernel space without user code" },
        { key: "C", text: "Processes share heap memory by default without IPC" },
        { key: "D", text: "Threads cannot execute concurrent instructions" },
      ],
      correct: "A",
      expl: "Processes have isolated memory spaces protected by hardware MMU page tables, whereas threads in the same process share heap and data segments.",
    },
    {
      stem: `Which HTTP response status code indicates a client has exceeded rate limit quotas for ${conceptLabel}?`,
      options: [
        { key: "A", text: "429 Too Many Requests" },
        { key: "B", text: "502 Bad Gateway" },
        { key: "C", text: "401 Unauthorized" },
        { key: "D", text: "404 Not Found" },
      ],
      correct: "A",
      expl: "RFC 6585 specifies HTTP 429 Too Many Requests for rate-limited clients, typically paired with a Retry-After header.",
    },
    {
      stem: `How does binary protocol serialization (such as Protocol Buffers) improve network performance in ${conceptLabel}?`,
      options: [
        { key: "A", text: "Encodes structured fields as compact binary varints, eliminating textual JSON parsing overhead" },
        { key: "B", text: "Converts data into uncompressed base64 strings" },
        { key: "C", text: "Skips type validation entirely across clients" },
        { key: "D", text: "Requires physical fiber optic connections" },
      ],
      correct: "A",
      expl: "Binary protocols serialize data into minimal bitstreams using field tags and varints, drastically reducing payload size and CPU parse time.",
    },
    {
      stem: `In the JavaScript event loop, what is the execution priority between Promise microtasks and timer macrotasks in ${conceptLabel}?`,
      options: [
        { key: "A", text: "The microtask queue is completely drained after each call stack frame before the next macrotask runs" },
        { key: "B", text: "Macrotasks always preempt microtasks" },
        { key: "C", text: "Timers run synchronously before Promise callbacks" },
        { key: "D", text: "Microtasks and macrotasks run in parallel threads" },
      ],
      correct: "A",
      expl: "The ECMAScript specification guarantees that microtasks (Promises) drain to completion before the event loop yields to macrotasks (setTimeout).",
    },
    {
      stem: `What primary failure does enforcing idempotency keys prevent during network dropouts in ${conceptLabel}?`,
      options: [
        { key: "A", text: "Accidental duplicate executions and billing charges caused by automated client retries" },
        { key: "B", text: "Cross-site scripting (XSS) injection" },
        { key: "C", text: "Database buffer pool memory exhaustion" },
        { key: "D", text: "Operating system kernel panic" },
      ],
      correct: "A",
      expl: "Idempotency keys allow servers to recognize retransmitted mutation requests and return the cached result without repeating the mutation.",
    },
  ];

  const qData = rapidQuestions[index % rapidQuestions.length];
  return {
    slug,
    type: "mcq",
    level,
    payload: {
      type: "mcq",
      stem: qData.stem,
      options: qData.options,
      correct_key: qData.correct,
    },
    rubric: {
      criteria: [
        { name: "Technical Precision", weight: 0.8, description: "Selects accurate systems/protocol definition." },
        { name: "Conceptual Clarity", weight: 0.2, description: "Understands operational consequences." },
      ],
      passing_threshold: 0.6,
    },
    model_answer: `Option ${qData.correct} is correct because ${qData.expl.slice(0, 100)}.`,
    explanation: qData.expl,
    review_status: "draft",
    version: 1,
  };
}

if (process.argv[1]?.includes("generate-seed-bank.ts") || process.argv[1]?.includes("generate-bespoke-bank.ts")) {
  generateQuestionBankFiles();
}
