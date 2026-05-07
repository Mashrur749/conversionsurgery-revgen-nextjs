/**
 * Component-level tests for ConsentStatusBadge.
 *
 * Complements `consent-status-badge.dates.test.ts` (which covers the pure
 * derivation function). These tests verify the JSX renderer:
 *   - correct text/labels for each kind
 *   - brand-palette classes applied (sienna for warnings, sage/forest for
 *     success, etc.) — this is what catches regressions to raw Tailwind colors
 *   - the data-kind attribute matches the derived state
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsentStatusBadge } from './consent-status-badge';

const NOW = new Date('2026-05-07T12:00:00Z');
const DAY_MS = 86_400_000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

describe('<ConsentStatusBadge />', () => {
  it('renders implied_valid state with default tone classes', () => {
    render(
      <ConsentStatusBadge
        inquiryDate={daysAgo(50)}
        consentSource="inquiry"
        consentType="implied"
        now={NOW}
      />
    );

    const badge = screen.getByTestId('consent-status-badge');
    expect(badge).toHaveAttribute('data-kind', 'implied_valid');
    expect(badge.textContent).toMatch(/Inquiry received/);
    expect(badge.textContent).toMatch(/Implied consent valid until/);
    // Default (sage/forest) tone — uses border-forest-light + bg-sage-light brand tokens.
    expect(badge.className).toMatch(/border-forest-light/);
    expect(badge.className).toMatch(/bg-sage-light/);
  });

  it('renders implied_approaching state with sienna brand classes', () => {
    render(
      <ConsentStatusBadge
        inquiryDate={daysAgo(165)}
        consentSource="inquiry"
        consentType="implied"
        now={NOW}
      />
    );

    const badge = screen.getByTestId('consent-status-badge');
    expect(badge).toHaveAttribute('data-kind', 'implied_approaching');
    expect(badge.textContent).toMatch(/Approaching CASL window/);
    // Sienna brand tokens (warning tone).
    expect(badge.className).toMatch(/border-sienna/);
    expect(badge.className).toMatch(/text-sienna/);
    // Brand sienna tint background, not raw Tailwind.
    expect(badge.className).toMatch(/bg-\[#FFF3E0\]/);
  });

  it('renders implied_expired state with error tone classes', () => {
    render(
      <ConsentStatusBadge
        inquiryDate={daysAgo(200)}
        consentSource="inquiry"
        consentType="implied"
        now={NOW}
      />
    );

    const badge = screen.getByTestId('consent-status-badge');
    expect(badge).toHaveAttribute('data-kind', 'implied_expired');
    expect(badge.textContent).toMatch(/Implied consent expired/);
    // Error tone uses brand sienna-darker palette via hex tokens, not raw red-X.
    expect(badge.className).toMatch(/bg-\[#FDEAE4\]/);
    expect(badge.className).toMatch(/text-\[#C15B2E\]/);
    // Negative assertion: never use raw Tailwind red.
    expect(badge.className).not.toMatch(/bg-red-/);
    expect(badge.className).not.toMatch(/text-red-/);
  });

  it('renders express_on_file state with success tone and evidence detail', () => {
    const evidence = 'Signed estimate request 2024-08-15';
    render(
      <ConsentStatusBadge
        inquiryDate={daysAgo(300)}
        consentSource="web_form"
        consentType="express_written"
        consentTimestamp={daysAgo(40)}
        consentEvidence={evidence}
        now={NOW}
      />
    );

    const badge = screen.getByTestId('consent-status-badge');
    expect(badge).toHaveAttribute('data-kind', 'express_on_file');
    expect(badge.textContent).toMatch(/Express consent on file/);
    expect(badge.textContent).toContain(evidence);
    // Success tone uses brand forest hex tokens.
    expect(badge.className).toMatch(/bg-\[#E8F5E9\]/);
    expect(badge.className).toMatch(/text-\[#3D7A50\]/);
  });

  it('renders customer_valid state with months remaining', () => {
    render(
      <ConsentStatusBadge
        inquiryDate={daysAgo(600)}
        consentSource="existing_customer"
        consentType="implied"
        consentTimestamp={daysAgo(600)}
        now={NOW}
      />
    );

    const badge = screen.getByTestId('consent-status-badge');
    expect(badge).toHaveAttribute('data-kind', 'customer_valid');
    expect(badge.textContent).toMatch(/Customer consent/);
    // 730 - 600 = 130 days remaining ≈ 4 months.
    expect(badge.textContent).toMatch(/4 months remaining/);
    expect(badge.className).toMatch(/bg-\[#E8F5E9\]/);
  });

  it('renders not_recorded state with muted tone when inquiryDate is null', () => {
    render(<ConsentStatusBadge inquiryDate={null} now={NOW} />);

    const badge = screen.getByTestId('consent-status-badge');
    expect(badge).toHaveAttribute('data-kind', 'not_recorded');
    expect(badge.textContent).toMatch(/Inquiry date not recorded/);
    expect(badge.className).toMatch(/bg-muted/);
    expect(badge.className).toMatch(/text-muted-foreground/);
  });

  it('uses brand-palette classes only — no raw Tailwind colors across all states', () => {
    // Render every kind back-to-back in a single mount; collect classes.
    const { container } = render(
      <>
        <ConsentStatusBadge inquiryDate={null} now={NOW} />
        <ConsentStatusBadge
          inquiryDate={daysAgo(50)}
          consentType="implied"
          now={NOW}
        />
        <ConsentStatusBadge
          inquiryDate={daysAgo(165)}
          consentType="implied"
          now={NOW}
        />
        <ConsentStatusBadge
          inquiryDate={daysAgo(200)}
          consentType="implied"
          now={NOW}
        />
        <ConsentStatusBadge
          inquiryDate={null}
          consentType="express_written"
          consentTimestamp={daysAgo(10)}
          consentEvidence="evidence"
          now={NOW}
        />
        <ConsentStatusBadge
          inquiryDate={daysAgo(600)}
          consentSource="existing_customer"
          consentTimestamp={daysAgo(600)}
          now={NOW}
        />
      </>
    );

    const allClasses = Array.from(container.querySelectorAll('[data-testid="consent-status-badge"]'))
      .map((el) => el.className)
      .join(' ');

    // Negative assertions for raw Tailwind palette numerics on color utilities.
    expect(allClasses).not.toMatch(/\b(bg|text|border)-red-\d/);
    expect(allClasses).not.toMatch(/\b(bg|text|border)-green-\d/);
    expect(allClasses).not.toMatch(/\b(bg|text|border)-blue-\d/);
    expect(allClasses).not.toMatch(/\b(bg|text|border)-yellow-\d/);
    expect(allClasses).not.toMatch(/\b(bg|text|border)-orange-\d/);
  });
});
