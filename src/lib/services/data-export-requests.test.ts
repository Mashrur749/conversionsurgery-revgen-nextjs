import { describe, expect, it } from 'vitest';
import {
  DATA_EXPORT_REQUEST_STATUSES,
  resolveDataExportSlaState,
} from '@/lib/services/data-export-requests';

describe('data-export-requests', () => {
  it('marks overdue open requests as breached', () => {
    const now = new Date('2026-02-24T12:00:00.000Z');
    const dueAt = new Date('2026-02-23T12:00:00.000Z');

    const state = resolveDataExportSlaState(
      { status: DATA_EXPORT_REQUEST_STATUSES.PROCESSING, dueAt },
      now
    );

    expect(state).toBe('breached');
  });

  it('marks near-due requests as at risk', () => {
    const now = new Date('2026-02-24T12:00:00.000Z');
    const dueAt = new Date('2026-02-25T08:00:00.000Z');

    const state = resolveDataExportSlaState(
      { status: DATA_EXPORT_REQUEST_STATUSES.READY, dueAt },
      now
    );

    expect(state).toBe('at_risk');
  });

  it('marks delivered requests as closed', () => {
    const state = resolveDataExportSlaState({
      status: DATA_EXPORT_REQUEST_STATUSES.DELIVERED,
      dueAt: new Date('2026-02-24T12:00:00.000Z'),
    });

    expect(state).toBe('closed');
  });

  it('marks failed requests as breached', () => {
    const state = resolveDataExportSlaState({
      status: DATA_EXPORT_REQUEST_STATUSES.FAILED,
      dueAt: new Date('2026-02-24T12:00:00.000Z'),
    });

    expect(state).toBe('breached');
  });
});
