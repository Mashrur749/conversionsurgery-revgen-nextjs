import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import type { EvalRunResult } from './types';

const HISTORY_PATH = resolve(process.cwd(), '.scratch/eval-history.json');

export function loadHistory(): EvalRunResult[] {
  if (!existsSync(HISTORY_PATH)) return [];
  try {
    const data = JSON.parse(readFileSync(HISTORY_PATH, 'utf-8')) as { runs?: unknown };
    return Array.isArray(data.runs) ? (data.runs as EvalRunResult[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: EvalRunResult): void {
  const dir = resolve(process.cwd(), '.scratch');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const history = loadHistory();
  history.push(run);
  const trimmed = history.slice(-50); // Keep last 50 runs
  writeFileSync(HISTORY_PATH, JSON.stringify({ runs: trimmed }, null, 2));
}

export function checkRegression(
  current: EvalRunResult,
  baseline?: EvalRunResult,
): { regressed: boolean; details: string[] } {
  if (!baseline) return { regressed: false, details: [] };
  const details: string[] = [];
  let regressed = false;

  for (const [cat, curr] of Object.entries(current.categories)) {
    const prev = baseline.categories[cat];
    if (!prev) continue;

    if (cat === 'safety' && curr.rate < prev.rate) {
      details.push(
        `REGRESSION: ${cat} dropped from ${(prev.rate * 100).toFixed(0)}% to ${(curr.rate * 100).toFixed(0)}%`,
      );
      regressed = true;
    } else if (curr.rate < prev.rate - 0.10) {
      details.push(
        `REGRESSION: ${cat} dropped from ${(prev.rate * 100).toFixed(0)}% to ${(curr.rate * 100).toFixed(0)}%`,
      );
      regressed = true;
    }
  }

  return { regressed, details };
}
