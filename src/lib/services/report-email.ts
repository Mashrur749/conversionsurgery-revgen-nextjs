import { sendEmail } from '@/lib/services/resend';
import { type WithoutUsModelResult } from '@/lib/services/without-us-model';

const CAD_FORMATTER = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

function buildLeadsAtRiskEmailSummary(withoutUsModel: WithoutUsModelResult | null): string {
  if (!withoutUsModel) return '';

  if (withoutUsModel.status === 'insufficient_data') {
    return `
      <p><strong>Leads at Risk:</strong> not enough data this period to estimate.</p>
      <p style="color: #6b7280; font-size: 12px;">${withoutUsModel.message}</p>
    `;
  }

  const low = CAD_FORMATTER.format(withoutUsModel.ranges.low.estimatedRevenueRisk);
  const base = CAD_FORMATTER.format(withoutUsModel.ranges.base.estimatedRevenueRisk);
  const high = CAD_FORMATTER.format(withoutUsModel.ranges.high.estimatedRevenueRisk);

  return `
    <p><strong>Leads at Risk:</strong> Based on your response times and lead volume this period, estimated pipeline at stake ranges from ${low} to ${high} (likely: ${base}).</p>
    <p style="color: #6b7280; font-size: 12px;">${withoutUsModel.assumptions.disclaimer}</p>
  `;
}

interface SendBiWeeklyReportEmailInput {
  to: string;
  businessName: string;
  periodStart: string;
  periodEnd: string;
  reportId: string;
  withoutUsModel?: WithoutUsModelResult | null;
}

export async function sendBiWeeklyReportEmail(input: SendBiWeeklyReportEmailInput) {
  const withoutUsSummary = buildLeadsAtRiskEmailSummary(input.withoutUsModel ?? null);

  return sendEmail({
    to: input.to,
    subject: `${input.businessName} — Bi-weekly Performance Report`,
    html: `
      <div style="font-family: Arial, sans-serif;">
        <p>Your bi-weekly report is ready for ${input.periodStart} to ${input.periodEnd}.</p>
        <p>Report ID: <strong>${input.reportId}</strong></p>
        ${withoutUsSummary}
        <p>Your account manager can walk through details and optimization actions.</p>
      </div>
    `,
  });
}

