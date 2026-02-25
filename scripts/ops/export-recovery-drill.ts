import { buildClientDataExportBundle } from '@/lib/services/data-export-bundle';

function parseArgs(): { clientId: string } {
  const args = process.argv.slice(2);
  const clientIdIndex = args.findIndex((arg) => arg === '--client-id' || arg === '--client');
  const clientId = clientIdIndex >= 0 ? args[clientIdIndex + 1] : '';

  if (!clientId) {
    throw new Error('Usage: npx tsx scripts/ops/export-recovery-drill.ts --client-id <client-id>');
  }

  return { clientId };
}

function assertBundleShape(content: string): void {
  const requiredSections = [
    '===== leads.csv =====',
    '===== conversations.csv =====',
    '===== pipeline_jobs.csv =====',
  ];

  for (const section of requiredSections) {
    if (!content.includes(section)) {
      throw new Error(`Missing required section in export bundle: ${section}`);
    }
  }
}

async function main() {
  const { clientId } = parseArgs();

  console.log(`[RecoveryDrill] Building export bundle for client: ${clientId}`);
  const bundle = await buildClientDataExportBundle(clientId);

  assertBundleShape(bundle.content);

  const datasetSummary = bundle.summary.datasets
    .map((dataset) => `${dataset.name}:${dataset.rowCount}`)
    .join(', ');

  console.log('[RecoveryDrill] Export bundle generated successfully');
  console.log(`[RecoveryDrill] File: ${bundle.filename}`);
  console.log(`[RecoveryDrill] Generated At: ${bundle.summary.generatedAt}`);
  console.log(`[RecoveryDrill] Datasets: ${datasetSummary}`);
  console.log('[RecoveryDrill] Validation: PASS');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[RecoveryDrill] Validation: FAIL');
  console.error(message);
  process.exit(1);
});
