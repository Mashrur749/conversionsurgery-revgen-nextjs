'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QualityGate {
  name: string;
  passed: boolean;
  details?: string;
}

interface OnboardingProgressProps {
  clientId: string;
  aiAgentMode: string;
  createdAt: Date;
  qualityGates: QualityGate[];
}

const MODES = ['off', 'assist', 'autonomous'] as const;
type Mode = (typeof MODES)[number];

const MODE_LABELS: Record<Mode, string> = {
  off: 'Off',
  assist: 'Assist',
  autonomous: 'Autonomous',
};

const ASSIST_MIN_DAYS = 7;
const AUTONOMOUS_MIN_DAYS = 14;

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function isMode(value: string): value is Mode {
  return MODES.includes(value as Mode);
}

export function OnboardingProgress({
  aiAgentMode,
  createdAt,
  qualityGates,
}: OnboardingProgressProps) {
  const days = daysSince(createdAt);
  const currentMode: Mode = isMode(aiAgentMode) ? aiAgentMode : 'off';

  const anyFailing = qualityGates.some((g) => !g.passed);
  const blockedActivation = anyFailing && currentMode === 'off';

  return (
    <Card className="border-[#6B7E54]/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Onboarding Progress (Day {days})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Mode progression timeline */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            AI Mode
          </p>
          <div className="flex items-center gap-0">
            {MODES.map((mode, idx) => {
              const isCurrent = mode === currentMode;
              const isPast = MODES.indexOf(currentMode) > idx;
              const thresholdDays = mode === 'assist' ? ASSIST_MIN_DAYS : AUTONOMOUS_MIN_DAYS;
              const dayLabel =
                mode === 'off'
                  ? 'Day 0'
                  : mode === 'assist'
                  ? `Day ${ASSIST_MIN_DAYS}+`
                  : `Day ${AUTONOMOUS_MIN_DAYS}+`;
              const daysUntil = mode === 'off' ? 0 : Math.max(0, thresholdDays - days);

              return (
                <div key={mode} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={[
                        'rounded-full px-3 py-1 text-sm font-medium border',
                        isCurrent
                          ? 'bg-[#1B2F26] text-white border-[#1B2F26]'
                          : isPast
                          ? 'bg-[#E8F5E9] text-[#3D7A50] border-[#3D7A50]/30'
                          : 'bg-muted text-muted-foreground border-border',
                      ].join(' ')}
                    >
                      {MODE_LABELS[mode]}
                      {isCurrent && (
                        <span className="ml-1 text-xs opacity-75">
                          &#9650;
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-1">
                      {isCurrent && mode !== 'off' && daysUntil === 0
                        ? dayLabel
                        : !isCurrent && !isPast && daysUntil > 0
                        ? `${daysUntil}d to go`
                        : dayLabel}
                    </span>
                  </div>
                  {idx < MODES.length - 1 && (
                    <div
                      className={[
                        'h-px w-8 mx-1 mt-[-1rem]',
                        isPast || (isCurrent && idx < MODES.indexOf(currentMode))
                          ? 'bg-[#3D7A50]'
                          : 'bg-border',
                      ].join(' ')}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quality gates */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Quality Gates
          </p>
          <ul className="space-y-1.5">
            {qualityGates.map((gate, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span
                  className={
                    gate.passed ? 'text-[#3D7A50] mt-0.5' : 'text-[#C15B2E] mt-0.5'
                  }
                  aria-label={gate.passed ? 'Passed' : 'Failed'}
                >
                  {gate.passed ? '\u2713' : '\u2717'}
                </span>
                <span>
                  <span className={gate.passed ? '' : 'text-[#C15B2E]'}>
                    {gate.name}
                  </span>
                  {gate.details && (
                    <span className="text-muted-foreground ml-1">
                      &mdash; {gate.details}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Blocking banner */}
        {blockedActivation && (
          <div className="rounded-md border border-[#C15B2E]/30 bg-[#FDEAE4] px-3 py-2 text-sm text-[#C15B2E]">
            AI activation blocked &mdash; fix failing gates above
          </div>
        )}
      </CardContent>
    </Card>
  );
}
