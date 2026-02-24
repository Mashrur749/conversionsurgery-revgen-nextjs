import { getDb } from '@/db';
import { conversations, jobs, leads } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export interface DataExportDatasetSummary {
  name: string;
  rowCount: number;
}

export interface DataExportBundleSummary {
  format: 'csv_bundle';
  generatedAt: string;
  datasets: DataExportDatasetSummary[];
}

export interface DataExportBundle {
  filename: string;
  content: string;
  summary: DataExportBundleSummary;
}

function toIso(value: Date | null | undefined): string {
  if (!value) return '';
  return value.toISOString();
}

export function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

export function buildCsvBundle(
  generatedAtIso: string,
  parts: Array<{ name: string; csv: string }>
): string {
  const lines: string[] = [
    '# ConversionSurgery Data Export Bundle',
    `# Generated At (UTC): ${generatedAtIso}`,
    '# Format: Each section is a full CSV file with its own header row.',
    '',
  ];

  for (const part of parts) {
    lines.push(`===== ${part.name} =====`);
    lines.push(part.csv);
    lines.push('');
  }

  return lines.join('\n');
}

export async function buildClientDataExportBundle(clientId: string): Promise<DataExportBundle> {
  const db = getDb();

  const [leadRows, conversationRows, pipelineRows] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        status: leads.status,
        temperature: leads.temperature,
        source: leads.source,
        projectType: leads.projectType,
        notes: leads.notes,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(eq(leads.clientId, clientId))
      .orderBy(asc(leads.createdAt)),

    db
      .select({
        id: conversations.id,
        leadId: conversations.leadId,
        leadName: leads.name,
        leadPhone: leads.phone,
        direction: conversations.direction,
        messageType: conversations.messageType,
        content: conversations.content,
        deliveryStatus: conversations.deliveryStatus,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .leftJoin(leads, eq(conversations.leadId, leads.id))
      .where(eq(conversations.clientId, clientId))
      .orderBy(asc(conversations.createdAt)),

    db
      .select({
        jobId: jobs.id,
        leadId: jobs.leadId,
        leadName: leads.name,
        leadStatus: leads.status,
        jobStatus: jobs.status,
        quoteAmount: jobs.quoteAmount,
        finalAmount: jobs.finalAmount,
        paidAmount: jobs.paidAmount,
        scheduledDate: jobs.scheduledDate,
        completedDate: jobs.completedDate,
        wonAt: jobs.wonAt,
        lostAt: jobs.lostAt,
        lostReason: jobs.lostReason,
        createdAt: jobs.createdAt,
        updatedAt: jobs.updatedAt,
      })
      .from(jobs)
      .leftJoin(leads, eq(jobs.leadId, leads.id))
      .where(eq(jobs.clientId, clientId))
      .orderBy(asc(jobs.createdAt)),
  ]);

  const leadsCsv = buildCsv(
    [
      'Lead ID',
      'Name',
      'Phone',
      'Email',
      'Status',
      'Temperature',
      'Source',
      'Project Type',
      'Notes',
      'Created At',
      'Updated At',
    ],
    leadRows.map((row) => [
      row.id,
      row.name,
      row.phone,
      row.email,
      row.status,
      row.temperature,
      row.source,
      row.projectType,
      row.notes,
      toIso(row.createdAt),
      toIso(row.updatedAt),
    ])
  );

  const conversationsCsv = buildCsv(
    [
      'Conversation ID',
      'Lead ID',
      'Lead Name',
      'Lead Phone',
      'Direction',
      'Message Type',
      'Content',
      'Delivery Status',
      'Created At',
    ],
    conversationRows.map((row) => [
      row.id,
      row.leadId,
      row.leadName,
      row.leadPhone,
      row.direction,
      row.messageType,
      row.content,
      row.deliveryStatus,
      toIso(row.createdAt),
    ])
  );

  const pipelineCsv = buildCsv(
    [
      'Job ID',
      'Lead ID',
      'Lead Name',
      'Lead Status',
      'Job Status',
      'Quote Amount (Cents)',
      'Final Amount (Cents)',
      'Paid Amount (Cents)',
      'Scheduled Date',
      'Completed Date',
      'Won At',
      'Lost At',
      'Lost Reason',
      'Created At',
      'Updated At',
    ],
    pipelineRows.map((row) => [
      row.jobId,
      row.leadId,
      row.leadName,
      row.leadStatus,
      row.jobStatus,
      row.quoteAmount,
      row.finalAmount,
      row.paidAmount,
      row.scheduledDate,
      row.completedDate,
      toIso(row.wonAt),
      toIso(row.lostAt),
      row.lostReason,
      toIso(row.createdAt),
      toIso(row.updatedAt),
    ])
  );

  const generatedAt = new Date();
  const generatedAtIso = generatedAt.toISOString();

  const summary: DataExportBundleSummary = {
    format: 'csv_bundle',
    generatedAt: generatedAtIso,
    datasets: [
      { name: 'leads.csv', rowCount: leadRows.length },
      { name: 'conversations.csv', rowCount: conversationRows.length },
      { name: 'pipeline_jobs.csv', rowCount: pipelineRows.length },
    ],
  };

  const content = buildCsvBundle(generatedAtIso, [
    { name: 'leads.csv', csv: leadsCsv },
    { name: 'conversations.csv', csv: conversationsCsv },
    { name: 'pipeline_jobs.csv', csv: pipelineCsv },
  ]);

  return {
    filename: `conversionsurgery-export-${generatedAtIso.slice(0, 10)}.txt`,
    content,
    summary,
  };
}
