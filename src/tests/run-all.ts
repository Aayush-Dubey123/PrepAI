/**
 * Comprehensive Test Runner for PrepAI
 *
 * Runs all deterministic unit, assertion, rate-limiting, and phase-verification test suites.
 * Exits with code 0 on complete success, or code 1 if any suite fails.
 */

import { spawnSync } from "child_process";

const testSuites = [
  { name: "Brain Core Logic", file: "src/tests/brain.test.ts" },
  { name: "Brain Step 4 Assertions", file: "src/tests/brain-step4.test.ts" },
  { name: "Answer Grounding & Follow-ups", file: "src/tests/answer-grounding.test.ts" },
  { name: "Rate Limit Assertions", file: "src/tests/rate-limit.test.ts" },
  { name: "Phase 1-6 Full Verification Harness", file: "src/tests/phase-verification.ts" },
  { name: "Analytics & Admin Auth Barriers", file: "src/tests/analytics-auth.test.ts" },
  { name: "Integrity Debounce & Cadence", file: "src/tests/integrity-debounce.test.ts" },
  { name: "Interview Room UI & Smoke", file: "src/tests/interview-room-smoke.test.ts" },
  { name: "Audio Conversation & Overlap", file: "src/tests/audio-conversation.test.ts" },
  { name: "Interview Deletion & Retention", file: "src/tests/interview-deletion.test.ts" },
  { name: "Security & Access Control", file: "src/tests/security.test.ts" },
];

if (testSuites.length !== 11) {
  console.error(`Expected exactly 11 test suites, found ${testSuites.length}`);
  process.exit(1);
}

console.log("\n=======================================================");
console.log("             PREPAI TEST SUITE RUNNER                 ");
console.log("=======================================================\n");

let allPassed = true;
const results: Array<{ name: string; passed: boolean; durationMs: number }> = [];

for (const suite of testSuites) {
  console.log(`\n▶ Running: ${suite.name} (${suite.file})`);
  const start = Date.now();
  const isWindows = process.platform === "win32";
  const run = spawnSync(isWindows ? "npx.cmd" : "npx", ["tsx", suite.file], {
    stdio: "inherit",
    shell: isWindows,
    env: { ...process.env, NODE_ENV: "test" },
  });
  const durationMs = Date.now() - start;
  const passed = run.status === 0;

  if (!passed) {
    allPassed = false;
  }
  results.push({ name: suite.name, passed, durationMs });
}

console.log("\n=======================================================");
console.log("                    SUMMARY RESULTS                    ");
console.log("=======================================================");
for (const r of results) {
  const icon = r.passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} | ${r.name.padEnd(40)} | ${(r.durationMs / 1000).toFixed(2)}s`);
}
console.log("=======================================================\n");

if (!allPassed) {
  console.error("❌ Some test suites failed.\n");
  process.exit(1);
} else {
  console.log("✅ All test suites passed successfully!\n");
  process.exit(0);
}
