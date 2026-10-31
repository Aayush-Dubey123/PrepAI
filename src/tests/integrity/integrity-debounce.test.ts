/**
 * Integrity Detector Debounce & Frame-Drop Grace Tolerance Test Suite
 *
 * Validates:
 * 1. Monotonic MediaPipe frame timestamp guarantees without wall-clock collision.
 * 2. 150ms grace tolerance window allows 1-2 dropped frames without premature condition reset.
 * 3. Sustained violations trigger reliably when duration >= debounce threshold:
 *    - multipleFaces: 1000ms (~15 frames @ ~66ms)
 *    - gazeAway: 4000ms (~60 frames @ ~66ms)
 *    - noFace: 5000ms (~75 frames @ ~66ms)
 * 4. Sub-debounce flickers (< debounce threshold) are cleanly filtered with 0 false violations.
 * 5. Cleared conditions (> 150ms absence) correctly reset and do not linger.
 */

import { IntegrityDetector } from "@/src/lib/integrity/detector";
import { INTEGRITY_CONFIG } from "@/src/lib/integrity/config";
import type { IntegrityEvent } from "@/src/schemas/practice/integrity";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log("\n=======================================================");
console.log("       INTEGRITY DEBOUNCE & TOLERANCE TEST SUITE       ");
console.log("=======================================================\n");

let passedCount = 0;

// Test 1: Sustained Violation Detection with Simulated ~15 FPS Sampling
console.log("▶ Test 1: Sustained multipleFaces triggers after 1000ms debounce");
{
  const violations: IntegrityEvent[] = [];
  const detector = new IntegrityDetector({
    onViolation: (v) => violations.push(v),
  });

  const startTime = 100000;
  const frameIntervalMs = 66; // ~15 FPS
  const requiredMs = INTEGRITY_CONFIG.debounceMs.multipleFaces; // 1000ms

  // Simulate frames for 1200ms (18 frames)
  for (let t = 0; t <= 1200; t += frameIntervalMs) {
    detector.checkCondition("multiple_faces", true, requiredMs, false, startTime + t);
  }

  assert(violations.length === 1, `Expected exactly 1 violation fired, got ${violations.length}`);
  assert(violations[0].type === "multiple_faces", `Expected multiple_faces type, got ${violations[0].type}`);
  assert(violations[0].durationMs >= 1000, `Expected duration >= 1000ms, got ${violations[0].durationMs}`);
  console.log("  ✅ Sustained multipleFaces violation fired accurately at debounce threshold");
  passedCount++;
}

// Test 2: Frame-Drop Grace Tolerance (1-2 intermediate missed frames do not reset tracker)
console.log("▶ Test 2: 1-2 dropped frames (<= 150ms gap) preserved by grace tolerance");
{
  const violations: IntegrityEvent[] = [];
  const detector = new IntegrityDetector({
    onViolation: (v) => violations.push(v),
  });

  const startTime = 200000;
  const requiredMs = INTEGRITY_CONFIG.debounceMs.multipleFaces; // 1000ms

  // Feed detection from 0 to 400ms
  for (let t = 0; t <= 400; t += 66) {
    detector.checkCondition("multiple_faces", true, requiredMs, false, startTime + t);
  }

  // 1-2 frames dropped (simulated pose/lighting flicker for 100ms: at t=466 and t=532)
  detector.checkCondition("multiple_faces", false, requiredMs, false, startTime + 466);
  detector.checkCondition("multiple_faces", false, requiredMs, false, startTime + 532);

  // Resume detection at t=598 through t=1100
  for (let t = 598; t <= 1100; t += 66) {
    detector.checkCondition("multiple_faces", true, requiredMs, false, startTime + t);
  }

  assert(violations.length === 1, `Grace tolerance should preserve sustained condition across dropped frames; violations: ${violations.length}`);
  console.log("  ✅ Grace tolerance preserved sustained violation across 100ms dropped frames");
  passedCount++;
}

// Test 3: Sub-debounce transient flicker does NOT trigger violation
console.log("▶ Test 3: Sub-debounce transient flickers are filtered out");
{
  const violations: IntegrityEvent[] = [];
  const detector = new IntegrityDetector({
    onViolation: (v) => violations.push(v),
  });

  const startTime = 300000;
  const requiredMs = INTEGRITY_CONFIG.debounceMs.multipleFaces; // 1000ms

  // Detected for only 400ms (well below 1000ms)
  for (let t = 0; t <= 400; t += 66) {
    detector.checkCondition("multiple_faces", true, requiredMs, false, startTime + t);
  }

  // Cleared for > 150ms (at t=600 and t=700)
  detector.checkCondition("multiple_faces", false, requiredMs, false, startTime + 600);
  detector.checkCondition("multiple_faces", false, requiredMs, false, startTime + 700);

  assert(violations.length === 0, `Sub-debounce event must not fire violation; fired: ${violations.length}`);
  console.log("  ✅ Sub-debounce flicker filtered cleanly with 0 false violations");
  passedCount++;
}

