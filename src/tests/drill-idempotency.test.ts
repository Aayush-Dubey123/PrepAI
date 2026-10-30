export {};

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ❌  ${name}\n     ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEq<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} — Expected: ${expected}, Got: ${actual}`);
  }
}

console.log("\n=======================================================");
console.log("       DRILL IDEMPOTENCY & CONCURRENCY SUITE           ");
console.log("=======================================================\n");

test("ClientRequestId scoped to userId returns existing session on replay", () => {
  const sessionDb: Record<string, { id: string; userId: string; clientRequestId: string }> = {};

  function createOrGetSession(userId: string, clientRequestId: string): { id: string; reused: boolean } {
    const key = `${userId}:${clientRequestId}`;
    if (sessionDb[key]) {
      return { id: sessionDb[key].id, reused: true };
    }
    const newSession = {
      id: `session_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      clientRequestId,
    };
    sessionDb[key] = newSession;
    return { id: newSession.id, reused: false };
  }

  const firstCall = createOrGetSession("user_123", "req_abc");
  assertEq(firstCall.reused, false, "First call must create a new session");

  const replayCall = createOrGetSession("user_123", "req_abc");
  assertEq(replayCall.reused, true, "Replay with same clientRequestId must be recognized");
  assertEq(replayCall.id, firstCall.id, "Replay must return identical session ID");

  // Different user with same clientRequestId
  const differentUserCall = createOrGetSession("user_999", "req_abc");
  assertEq(differentUserCall.reused, false, "Different user must not collide with other user's clientRequestId");
  assert(differentUserCall.id !== firstCall.id, "Different user must get distinct session ID");
});

test("Duplicate (session_id, question_id) answer returns cached response without double-advancing", () => {
  const answersDb: Record<string, { score: number; isCorrect: boolean }> = {};
  let currentIndex = 0;

  function submitAnswer(sessionId: string, questionId: string, answer: string): { score: number; cached: boolean } {
    const key = `${sessionId}:${questionId}`;
    if (answersDb[key]) {
      return { score: answersDb[key].score, cached: true };
    }
    const result = { score: answer === "A" ? 1.0 : 0.0, isCorrect: answer === "A" };
    answersDb[key] = result;
    currentIndex++; // increment index on new answer
    return { score: result.score, cached: false };
  }

  const firstSub = submitAnswer("session_1", "q_1", "A");
  assertEq(firstSub.cached, false, "First submission must be processed");
  assertEq(firstSub.score, 1.0, "Score is 1.0");
  assertEq(currentIndex, 1, "Index advanced to 1");

  const duplicateSub = submitAnswer("session_1", "q_1", "A");
  assertEq(duplicateSub.cached, true, "Duplicate answer must return cached result");
  assertEq(duplicateSub.score, 1.0, "Score is 1.0");
  assertEq(currentIndex, 1, "Index must NOT advance on duplicate answer");
});

test("Optimistic Concurrency Lock: rejects simultaneous index advances", () => {
  class ConcurrentSubmissionError extends Error {}

  let sessionIndex = 0;

  function simulateConcurrentAdvance(expectedIndex: number) {
    if (sessionIndex !== expectedIndex) {
      throw new ConcurrentSubmissionError("Current index already advanced by concurrent request");
    }
    sessionIndex++;
  }

  // Request 1 succeeds
  simulateConcurrentAdvance(0);
  assertEq(sessionIndex, 1, "Index successfully advanced to 1");

  // Request 2 (competing simultaneous request with stale expectedIndex 0) fails
  let caught = false;
  try {
    simulateConcurrentAdvance(0);
  } catch (err) {
    if (err instanceof ConcurrentSubmissionError) caught = true;
  }

  assert(caught, "Concurrent update with stale index must throw ConcurrentSubmissionError");
  assertEq(sessionIndex, 1, "Index must remain 1 without corruption");
});

console.log("\n=======================================================");
console.log(`Results: ${passed} passed  ${failed} failed  (${passed + failed} total)`);
console.log("=======================================================\n");

if (failed > 0) process.exit(1);
