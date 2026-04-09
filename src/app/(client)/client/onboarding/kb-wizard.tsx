'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface FormValues {
  mainServices: string;
  servicesNotOffered: string;
  priceRanges: string;
  serviceArea: string;
  projectTimeline: string;
  warranty: string;
  licensedAndInsured: string;
  yearsInBusiness: string;
  differentiators: string;
  businessHours: string;
  pricingHandling: 'never_give_prices' | 'give_general_ranges' | 'refer_to_website';
  bookingProcess: string;
}

const INITIAL_VALUES: FormValues = {
  mainServices: '',
  servicesNotOffered: '',
  priceRanges: '',
  serviceArea: '',
  projectTimeline: '',
  warranty: '',
  licensedAndInsured: '',
  yearsInBusiness: '',
  differentiators: '',
  businessHours: '',
  pricingHandling: 'never_give_prices',
  bookingProcess: '',
};

const INPUT_STYLE =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring';

const SELECT_STYLE =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring';

type StepId = 'services' | 'business' | 'availability' | 'process';

interface Step {
  id: StepId;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    id: 'services',
    title: 'Your Services',
    description: 'Tell us what you do so the AI can answer service questions accurately.',
  },
  {
    id: 'business',
    title: 'About Your Business',
    description: 'Help the AI build trust with homeowners by sharing your credentials.',
  },
  {
    id: 'availability',
    title: 'Hours &amp; Pricing',
    description: 'Set how the AI handles pricing questions and your availability.',
  },
  {
    id: 'process',
    title: 'Booking Process',
    description: 'Describe how homeowners should get started with you.',
  },
];

const TOTAL_STEPS = STEPS.length;