// Test 4: Sustained gazeAway (4000ms) triggers at ~60 frames
console.log("▶ Test 4: Sustained gazeAway triggers after 4000ms debounce");
{
  const violations: IntegrityEvent[] = [];
  const detector = new IntegrityDetector({
    onViolation: (v) => violations.push(v),
  });

  const startTime = 400000;
  const frameIntervalMs = 66;
  const requiredMs = INTEGRITY_CONFIG.debounceMs.gazeAway; // 4000ms

  // Simulate 4200ms of gaze away
  for (let t = 0; t <= 4200; t += frameIntervalMs) {
    detector.checkCondition("gaze_away", true, requiredMs, false, startTime + t);
  }

  assert(violations.length === 1, `Expected 1 gaze_away violation, got ${violations.length}`);
  assert(violations[0].type === "gaze_away", `Expected gaze_away, got ${violations[0].type}`);
  assert(violations[0].durationMs >= 4000, `Expected duration >= 4000, got ${violations[0].durationMs}`);
  console.log("  ✅ Sustained gazeAway fired after 4000ms");
  passedCount++;
}

// Test 5: Sustained noFace (5000ms) triggers after 5000ms
console.log("▶ Test 5: Sustained noFace triggers after 5000ms debounce");
{
  const violations: IntegrityEvent[] = [];
  const detector = new IntegrityDetector({
    onViolation: (v) => violations.push(v),
  });

  const startTime = 500000;
  const frameIntervalMs = 66;
  const requiredMs = INTEGRITY_CONFIG.debounceMs.noFace; // 5000ms

  // Simulate 5200ms of no face
  for (let t = 0; t <= 5200; t += frameIntervalMs) {
    detector.checkCondition("no_face", true, requiredMs, false, startTime + t);
  }

  assert(violations.length === 1, `Expected 1 no_face violation, got ${violations.length}`);
  assert(violations[0].type === "no_face", `Expected no_face, got ${violations[0].type}`);
  assert(violations[0].durationMs >= 5000, `Expected duration >= 5000, got ${violations[0].durationMs}`);
  console.log("  ✅ Sustained noFace fired after 5000ms");
  passedCount++;
}

// Test 6: Cooldown prevents duplicate spamming within 10 seconds
console.log("▶ Test 6: 10s cooldown prevents duplicate violation spam");
{
  const violations: IntegrityEvent[] = [];
  const detector = new IntegrityDetector({
    onViolation: (v) => violations.push(v),
  });

  const startTime = 600000;
  const requiredMs = INTEGRITY_CONFIG.debounceMs.multipleFaces; // 1000ms

  // Continuous violation for 5000ms (longer than 1000ms)
  for (let t = 0; t <= 5000; t += 66) {
    detector.checkCondition("multiple_faces", true, requiredMs, false, startTime + t);
  }

  assert(violations.length === 1, `Cooldown must prevent duplicate fire within 10s; fired: ${violations.length}`);
  console.log("  ✅ 10s cooldown prevented duplicate spamming");
  passedCount++;
}

// Test 7: Condition cleared > 150ms deletes condition tracker cleanly
console.log("▶ Test 7: Absence > 150ms resets tracker so next occurrence starts fresh");
{
  const violations: IntegrityEvent[] = [];
  const detector = new IntegrityDetector({
    onViolation: (v) => violations.push(v),
  });

  const startTime = 700000;
  const requiredMs = INTEGRITY_CONFIG.debounceMs.multipleFaces; // 1000ms

  // First occurrence: 800ms (not quite enough for 1000ms)
  for (let t = 0; t <= 800; t += 66) {
    detector.checkCondition("multiple_faces", true, requiredMs, false, startTime + t);
  }

  // Clear for 300ms (> 150ms)
  detector.checkCondition("multiple_faces", false, requiredMs, false, startTime + 1100);

  // Second occurrence: 400ms (should start from 0, not resume from 800ms!)
  for (let t = 1200; t <= 1600; t += 66) {
    detector.checkCondition("multiple_faces", true, requiredMs, false, startTime + t);
  }

  assert(violations.length === 0, `Reset tracker must not combine split occurrences; fired: ${violations.length}`);
  console.log("  ✅ Cleared condition reset tracker cleanly");
  passedCount++;
}

console.log("\n=======================================================");
console.log(`Results: ${passedCount} passed  0 failed  (${passedCount} total)`);
console.log("=======================================================\n");
process.exit(0);
