/**
 * Component tests for IntakeModeSelector — the radio-group used in CSV upload
 * dialogs (admin + portal) to pick the CASL consent basis.
 *
 * Verifies:
 *   - all 3 mode options render with descriptions + required-columns hint
 *   - selection updates via the onChange callback
 *   - sample CSV download links point to the correct asset paths
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  IntakeModeSelector,
  INTAKE_MODES,
  type IntakeMode,
} from './intake-mode-selector';

function renderWithDefaults(initial: IntakeMode = 'standard') {
  const onChange = vi.fn();
  const utils = render(
    <IntakeModeSelector value={initial} onChange={onChange} />
  );
  return { onChange, ...utils };
}

describe('<IntakeModeSelector />', () => {
  it('renders all three intake mode options with their labels', () => {
    renderWithDefaults();

    // Each mode label appears as visible text.
    for (const mode of INTAKE_MODES) {
      expect(screen.getByText(mode.label)).toBeInTheDocument();
    }
  });

  it('renders each mode description text', () => {
    renderWithDefaults();

    for (const mode of INTAKE_MODES) {
      // Descriptions are unique per mode, so direct text match is safe.
      expect(screen.getByText(mode.description)).toBeInTheDocument();
    }
  });

  it('renders required columns list per mode', () => {
    renderWithDefaults();

    for (const mode of INTAKE_MODES) {
      const expectedColumns = mode.requiredColumns.join(', ');
      // Use a function matcher because the columns string is split across nested spans.
      const found = screen.getByText((_content, node) => {
        if (!node) return false;
        return node.textContent === expectedColumns;
      });
      expect(found).toBeInTheDocument();
    }
  });

  it('shows the initial value as the checked radio', () => {
    renderWithDefaults('express_consent');

    const radios = screen.getAllByRole('radio');
    const checked = radios.find((r) => (r as HTMLInputElement).checked);
    expect(checked).toBeDefined();
    expect((checked as HTMLInputElement).value).toBe('express_consent');
  });

  it('calls onChange with the new mode when a different option is selected', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWithDefaults('standard');

    const customerRadio = screen
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).value === 'existing_customer');
    expect(customerRadio).toBeDefined();

    await user.click(customerRadio as HTMLElement);

    expect(onChange).toHaveBeenCalledWith('existing_customer');
  });

  it('renders sample CSV download links pointing to /samples/leads-* assets', () => {
    renderWithDefaults();

    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/samples/'));

    // One sample link per mode.
    expect(links.length).toBe(INTAKE_MODES.length);

    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/samples/leads-standard.csv');
    expect(hrefs).toContain('/samples/leads-express-consent.csv');
    expect(hrefs).toContain('/samples/leads-existing-customer.csv');

    // Each sample link is a download link.
    for (const link of links) {
      expect(link).toHaveAttribute('download');
    }
  });

  it('renders a CASL compliance overview link', () => {
    renderWithDefaults();

    const caslLink = screen.getByRole('link', { name: /CASL compliance overview/i });
    expect(caslLink).toHaveAttribute('href', '/help/casl');
    expect(caslLink).toHaveAttribute('target', '_blank');
  });
});
