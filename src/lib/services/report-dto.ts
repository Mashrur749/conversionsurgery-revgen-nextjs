import type { WithoutUsModelResult } from '@/lib/services/without-us-model';

export interface ReportMetrics {
  messagesSent?: number;
  conversationsStarted?: number;
  appointmentsReminded?: number;
  formsResponded?: number;
  estimatesFollowedUp?: number;
  missedCallsCaptured?: number;
  days?: number;
}

export interface ReportRoiSummary {
  messagesSent?: number;
  appointmentsReminded?: number;
  conversionRate?: number;
  engagementRate?: number;
  daysInPeriod?: number;
  averagePerDay?: string;
  quarterlyCampaign?: Record<string, unknown> | null;
  withoutUsModel?: WithoutUsModelResult | null;
}

export interface ReportTeamPerformance {
  totalMembers?: number;
  activeMembers?: number;
}

export interface ReportTestResult {
  name?: string;
  description?: string;
  testType?: string;
}

export interface ReportDailyStats {
  date: string;
  messagesSent?: number;
  conversationsStarted?: number;
  appointmentsReminded?: number;
  formsResponded?: number;
  estimatesFollowedUp?: number;
  missedCallsCaptured?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function parseReportMetrics(value: unknown): ReportMetrics {
  return asRecord(value) as ReportMetrics;
}

export function parseReportRoiSummary(value: unknown): ReportRoiSummary {
  return asRecord(value) as ReportRoiSummary;
}

export function parseReportTeamPerformance(value: unknown): ReportTeamPerformance {
  return asRecord(value) as ReportTeamPerformance;
}

export function parseReportPerformanceData(value: unknown): ReportDailyStats[] {
  return asArray<ReportDailyStats>(value);
}

export function parseReportTestResults(value: unknown): ReportTestResult[] {
  return asArray<ReportTestResult>(value);
}