export function KbWizard() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStep1Errors, setShowStep1Errors] = useState(false);

  const step1Valid = values.mainServices.trim() !== '' && values.serviceArea.trim() !== '';

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleNext() {
    if (step === 0 && !step1Valid) {
      setShowStep1Errors(true);
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (step > 0) {
      setStep((s) => s - 1);
    }
  }

  async function handleSubmit() {
    if (!step1Valid) {
      setShowStep1Errors(true);
      setError('Please complete the required fields in Step 1 before submitting.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/client/kb-questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to save questionnaire');
      }

      const data = (await res.json()) as { created: number };
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="border-[#3D7A50]/30">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-[#3D7A50]" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Your AI is ready</h2>
            <p className="text-muted-foreground max-w-sm mb-1">
              We&apos;ve configured your AI with your business information. It will use this
              knowledge to answer homeowner questions accurately.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {result.created} knowledge base{' '}
              {result.created === 1 ? 'entry' : 'entries'} created.
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button asChild variant="outline" size="sm">
                <Link href="/client/knowledge">View Knowledge Base</Link>
              </Button>
              <Button
                asChild
                size="sm"
                style={{ backgroundColor: '#1B2F26' }}
                className="text-white"
              >
                <Link href="/client">Return to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStep = STEPS[step];
  const progressPercent = Math.round(((step + 1) / TOTAL_STEPS) * 100);
  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[#1B2F26]">
            Step {step + 1} of {TOTAL_STEPS}: {currentStep.title}
          </span>
          <span className="text-muted-foreground">{progressPercent}% complete</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      <Card className="border-[#1B2F26]/10">
        <CardHeader>
          <CardTitle className="text-lg text-[#1B2F26]">{currentStep.title}</CardTitle>
          <CardDescription>{currentStep.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Step 1: Services */}
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="q-mainServices">
                  What are your main services? <span className="text-[#C15B2E]">*</span>
                </Label>
                <Textarea
                  id="q-mainServices"
                  placeholder="e.g., Kitchen renovations, bathroom remodels, basement finishing"
                  value={values.mainServices}
                  onChange={(e) => handleChange('mainServices', e.target.value)}
                  rows={3}
                />
                {showStep1Errors && !values.mainServices.trim() && (
                  <p className="text-xs text-[#C15B2E]" role="alert">
                    Please describe your main services.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-servicesNotOffered">What services do you NOT offer?</Label>
                <Textarea
                  id="q-servicesNotOffered"
                  placeholder="e.g., We don&apos;t do roofing, electrical, or plumbing"
                  value={values.servicesNotOffered}
                  onChange={(e) => handleChange('servicesNotOffered', e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-priceRanges">What is your typical price range per service?</Label>
                <Textarea
                  id="q-priceRanges"
                  placeholder="e.g., Kitchens: $25k-$80k, Bathrooms: $15k-$40k"
                  value={values.priceRanges}
                  onChange={(e) => handleChange('priceRanges', e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-serviceArea">
                  What is your service area? <span className="text-[#C15B2E]">*</span>
                </Label>
                <input
                  id="q-serviceArea"
                  type="text"
                  placeholder="e.g., Edmonton and surrounding areas within 50km"
                  value={values.serviceArea}
                  onChange={(e) => handleChange('serviceArea', e.target.value)}
                  className={INPUT_STYLE}
                />
                {showStep1Errors && !values.serviceArea.trim() && (
                  <p className="text-xs text-[#C15B2E]" role="alert">
                    Please specify your service area.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Step 2: Business info */}
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="q-yearsInBusiness">How many years have you been in business?</Label>
                <input
                  id="q-yearsInBusiness"
                  type="text"
                  placeholder="e.g., 12 years"
                  value={values.yearsInBusiness}
                  onChange={(e) => handleChange('yearsInBusiness', e.target.value)}
                  className={INPUT_STYLE}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-licensedAndInsured">Are you licensed and insured?</Label>
                <input
                  id="q-licensedAndInsured"
                  type="text"
                  placeholder="e.g., Yes, fully licensed, $2M liability insurance"
                  value={values.licensedAndInsured}
                  onChange={(e) => handleChange('licensedAndInsured', e.target.value)}
                  className={INPUT_STYLE}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-warranty">What warranty do you offer?</Label>
                <input
                  id="q-warranty"
                  type="text"
                  placeholder="e.g., 2-year workmanship warranty on all projects"
                  value={values.warranty}
                  onChange={(e) => handleChange('warranty', e.target.value)}
                  className={INPUT_STYLE}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-differentiators">
                  What makes your business different from competitors?
                </Label>
                <Textarea
                  id="q-differentiators"
                  placeholder="e.g., We specialize in high-end custom work and never subcontract"
                  value={values.differentiators}
                  onChange={(e) => handleChange('differentiators', e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Step 3: Hours & pricing */}
          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="q-businessHours">What are your business hours?</Label>
                <input
                  id="q-businessHours"
                  type="text"
                  placeholder="e.g., Mon-Fri 8am-5pm, closed weekends"
                  value={values.businessHours}
                  onChange={(e) => handleChange('businessHours', e.target.value)}
                  className={INPUT_STYLE}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-projectTimeline">What is your typical project timeline?</Label>
                <Textarea
                  id="q-projectTimeline"
                  placeholder="e.g., Kitchens: 4-6 weeks, Bathrooms: 2-3 weeks"
                  value={values.projectTimeline}
                  onChange={(e) => handleChange('projectTimeline', e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-pricingHandling">
                  How should the AI handle pricing questions?
                </Label>
                <select
                  id="q-pricingHandling"
                  value={values.pricingHandling}
                  onChange={(e) =>
                    handleChange(
                      'pricingHandling',
                      e.target.value as FormValues['pricingHandling']
                    )
                  }
                  className={SELECT_STYLE}
                >
                  <option value="never_give_prices">
                    Never give prices &mdash; book an estimate
                  </option>
                  <option value="give_general_ranges">Give general ranges</option>
                  <option value="refer_to_website">Refer to website</option>
                </select>
              </div>
            </>
          )}

          {/* Step 4: Booking */}
          {step === 3 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="q-bookingProcess">
                  What&apos;s your preferred booking process?
                </Label>
                <input
                  id="q-bookingProcess"
                  type="text"
                  placeholder="e.g., Book a free in-home estimate, weekday afternoons preferred"
                  value={values.bookingProcess}
                  onChange={(e) => handleChange('bookingProcess', e.target.value)}
                  className={INPUT_STYLE}
                />
              </div>
              <div className="rounded-md bg-[#E3E9E1] border border-[#6B7E54]/20 px-4 py-3 text-sm text-[#1B2F26]">
                <p className="font-medium mb-1">Almost done</p>
                <p className="text-muted-foreground">
                  Review your answers on the previous steps if needed, then submit to save everything to your AI&apos;s knowledge base.
                </p>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-[#C15B2E] bg-[#FDEAE4] rounded-md px-3 py-2">{error}</p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0 || saving}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {isLastStep ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                style={{ backgroundColor: '#1B2F26' }}
                className="text-white gap-1"
              >
                {saving ? 'Saving...' : 'Save to Knowledge Base'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                disabled={saving || (showStep1Errors && !step1Valid && step === 0)}
                style={{ backgroundColor: '#1B2F26' }}
                className="text-white gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
