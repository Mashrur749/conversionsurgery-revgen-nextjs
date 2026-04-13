#!/usr/bin/env npx tsx
/**
 * Unified Eval Runner
 *
 * Runs the full AI eval suite, generates an HTML report, saves a baseline
 * run, and checks for regressions against the previous baseline.
 *
 * Usage:
 *   npx tsx scripts/test/run-full-evals.ts
 *   npm run test:ai:full
 *
 * Output:
 *   .scratch/eval-report.html   — full HTML report (open in browser)
 *   .scratch/eval-history.json  — rolling 50-run history
 */

import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { generateEvalReport } from '../../src/lib/evals/reporter';
import { saveRun, loadHistory, checkRegression } from '../../src/lib/evals/baseline';
import type { CategoryResult, EvalRunResult } from '../../src/lib/evals/types';

// ---------------------------------------------------------------------------
// Types for vitest JSON reporter output
// ---------------------------------------------------------------------------

interface VitestAssertionResult {
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  title: string;
  fullName?: string;
  failureMessages: string[];
  duration?: number;
}

interface VitestTestResult {
  name: string;  // file path
  status: 'passed' | 'failed';
  assertionResults: VitestAssertionResult[];
  startTime?: number;
  endTime?: number;
  message?: string;
}

interface VitestJsonOutput {
  numPassedTests: number;
  numFailedTests: number;
  numTotalTests: number;
  testResults: VitestTestResult[];
  startTime?: number;
  endTime?: number;
}

// ---------------------------------------------------------------------------
// File path → eval category mapping
// ---------------------------------------------------------------------------

const FILE_TO_CATEGORY: Record<string, string> = {
  'coherence.ai-test.ts': 'coherence',
  'grounding.ai-test.ts': 'grounding',
  'retrieval.ai-test.ts': 'retrieval',
  'ai-criteria.ai-test.ts': 'safety',
  'ai-scenarios.ai-test.ts': 'scenarios',
  'win-back.ai-test.ts': 'quality',
  'no-show-recovery.ai-test.ts': 'quality',
  'review-response.ai-test.ts': 'quality',
  'signal-detection.ai-test.ts': 'accuracy',
  'voice-summary.ai-test.ts': 'accuracy',
  'booking-conversation.ai-test.ts': 'accuracy',
};

// Files that require API calls (used for cost estimate)
const API_REQUIRED_FILES = new Set([
  'coherence.ai-test.ts',
  'grounding.ai-test.ts',
  'retrieval.ai-test.ts',
  'ai-criteria.ai-test.ts',
  'ai-scenarios.ai-test.ts',
  'win-back.ai-test.ts',
  'no-show-recovery.ai-test.ts',
  'review-response.ai-test.ts',
  'signal-detection.ai-test.ts',
  'voice-summary.ai-test.ts',
  'booking-conversation.ai-test.ts',
]);

function getCategory(filePath: string): string {
  for (const [filename, category] of Object.entries(FILE_TO_CATEGORY)) {
    if (filePath.includes(filename)) return category;
  }
  // Fallback: derive from the file basename
  const basename = filePath.split('/').pop() ?? filePath;
  return basename.replace('.ai-test.ts', '').replace('.test.ts', '');
}

// ---------------------------------------------------------------------------
// Get current git commit hash
// ---------------------------------------------------------------------------

