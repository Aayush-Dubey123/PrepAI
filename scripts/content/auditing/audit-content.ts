 import fs from "fs";
import path from "path";
import { DRILL_TAXONOMY } from "../taxonomy/taxonomy";
import { validateQuestionItem, jaccardSimilarity, type RawQuestionItem } from "../taxonomy/validation";

interface AuditResult {
  drillSlug: string;
  totalQuestions: number;
  draftCount: number;
  approvedCount: number;
  invalidCount: number;
  conceptsWithFewQuestions: string[];
  duplicatePairs: { q1: string; q2: string; similarity: number }[];
}

export function runContentAudit(): AuditResult[] {
  const contentDir = path.join(process.cwd(), "content", "drills");
  if (!fs.existsSync(contentDir)) {
    return [];
  }

  const results: AuditResult[] = [];

  for (const [drillSlug, drill] of Object.entries(DRILL_TAXONOMY)) {
    const drillDir = path.join(contentDir, drillSlug);
    if (!fs.existsSync(drillDir)) {
      results.push({
        drillSlug,
        totalQuestions: 0,
        draftCount: 0,
        approvedCount: 0,
        invalidCount: 0,
        conceptsWithFewQuestions: drill.concepts.map((c) => c.slug),
        duplicatePairs: [],
      });
      continue;
    }

    const files = fs.readdirSync(drillDir).filter((f) => f.endsWith(".json"));
    const allQuestions: RawQuestionItem[] = [];
    let invalidCount = 0;
    const conceptCounts: Record<string, number> = {};

    for (const f of files) {
      const filePath = path.join(drillDir, f);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (Array.isArray(content)) {
          for (const item of content) {
            const v = validateQuestionItem(item);
            if (!v.valid) {
              invalidCount++;
            } else {
              allQuestions.push(item as RawQuestionItem);
              const conceptSlug = f.split("-")[0];
              conceptCounts[conceptSlug] = (conceptCounts[conceptSlug] || 0) + 1;
            }
          }
        }
      } catch {
        invalidCount++;
      }
    }

    let draftCount = 0;
    let approvedCount = 0;
    for (const q of allQuestions) {
      if (q.review_status === "approved") {
        approvedCount++;
      } else {
        draftCount++;
      }
    }

    // Check duplicate pairs
    const duplicatePairs: { q1: string; q2: string; similarity: number }[] = [];
    for (let i = 0; i < allQuestions.length; i++) {
      for (let j = i + 1; j < allQuestions.length; j++) {
        const stem1 = allQuestions[i].payload.stem;
        const stem2 = allQuestions[j].payload.stem;
        const sim = jaccardSimilarity(stem1, stem2);
        if (sim > 0.5) {
          duplicatePairs.push({
            q1: allQuestions[i].slug,
            q2: allQuestions[j].slug,
            similarity: Math.round(sim * 100) / 100,
          });
        }
      }
    }

    const conceptsWithFew = drill.concepts
      .filter((c) => (conceptCounts[c.slug] || 0) < 3)
      .map((c) => c.slug);

    results.push({
      drillSlug,
      totalQuestions: allQuestions.length,
      draftCount,
      approvedCount,
      invalidCount,
      conceptsWithFewQuestions: conceptsWithFew,
      duplicatePairs,
    });
  }

  return results;
}

if (process.argv[1]?.includes("audit-content.ts")) {
  console.log("=== PrepAI Content Bank Audit ===");
  const auditResults = runContentAudit();

  console.log("\n--------------------------------------------------------------------------------------------------");
  console.log(
    `| ${"Drill Slug".padEnd(22)} | ${"Total".padEnd(6)} | ${"Draft".padEnd(6)} | ${"Approved".padEnd(8)} | ${"Invalid".padEnd(8)} | ${"Duplicate Pairs".padEnd(16)} |`
  );
  console.log("--------------------------------------------------------------------------------------------------");

  let grandTotal = 0;
  let grandDraft = 0;
  let grandApproved = 0;

  for (const r of auditResults) {
    grandTotal += r.totalQuestions;
    grandDraft += r.draftCount;
    grandApproved += r.approvedCount;

    console.log(
      `| ${r.drillSlug.padEnd(22)} | ${String(r.totalQuestions).padEnd(6)} | ${String(r.draftCount).padEnd(6)} | ${String(r.approvedCount).padEnd(8)} | ${String(r.invalidCount).padEnd(8)} | ${String(r.duplicatePairs.length).padEnd(16)} |`
    );
  }

  console.log("--------------------------------------------------------------------------------------------------");
  console.log(
    `| ${"TOTAL".padEnd(22)} | ${String(grandTotal).padEnd(6)} | ${String(grandDraft).padEnd(6)} | ${String(grandApproved).padEnd(8)} |`
  );
  console.log("--------------------------------------------------------------------------------------------------\n");

  for (const r of auditResults) {
    if (r.duplicatePairs.length > 0) {
      console.log(`[DUPLICATES] in ${r.drillSlug}:`);
      for (const d of r.duplicatePairs) {
        console.log(`  - ${d.q1} <-> ${d.q2} (Jaccard: ${d.similarity})`);
      }
    }
    if (r.conceptsWithFewQuestions.length > 0) {
      console.log(`[SPARSE CONCEPTS (<3 Qs)] in ${r.drillSlug}: ${r.conceptsWithFewQuestions.join(", ")}`);
    }
  }
}
