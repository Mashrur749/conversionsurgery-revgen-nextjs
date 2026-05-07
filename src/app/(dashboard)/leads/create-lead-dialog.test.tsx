/**
 * Component tests for CreateLeadDialog.
 *
 * Focus: happy paths + key validation gates per consent mode. Skips network
 * concerns (the form POSTs to /api/leads, which is covered separately by the
 * route handler test).
 *
 * Notes:
 *   - The Dialog implementation is the custom one in `src/components/ui/dialog.tsx`
 *     (not Radix). It renders portal content inline once `open=true`, so we just
 *     click the trigger to open.
 *   - The radio group IS Radix; user-event handles the pointer-event protocol.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateLeadDialog } from './create-lead-dialog';

beforeEach(() => {
  // Stub fetch — the dialog's submit handler hits /api/leads; we don't need it
  // for these tests, but a no-op default keeps any accidental submit safe.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    )
  );
});

async function openDialog() {
  const user = userEvent.setup();
  render(<CreateLeadDialog onCreated={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: /Add Lead/i }));
  return user;
}

describe('<CreateLeadDialog />', () => {
  it('opens with consent mode defaulting to "inquiry"', async () => {
    await openDialog();

    // The "inquiry" radio is checked by default.
    const inquiryRadio = screen.getByRole('radio', {
      name: /New inquiry \(last 6 months\)/i,
    });
    expect(inquiryRadio).toHaveAttribute('aria-checked', 'true');

    // Inquiry-date field is visible.
    expect(screen.getByLabelText(/Inquiry date/i)).toBeInTheDocument();
    // Express-consent + transaction-date fields are NOT visible.
    expect(
      screen.queryByLabelText(/How was express consent obtained\?/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Transaction date/i)
    ).not.toBeInTheDocument();
  });

  it('reveals expressConsentEvidence textarea when switching to "express_consent" mode', async () => {
    const user = await openDialog();

    const expressRadio = screen.getByRole('radio', {
      name: /Older inquiry \(express consent on file\)/i,
    });
    await user.click(expressRadio);

    // Textarea now visible.
    const evidenceField = screen.getByLabelText(
      /How was express consent obtained\?/i
    );
    expect(evidenceField).toBeInTheDocument();
    expect(evidenceField.tagName).toBe('TEXTAREA');
    // Inquiry-date field stays visible (still required for express_consent).
    expect(screen.getByLabelText(/Inquiry date/i)).toBeInTheDocument();
  });

  it('reveals transactionDate + customerNotes when switching to "existing_customer" mode', async () => {
    const user = await openDialog();

    const customerRadio = screen.getByRole('radio', {
      name: /Past paid customer \(within 24 months\)/i,
    });
    await user.click(customerRadio);

    expect(screen.getByLabelText(/Transaction date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes \(optional\)/i)).toBeInTheDocument();
    // Inquiry-date field hidden in this mode.
    expect(screen.queryByLabelText(/Inquiry date/i)).not.toBeInTheDocument();
    // Express-consent textarea still hidden.
    expect(
      screen.queryByLabelText(/How was express consent obtained\?/i)
    ).not.toBeInTheDocument();
  });

  it('disables submit in express_consent mode until evidence meets minimum length', async () => {
    const user = await openDialog();

    await user.click(
      screen.getByRole('radio', {
        name: /Older inquiry \(express consent on file\)/i,
      })
    );

    const submit = screen.getByRole('button', { name: /Create Lead/i });
    // Disabled with empty evidence.
    expect(submit).toBeDisabled();

    const evidence = screen.getByLabelText(
      /How was express consent obtained\?/i
    );
    // Less than 10 chars — still disabled.
    await user.type(evidence, 'short');
    expect(submit).toBeDisabled();

    // 10+ chars — submit becomes enabled.
    await user.type(evidence, ' enough now');
    expect(submit).not.toBeDisabled();
  });

  it('disables submit in inquiry mode when inquiry date is older than 6 months', async () => {
    const user = await openDialog();

    const submit = screen.getByRole('button', { name: /Create Lead/i });
    // Default state (today) — submit enabled.
    expect(submit).not.toBeDisabled();

    // Set inquiry-date to 200 days ago — past the CASL §10(1) implied window.
    const oldDate = new Date(Date.now() - 200 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const inquiryDateInput = screen.getByLabelText(/Inquiry date/i);
    await user.clear(inquiryDateInput);
    await user.type(inquiryDateInput, oldDate);

    // Warning copy appears + submit disabled.
    expect(submit).toBeDisabled();
    // The warning panel renders inside a sibling div — find by text fragment.
    const warning = screen.getByText(/over 6 months old/i);
    expect(warning).toBeInTheDocument();
    // Brand sienna palette in the warning panel — not raw red.
    const warningPanel = warning.closest('div');
    expect(warningPanel?.className).toMatch(/border-sienna/);
    expect(warningPanel?.className).toMatch(/bg-\[#FFF3E0\]/);
  });

  it('verifies the inquiry mode shows the inquiry-date field by default', async () => {
    await openDialog();

    // Sanity assertion separate from default-mode test — focuses on the
    // contract that "inquiry" is the entry point and the date field is the
    // primary input for that mode.
    const dateField = screen.getByLabelText(/Inquiry date/i) as HTMLInputElement;
    expect(dateField.type).toBe('date');
    expect(dateField).toBeRequired();

    // Within the form, name + phone are also required.
    const form = screen.getByRole('button', { name: /Create Lead/i }).closest('form');
    expect(form).not.toBeNull();
    const within_ = within(form as HTMLElement);
    expect(within_.getByLabelText(/^Name/i)).toBeRequired();
    expect(within_.getByLabelText(/^Phone/i)).toBeRequired();
  });
});
