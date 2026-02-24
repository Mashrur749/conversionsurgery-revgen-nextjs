import { describe, expect, it } from 'vitest';
import { buildCsv, buildCsvBundle } from '@/lib/services/data-export-bundle';

describe('data-export-bundle', () => {
  it('escapes csv rows consistently', () => {
    const csv = buildCsv(
      ['Name', 'Notes'],
      [["ACME, Inc.", 'Quoted "kitchen" project\nFollow-up needed']]
    );

    expect(csv).toContain('"ACME, Inc."');
    expect(csv).toContain('"Quoted ""kitchen"" project\nFollow-up needed"');
  });

  it('builds a multi-file csv bundle payload', () => {
    const bundle = buildCsvBundle('2026-02-24T00:00:00.000Z', [
      { name: 'leads.csv', csv: 'id,name\n1,Lead A' },
      { name: 'conversations.csv', csv: 'id,content\n1,Hello' },
    ]);

    expect(bundle).toContain('===== leads.csv =====');
    expect(bundle).toContain('===== conversations.csv =====');
    expect(bundle).toContain('# ConversionSurgery Data Export Bundle');
  });
});
