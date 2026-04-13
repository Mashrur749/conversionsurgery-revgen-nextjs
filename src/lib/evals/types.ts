export type AssertFn = (response: string, context?: Record<string, unknown>) => void;
export type AsyncAssertFn = (response: string, context?: Record<string, unknown>) => Promise<void>;

export interface EvalResult {
  category: string;
  testId: string;
  description: string;
  passed: boolean;
  score?: number;
  error?: string;
  response?: string;
  durationMs: number;
}

export interface CategoryResult {
  name: string;
  passed: number;
  total: number;
  rate: number;
  results: EvalResult[];
}

export interface EvalRunResult {
  timestamp: string;
  commit: string;
  categories: Record<string, { passed: number; total: number; rate: number }>;
  totalCost: number;
  durationMs: number;
}
