'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id?: string;
  stepNumber: number;
  name: string;
  delayMinutes: number;
  messageTemplate?: string;
  customMessage?: string;
  useTemplateMessage?: boolean;
  useTemplateDelay?: boolean;
  customDelayMinutes?: number;
  skipConditions?: {
    ifReplied?: boolean;
    ifScheduled?: boolean;
    ifPaid?: boolean;
  };
  source?: 'template' | 'custom' | 'mixed';
}

interface SequenceViewProps {
  steps: Step[];
  onUpdateStep: (index: number, updates: Partial<Step>) => void;
  onDeleteStep: (index: number) => void;
  onMoveStep: (index: number, direction: 'up' | 'down') => void;
  isTemplate?: boolean;
  templateSteps?: Step[];
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immediately';
  if (minutes < 0) return `${Math.abs(minutes / 60)} hours before`;

  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return days === 1 ? '1 day' : `${days} days`;
  if (hours > 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${minutes} minutes`;
}

function delayToInput(minutes: number): { value: number; unit: string } {
  if (minutes === 0) return { value: 0, unit: 'minutes' };
  if (minutes % (24 * 60) === 0) return { value: minutes / (24 * 60), unit: 'days' };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' };
  return { value: minutes, unit: 'minutes' };
}

function inputToDelay(value: number, unit: string): number {
  switch (unit) {
    case 'days':
      return value * 24 * 60;
    case 'hours':
      return value * 60;
    default:
      return value;
  }
}

export function SequenceView({
  steps,
  onUpdateStep,
  onDeleteStep,
  onMoveStep,
  isTemplate = false,
  templateSteps,
}: SequenceViewProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isExpanded = expandedStep === index;
        const templateStep = templateSteps?.find(
          (t) => t.stepNumber === step.stepNumber
        );
        const delay = delayToInput(
          step.useTemplateDelay && templateStep
            ? templateStep.delayMinutes
            : (step.customDelayMinutes ?? step.delayMinutes)
        );

        return (
          <div key={step.id || index} className="relative">
            {/* Connection line */}
            {index > 0 && (
              <div className="absolute left-6 -top-2 w-0.5 h-4 bg-border" />
            )}

            <Collapsible
              open={isExpanded}
              onOpenChange={() => setExpandedStep(isExpanded ? null : index)}
            >
              <Card
                className={cn(
                  'transition-all',
                  isExpanded && 'ring-2 ring-primary',
                  step.source === 'template' && 'border-blue-200 bg-blue-50/50',
                  step.source === 'mixed' && 'border-yellow-200 bg-yellow-50/50'
                )}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50">
                    {/* Step number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      {step.stepNumber}
                    </div>

                    {/* Step info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {step.name || `Step ${step.stepNumber}`}
                        </span>
                        {step.source === 'template' && (
                          <LinkIcon
                            className="h-3 w-3 text-blue-500"
                            title="From template"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDelay(
                            delay.value *
                              (delay.unit === 'days'
                                ? 24 * 60
                                : delay.unit === 'hours'
                                  ? 60
                                  : 1)
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Expand indicator */}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Step name */}
                    <div className="space-y-2">
                      <Label>Step Name</Label>
                      <Input
                        value={step.name}
                        onChange={(e) =>
                          onUpdateStep(index, { name: e.target.value })
                        }
                        placeholder="e.g., Initial follow-up"
                      />
                    </div>

                    {/* Delay */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Delay</Label>
                        {!isTemplate && templateStep && (
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`template-delay-${index}`}
                              className="text-xs text-muted-foreground"
                            >
                              Use template
                            </Label>
                            <Switch
                              id={`template-delay-${index}`}
                              checked={step.useTemplateDelay}
                              onCheckedChange={(checked) =>
                                onUpdateStep(index, { useTemplateDelay: checked })
                              }
                            />
                          </div>
                        )}
                      </div>

                      {!step.useTemplateDelay || isTemplate ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={delay.value}
                            onChange={(e) => {
                              const newDelay = inputToDelay(
                                parseInt(e.target.value) || 0,
                                delay.unit
                              );
                              if (isTemplate) {
                                onUpdateStep(index, { delayMinutes: newDelay });
                              } else {
                                onUpdateStep(index, { customDelayMinutes: newDelay });
                              }
                            }}
                            className="w-24"
                          />
                          <select
                            value={delay.unit}
                            onChange={(e) => {
                              const newDelay = inputToDelay(delay.value, e.target.value);
                              if (isTemplate) {
                                onUpdateStep(index, { delayMinutes: newDelay });
                              } else {
                                onUpdateStep(index, { customDelayMinutes: newDelay });
                              }
                            }}
                            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="minutes">minutes</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                          </select>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Using template: {formatDelay(templateStep.delayMinutes)}
                        </p>
                      )}
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Message</Label>
                        {!isTemplate && templateStep && (
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`template-msg-${index}`}
                              className="text-xs text-muted-foreground"
                            >
                              Use template
                            </Label>
                            <Switch
                              id={`template-msg-${index}`}
                              checked={step.useTemplateMessage}
                              onCheckedChange={(checked) =>
                                onUpdateStep(index, { useTemplateMessage: checked })
                              }
                            />
                          </div>
                        )}
                      </div>

                      {!step.useTemplateMessage || isTemplate ? (
                        <Textarea
                          value={
                            isTemplate ? step.messageTemplate : step.customMessage
                          }
                          onChange={(e) => {
                            if (isTemplate) {
                              onUpdateStep(index, {
                                messageTemplate: e.target.value,
                              });
                            } else {
                              onUpdateStep(index, { customMessage: e.target.value });
                            }
                          }}
                          placeholder="Hi {name}, ..."
                          rows={3}
                        />
                      ) : (
                        <div className="p-3 bg-muted rounded-md text-sm italic">
                          Using template: &quot;
                          {templateStep.messageTemplate?.substring(0, 100)}...&quot;
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Variables: {'{name}'}, {'{business_name}'}, {'{amount}'},{' '}
                        {'{payment_link}'}, {'{review_link}'}
                      </p>
                    </div>

                    {/* Skip conditions */}
                    <div className="space-y-2">
                      <Label>Skip this step if:</Label>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={step.skipConditions?.ifReplied || false}
                            onChange={(e) =>
                              onUpdateStep(index, {
                                skipConditions: {
                                  ...step.skipConditions,
                                  ifReplied: e.target.checked,
                                },
                              })
                            }
                            className="rounded"
                          />
                          Lead replied
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={step.skipConditions?.ifScheduled || false}
                            onChange={(e) =>
                              onUpdateStep(index, {
                                skipConditions: {
                                  ...step.skipConditions,
                                  ifScheduled: e.target.checked,
                                },
                              })
                            }
                            className="rounded"
                          />
                          Appointment scheduled
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={step.skipConditions?.ifPaid || false}
                            onChange={(e) =>
                              onUpdateStep(index, {
                                skipConditions: {
                                  ...step.skipConditions,
                                  ifPaid: e.target.checked,
                                },
                              })
                            }
                            className="rounded"
                          />
                          Payment received
                        </label>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onMoveStep(index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onMoveStep(index, 'down')}
                          disabled={index === steps.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>

                      {steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDeleteStep(index)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