function getCommitHash(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Terminal colors (lightweight)
// ---------------------------------------------------------------------------

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const startMs = Date.now();
  const scratchDir = resolve(process.cwd(), '.scratch');
  const jsonOutputPath = resolve(scratchDir, 'eval-results.json');
  const reportOutputPath = resolve(scratchDir, 'eval-report.html');

  if (!existsSync(scratchDir)) mkdirSync(scratchDir, { recursive: true });

  console.log(`${c.bold}ConversionSurgery — Full Eval Suite${c.reset}`);
  console.log(`${c.dim}Running vitest with AI config...${c.reset}\n`);

  // -------------------------------------------------------------------------
  // Step 1: Run vitest with JSON reporter
  // -------------------------------------------------------------------------

  let vitestExitCode = 0;
  try {
    execFileSync(
      'npx',
      [
        'vitest',
        'run',
        '--config',
        'vitest.ai.config.ts',
        '--reporter=json',
        `--outputFile=${jsonOutputPath}`,
      ],
      { stdio: 'inherit' },
    );
  } catch (err: unknown) {
    // vitest exits non-zero when tests fail — that's OK; we still parse results
    vitestExitCode = (err as { status?: number }).status ?? 1;
    console.log(`\n${c.yellow}Note: vitest exited with code ${vitestExitCode} (some tests failed)${c.reset}`);
  }

  // -------------------------------------------------------------------------
  // Step 2: Parse vitest JSON output
  // -------------------------------------------------------------------------

  let vitestData: VitestJsonOutput = {
    numPassedTests: 0,
    numFailedTests: 0,
    numTotalTests: 0,
    testResults: [],
  };

  if (existsSync(jsonOutputPath)) {
    try {
      vitestData = JSON.parse(readFileSync(jsonOutputPath, 'utf-8')) as VitestJsonOutput;
    } catch (err) {
      console.error(`${c.red}Failed to parse vitest JSON output:${c.reset}`, err);
    }
  } else {
    console.warn(`${c.yellow}Vitest JSON output not found at ${jsonOutputPath}${c.reset}`);
  }

  // -------------------------------------------------------------------------
  // Step 3: Categorise results
  // -------------------------------------------------------------------------

  const categoryMap = new Map<string, CategoryResult>();

  for (const fileResult of vitestData.testResults) {
    const category = getCategory(fileResult.name);

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        name: category,
        passed: 0,
        total: 0,
        rate: 0,
        results: [],
      });
    }

    const catResult = categoryMap.get(category)!;

    for (const assertion of fileResult.assertionResults) {
      // Skipped / pending tests don't count toward pass or fail totals
      if (assertion.status === 'skipped' || assertion.status === 'pending') continue;

      const passed = assertion.status === 'passed';
      catResult.total++;
      if (passed) catResult.passed++;

      catResult.results.push({
        category,
        testId: fileResult.name.split('/').pop()?.replace('.ai-test.ts', '') ?? fileResult.name,
        description: assertion.title,
        passed,
        error: assertion.failureMessages.length > 0 ? assertion.failureMessages[0] : undefined,
        response: undefined,
        durationMs: assertion.duration ?? 0,
      });
    }
  }

  // Count skipped tests per category for reporting
  const skippedCountMap = new Map<string, number>();
  for (const fileResult of vitestData.testResults) {
    const category = getCategory(fileResult.name);
    const skippedCount = fileResult.assertionResults.filter(
      (a) => a.status === 'skipped' || a.status === 'pending',
    ).length;
    skippedCountMap.set(category, (skippedCountMap.get(category) ?? 0) + skippedCount);
  }

  // Recalculate rates
  for (const cat of categoryMap.values()) {
    cat.rate = cat.total > 0 ? cat.passed / cat.total : 0;
  }

  const categories = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // -------------------------------------------------------------------------
  // Step 4: Cost estimate
  // -------------------------------------------------------------------------

  const apiFilesRun = vitestData.testResults.filter((r) =>
    [...API_REQUIRED_FILES].some((f) => r.name.includes(f)),
  ).length;
  const costEstimate = apiFilesRun * 0.01;

  // -------------------------------------------------------------------------
  // Step 5: Generate HTML report
  // -------------------------------------------------------------------------

  const totalDurationMs = Date.now() - startMs;
  const html = generateEvalReport(categories, totalDurationMs, costEstimate);
  writeFileSync(reportOutputPath, html);
  console.log(`\n${c.cyan}HTML report: ${reportOutputPath}${c.reset}`);

  // -------------------------------------------------------------------------
  // Step 6: Save baseline run
  // -------------------------------------------------------------------------

  const commit = getCommitHash();
  const categorySnapshot: EvalRunResult['categories'] = {};
  for (const cat of categories) {
    categorySnapshot[cat.name] = { passed: cat.passed, total: cat.total, rate: cat.rate };
  }

  const runResult: EvalRunResult = {
    timestamp: new Date().toISOString(),
    commit,
    categories: categorySnapshot,
    totalCost: costEstimate,
    durationMs: totalDurationMs,
  };

  const history = loadHistory();
  const previousBaseline = history.length > 0 ? history[history.length - 1] : undefined;
  saveRun(runResult);

  // -------------------------------------------------------------------------
  // Step 7: Check regressions
  // -------------------------------------------------------------------------

  const { regressed, details } = checkRegression(runResult, previousBaseline);

  // -------------------------------------------------------------------------
  // Step 8: Print terminal summary
  // -------------------------------------------------------------------------

  const totalPassed = categories.reduce((s, c) => s + c.passed, 0);
  const totalAll = categories.reduce((s, c) => s + c.total, 0);
  const totalSkipped = Array.from(skippedCountMap.values()).reduce((s, v) => s + v, 0);
  const overallPct = totalAll > 0 ? ((totalPassed / totalAll) * 100).toFixed(1) : '0.0';
  const skippedLine = totalSkipped > 0 ? ` (${totalSkipped} skipped — no ANTHROPIC_API_KEY)` : '';

  console.log(`\n${c.bold}━━━ Eval Summary ━━━${c.reset}`);
  console.log(`  Commit:     ${commit}`);
  console.log(`  Duration:   ${(totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`  Cost est.:  ~$${costEstimate.toFixed(2)}`);
  console.log(`  Overall:    ${c.bold}${totalPassed}/${totalAll} (${overallPct}%)${c.reset}${skippedLine}\n`);

  for (const cat of categories) {
    const skipped = skippedCountMap.get(cat.name) ?? 0;
    if (cat.total === 0 && skipped > 0) {
      // All tests in this category were skipped (no API key)
      console.log(`  ${c.dim}-  ${cat.name.padEnd(14)} skipped (${skipped} tests, no API key)${c.reset}`);
      continue;
    }
    const pct = cat.total > 0 ? ((cat.rate) * 100).toFixed(1) : '0.0';
    const icon = cat.rate >= 0.85 ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    const skippedNote = skipped > 0 ? ` ${c.dim}+${skipped} skipped${c.reset}` : '';
    console.log(`  ${icon}  ${cat.name.padEnd(14)} ${cat.passed}/${cat.total} (${pct}%)${skippedNote}`);
  }

  if (regressed && details.length > 0) {
    console.log(`\n${c.red}${c.bold}REGRESSIONS DETECTED:${c.reset}`);
    for (const d of details) {
      console.log(`  ${c.red}${d}${c.reset}`);
    }
  } else if (previousBaseline) {
    console.log(`\n${c.green}No regressions vs previous baseline (${previousBaseline.commit}).${c.reset}`);
  }

  console.log(`\n  Open report: open ${reportOutputPath}\n`);

  // Exit 1 on safety regression
  const safetyCategory = categorySnapshot['safety'];
  const prevSafety = previousBaseline?.categories['safety'];
  const safetyRegressed = safetyCategory !== undefined &&
    prevSafety !== undefined &&
    safetyCategory.rate < prevSafety.rate;

  if (safetyRegressed) {
    console.error(`${c.red}${c.bold}Safety regression detected — exiting with code 1.${c.reset}`);
    process.exit(1);
  }
}

main();
