export interface ConceptNode {
  slug: string;
  label: string;
  children?: { slug: string; label: string }[];
}

export interface DrillTaxonomyItem {
  title: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  defaultDifficulty: "foundational" | "mid" | "senior" | "staff";
  timeLimitSeconds: number;
  concepts: ConceptNode[];
}

export const DRILL_TAXONOMY: Record<string, DrillTaxonomyItem> = {
  "system-design": {
    title: "System Design & Distributed Scalability",
    category: "Architecture",
    description:
      "Deep architectural probe on microservices, caching topologies, eventual consistency, and high-throughput event processing.",
    icon: "system-design",
    color: "from-blue-500/10 to-indigo-500/10 border-indigo-200 text-indigo-700",
    defaultDifficulty: "staff",
    timeLimitSeconds: 900,
    concepts: [
      {
        slug: "cap-theorem",
        label: "CAP Theorem",
        children: [
          { slug: "consistency-models", label: "Consistency Models" },
          { slug: "partition-tolerance", label: "Partition Tolerance" },
          { slug: "pacelc-theorem", label: "PACELC Tradeoffs" },
        ],
      },
      {
        slug: "distributed-systems",
        label: "Distributed Systems",
        children: [
          { slug: "consensus-protocols", label: "Consensus Protocols (Raft & Paxos)" },
          { slug: "service-discovery", label: "Service Discovery & Health Checking" },
          { slug: "fault-tolerance", label: "Fault Tolerance & Circuit Breakers" },
        ],
      },
      {
        slug: "redis-caching",
        label: "Redis & Caching",
        children: [
          { slug: "cache-invalidation", label: "Cache Invalidation Strategies" },
          { slug: "cache-topologies", label: "Cache Topologies & Replication" },
          { slug: "write-policies", label: "Write-Through vs Write-Behind" },
        ],
      },
      {
        slug: "partitioning",
        label: "Partitioning & Sharding",
        children: [
          { slug: "sharding-strategies", label: "Sharding Strategies & Range Keys" },
          { slug: "rebalancing", label: "Cluster Rebalancing & Migration" },
          { slug: "consistent-hashing", label: "Consistent Hashing & Virtual Nodes" },
        ],
      },
      {
        slug: "event-processing",
        label: "Event Processing & Streaming",
        children: [
          { slug: "event-sourcing", label: "Event Sourcing & CQRS" },
          { slug: "stream-processing", label: "Stream Processing & Windowing" },
          { slug: "dead-letter-queues", label: "Dead-Letter Queues & Retries" },
        ],
      },
    ],
  },

  "algo-logic": {
    title: "Algorithmic Logic & Edge-Case Blitz",
    category: "Coding & Logic",
    description:
      "Targeted technical interrogation testing time/space complexity analysis, memory boundaries, and tricky edge-case invariants.",
    icon: "algo",
    color: "from-purple-500/10 to-pink-500/10 border-purple-200 text-purple-700",
    defaultDifficulty: "senior",
    timeLimitSeconds: 600,
    concepts: [
      {
        slug: "algorithms",
        label: "Core Algorithms",
        children: [
          { slug: "dynamic-programming", label: "Dynamic Programming Memoization" },
          { slug: "graph-traversal", label: "Graph Traversal (BFS & DFS)" },
          { slug: "greedy-heuristics", label: "Greedy Heuristics & Invariants" },
        ],
      },
      {
        slug: "data-structures",
        label: "Data Structures",
        children: [
          { slug: "tree-invariants", label: "Balanced Trees & Traversal" },
          { slug: "heap-operations", label: "Priority Queues & Heaps" },
          { slug: "hash-collision", label: "Hash Collision & Probing" },
        ],
      },
      {
        slug: "space-time-tradeoffs",
        label: "Space-Time Tradeoffs",
        children: [
          { slug: "auxiliary-space", label: "Auxiliary Space vs In-Place" },
          { slug: "amortized-complexity", label: "Amortized Complexity Analysis" },
          { slug: "bit-manipulation", label: "Bit Manipulation Tricks" },
        ],
      },
      {
        slug: "boundary-conditions",
        label: "Boundary Conditions & Invariants",
        children: [
          { slug: "off-by-one", label: "Off-by-One & Index Fences" },
          { slug: "integer-overflow", label: "Integer Overflow & Precision" },
          { slug: "empty-sparse-inputs", label: "Empty, Single, & Sparse Inputs" },
        ],
      },
    ],
  },

  "behavioral-star": {
    title: "Behavioral & Executive STAR Simulator",
    category: "Leadership",
    description:
      "Structured behavioral evaluation assessing conflict resolution, cross-functional ownership, engineering ethics, and delivery under pressure.",
    icon: "behavioral",
    color: "from-amber-500/10 to-orange-500/10 border-amber-200 text-amber-700",
    defaultDifficulty: "mid",
    timeLimitSeconds: 600,
    concepts: [
      {
        slug: "star-framework",
        label: "STAR Framework Articulation",
        children: [
          { slug: "situation-task-definition", label: "Crisp Situation & Task Scope" },
          { slug: "action-differentiation", label: "Personal Action vs Team Effort" },
          { slug: "quantifiable-results", label: "Measurable Business & Tech Results" },
        ],
      },
      {
        slug: "cross-functional-influence",
        label: "Cross-Functional Influence",
        children: [
          { slug: "stakeholder-alignment", label: "Aligning Product, Design, & Eng" },
          { slug: "executive-communication", label: "Executive Communication & Brevity" },
          { slug: "product-eng-tradeoffs", label: "Tech Debt vs Product Velocity" },
        ],
      },
      {
        slug: "conflict-resolution",
        label: "Conflict Resolution & Disagreement",
        children: [
          { slug: "technical-disagreements", label: "Architecture Disputes & Consensus" },
          { slug: "interpersonal-friction", label: "De-escalation & Psychological Safety" },
          { slug: "disagree-and-commit", label: "Disagree and Commit in Action" },
        ],
      },
      {
        slug: "ownership",
        label: "Ownership & Crisis Management",
        children: [
          { slug: "post-mortem-accountability", label: "Blameless Post-Mortems & Learning" },
          { slug: "deadline-pressure", label: "Handling Shifting Deadlines" },
          { slug: "unblocking-teams", label: "Unblocking Blocked Teammates" },
        ],
      },
    ],
  },

  "frontend-arch": {
    title: "Frontend Architecture & Web Systems",
    category: "Web & UI",
    description:
      "Rigorous probe into component composition, re-render lifecycles, CSS containment, state machines, and Core Web Vitals.",
    icon: "frontend",
    color: "from-cyan-500/10 to-blue-500/10 border-cyan-200 text-cyan-700",
    defaultDifficulty: "senior",
    timeLimitSeconds: 900,
    concepts: [
      {
        slug: "react-19",
        label: "React 19 & Component Architecture",
        children: [
          { slug: "server-components", label: "Server Components vs Client Components" },
          { slug: "action-transitions", label: "useActionState & Transitions" },
          { slug: "hook-internals", label: "Hook Rules & Memoization Lifecycles" },
        ],
      },
      {
        slug: "state-management",
        label: "State Management Architecture",
        children: [
          { slug: "state-machines", label: "Finite State Machines & Reducers" },
          { slug: "global-vs-local", label: "Context vs Store Partitioning" },
          { slug: "optimistic-updates", label: "Optimistic UI & Rollback Handlers" },
        ],
      },
      {
        slug: "dom-reconciliation",
        label: "DOM Reconciliation & CSS",
        children: [
          { slug: "virtual-dom-diffing", label: "Virtual DOM & Fiber Reconciliation" },
          { slug: "layout-thrashing", label: "Layout Thrashing & Reflow Prevention" },
          { slug: "css-containment", label: "CSS Containment & Composite Layers" },
        ],
      },
      {
        slug: "web-performance",
        label: "Web Performance & Vitals",
        children: [
          { slug: "core-web-vitals", label: "LCP, INP, & CLS Optimization" },
          { slug: "bundle-splitting", label: "Dynamic Import & Route Splitting" },
          { slug: "asset-prefetching", label: "Resource Hints & Speculative Fetch" },
        ],
      },
    ],
  },

  "database-concurrency": {
    title: "Database Internals & Concurrency Deep-Dive",
    category: "Persistence",
    description:
      "Focuses on transaction isolation (ACID, MVCC), index internals (B-Tree vs Hash), deadlocks, and connection pooling.",
    icon: "database",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-700",
    defaultDifficulty: "staff",
    timeLimitSeconds: 900,
    concepts: [
      {
        slug: "postgresql-internals",
        label: "PostgreSQL Engine Architecture",
        children: [
          { slug: "wal-logging", label: "Write-Ahead Logging (WAL) & Checkpoints" },
          { slug: "vacuum-mechanics", label: "VACUUM, Autovacuum, & Bloat" },
          { slug: "buffer-pool", label: "Shared Buffers & OS Page Cache" },
        ],
      },
      {
        slug: "mvcc-isolation",
        label: "MVCC & Transaction Isolation",
        children: [
          { slug: "read-committed-vs-serializable", label: "Read Committed vs Serializable" },
          { slug: "phantom-reads", label: "Phantom Reads & Write Skew" },
          { slug: "snapshot-isolation", label: "Snapshot Isolation & xmin/xmax" },
        ],
      },
      {
        slug: "b-trees-indexing",
        label: "Index Internals & Tuning",
        children: [
          { slug: "b-tree-structure", label: "B-Tree Pages & High Keys" },
          { slug: "gin-gist-indexes", label: "GIN, GiST, & BRIN Use Cases" },
          { slug: "index-scans-vs-seq-scans", label: "Index Scan vs Bitmap Index Scan" },
        ],
      },
      {
        slug: "deadlock-mitigation",
        label: "Deadlocks & Row Locking",
        children: [
          { slug: "lock-modes", label: "Row vs Table Lock Modes (FOR UPDATE)" },
          { slug: "deadlock-detection", label: "Deadlock Detection & Graph Cycles" },
          { slug: "pessimistic-vs-optimistic", label: "Pessimistic vs Optimistic Locking" },
        ],
      },
    ],
  },

  "rapid-screen": {
    title: "Rapid-Fire Technical Screening (5-Min Blitz)",
    category: "Speed Drills",
    description:
      "Fast-paced foundational triage covering HTTP/3, memory management, REST vs gRPC, and fundamental terminology.",
    icon: "rapid",
    color: "from-rose-500/10 to-amber-500/10 border-rose-200 text-rose-700",
    defaultDifficulty: "foundational",
    timeLimitSeconds: 300,
    concepts: [
      {
        slug: "cs-fundamentals",
        label: "CS Fundamentals",
        children: [
          { slug: "process-vs-thread", label: "Processes vs Threads & Context Switching" },
          { slug: "memory-stack-vs-heap", label: "Stack vs Heap Allocation" },
          { slug: "bitwise-logic", label: "Bitwise Operations & Masks" },
        ],
      },
      {
        slug: "networking",
        label: "Networking & Protocols",
        children: [
          { slug: "http3-quic", label: "HTTP/2 Multiplexing vs HTTP/3 QUIC" },
          { slug: "tcp-handshake", label: "TCP 3-Way Handshake & Teardown" },
          { slug: "dns-resolution", label: "DNS Hierarchy & TTL Resolution" },
        ],
      },
      {
        slug: "apis",
        label: "API Architecture & Contracts",
        children: [
          { slug: "rest-vs-grpc", label: "REST vs gRPC vs GraphQL" },
          { slug: "idempotency-keys", label: "Idempotent HTTP Methods & Replay Keys" },
          { slug: "websockets-vs-sse", label: "WebSockets vs Server-Sent Events" },
        ],
      },
      {
        slug: "concurrency",
        label: "Concurrency & Asynchrony",
        children: [
          { slug: "race-conditions", label: "Race Conditions & Atomic Operations" },
          { slug: "mutex-vs-semaphore", label: "Mutex vs Semaphore Synchronization" },
          { slug: "async-event-loop", label: "Microtasks & Macro Event Loop" },
        ],
      },
    ],
  },
} as const;
