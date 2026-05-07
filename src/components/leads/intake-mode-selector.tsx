'use client';

import { Download, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type IntakeMode = 'standard' | 'express_consent' | 'existing_customer';

export interface IntakeModeOption {
  value: IntakeMode;
  label: string;
  description: string;
  whenToUse: string;
  sampleCsv: string;
  requiredColumns: string[];
}

export const INTAKE_MODES: IntakeModeOption[] = [
  {
    value: 'standard',
    label: 'New inquiries (last 6 months)',
    description:
      'Default mode. Each row needs an inquiry_date column dated within the last 180 days. CASL-compliant via implied consent from the inquiry itself.',
    whenToUse:
      'Use when every contact has reached out (form, call, text, in-person) within the last 6 months.',
    sampleCsv: '/samples/leads-standard.csv',
    requiredColumns: ['phone', 'inquiry_date', 'name', 'email', 'project_type'],
  },
  {
    value: 'express_consent',
    label: 'Older inquiries (with express consent on file)',
    description:
      'For inquiries older than 6 months where you have documented express consent. Each row needs an express_consent_evidence column describing how consent was obtained.',
    whenToUse:
      'Use when contacts inquired more than 6 months ago AND you have written marketing-consent evidence (signed form, opt-in checkbox, recorded call).',
    sampleCsv: '/samples/leads-express-consent.csv',
    requiredColumns: [
      'phone',
      'inquiry_date',
      'express_consent_evidence',
      'name',
      'email',
      'project_type',
    ],
  },
  {
    value: 'existing_customer',
    label: 'Past paid customers (within 24 months)',
    description:
      'For homeowners who paid for completed work within the last 24 months. CASL §10(2) grants 24-month implied consent from prior paid relationship. Each row needs a transaction_date column.',
    whenToUse:
      'Use for past paid customers whose project closed within the last 24 months. Notes column is optional but recommended (e.g., "Kitchen reno Jul 2024, $52K").',
    sampleCsv: '/samples/leads-existing-customer.csv',
    requiredColumns: ['phone', 'transaction_date', 'name', 'email', 'notes (optional)'],
  },
];

interface IntakeModeSelectorProps {
  value: IntakeMode;
  onChange: (mode: IntakeMode) => void;
  className?: string;
}

export function IntakeModeSelector({
  value,
  onChange,
  className,
}: IntakeModeSelectorProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <fieldset className={cn('space-y-3', className)}>
        <legend className="text-sm font-medium mb-2">
          Consent basis (required)
        </legend>
        <div className="space-y-2" role="radiogroup" aria-label="CSV intake mode">
          {INTAKE_MODES.map((mode) => {
            const selected = value === mode.value;
            return (
              <label
                key={mode.value}
                className={cn(
                  'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                  selected
                    ? 'border-olive bg-[#F4F6EE]'
                    : 'border-border hover:border-olive/40 hover:bg-muted/40'
                )}
              >
                <input
                  type="radio"
                  name="intake-mode"
                  value={mode.value}
                  checked={selected}
                  onChange={() => onChange(mode.value)}
                  className="mt-1 h-4 w-4 shrink-0 accent-olive cursor-pointer"
                  aria-describedby={`intake-mode-${mode.value}-desc`}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium leading-snug">
                      {mode.label}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`When to use ${mode.label}`}
                          className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                          onClick={(e) => e.preventDefault()}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-xs text-xs leading-snug"
                      >
                        {mode.whenToUse}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p
                    id={`intake-mode-${mode.value}-desc`}
                    className="text-xs text-muted-foreground leading-snug"
                  >
                    {mode.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
                    <span className="text-muted-foreground">
                      Required columns:{' '}
                      <span className="font-mono text-foreground">
                        {mode.requiredColumns.join(', ')}
                      </span>
                    </span>
                  </div>
                  <a
                    href={mode.sampleCsv}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-olive hover:text-olive/80 hover:underline mt-1"
                  >
                    <Download className="h-3 w-3" />
                    Download sample CSV
                  </a>
                </div>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Why these modes?{' '}
          <a
            href="/help/casl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-olive hover:underline"
          >
            CASL compliance overview
          </a>
        </p>
      </fieldset>
    </TooltipProvider>
  );
}
