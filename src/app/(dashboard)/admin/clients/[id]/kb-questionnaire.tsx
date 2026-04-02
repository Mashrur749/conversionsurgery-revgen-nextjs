'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { BookOpen, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

interface KbQuestionnaireProps {
  clientId: string;
  kbCount: number;
}

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
  pricingHandling: string;
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

const SELECT_STYLE =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring';

export function KbQuestionnaire({ clientId, kbCount }: KbQuestionnaireProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only show the cold-start prompt when KB count is low
  if (kbCount >= 5 && !isOpen && !result) {
    return null;
  }

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/kb-questionnaire`, {
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
      <Card className="border-[#3D7A50]/30 bg-[#E8F5E9]">
        <CardContent className="py-6 flex flex-col items-center gap-3 text-center">
          <CheckCircle className="h-8 w-8 text-[#3D7A50]" />
          <p className="font-semibold text-[#3D7A50]">
            {result.created} knowledge base {result.created === 1 ? 'entry' : 'entries'} created
          </p>
          <p className="text-sm text-muted-foreground">
            The AI can now answer common questions about this contractor&apos;s business.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/clients/${clientId}/knowledge`}>View Knowledge Base</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-olive/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-olive" />
            <div>
              <CardTitle className="text-base">Quick Setup: KB Questionnaire</CardTitle>
              <CardDescription className="mt-0.5">
                Fill in the contractor&apos;s details to pre-populate the knowledge base — reduces AI cold-start time.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen((prev) => !prev)}
            className="shrink-0"
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="sr-only">{isOpen ? 'Collapse' : 'Expand'}</span>
          </Button>
        </div>
      </CardHeader>

      {!isOpen && (
        <CardContent className="pt-0">
          <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
            Start Questionnaire
          </Button>
        </CardContent>
      )}

      {isOpen && (
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Services */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-forest border-b pb-2">Services</h3>

              <div className="space-y-1.5">
                <Label htmlFor="q-mainServices">What are your main services?</Label>
                <Textarea
                  id="q-mainServices"
                  placeholder="e.g., Kitchen renovations, bathroom remodels, basement finishing"
                  value={values.mainServices}
                  onChange={(e) => handleChange('mainServices', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="q-servicesNotOffered">What services do you NOT offer?</Label>
                <Textarea
                  id="q-servicesNotOffered"
                  placeholder="e.g., We don&apos;t do roofing, electrical, or plumbing"
                  value={values.servicesNotOffered}
                  onChange={(e) => handleChange('servicesNotOffered', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="q-priceRanges">What is your typical price range per service?</Label>
                <Textarea
                  id="q-priceRanges"
                  placeholder="e.g., Kitchens: $25k-$80k, Bathrooms: $15k-$40k"
                  value={values.priceRanges}
                  onChange={(e) => handleChange('priceRanges', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="q-serviceArea">What is your service area?</Label>
                <input
                  id="q-serviceArea"
                  type="text"
                  placeholder="e.g., Edmonton and surrounding areas within 50km"
                  value={values.serviceArea}
                  onChange={(e) => handleChange('serviceArea', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="q-projectTimeline">What is your typical project timeline?</Label>
                <Textarea
                  id="q-projectTimeline"
                  placeholder="e.g., Kitchens: 4-6 weeks, Bathrooms: 2-3 weeks"
                  value={values.projectTimeline}
                  onChange={(e) => handleChange('projectTimeline', e.target.value)}
                />
              </div>
            </section>

            {/* Business Info */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-forest border-b pb-2">Business Info</h3>

              <div className="space-y-1.5">
                <Label htmlFor="q-warranty">What warranty do you offer?</Label>
                <input
                  id="q-warranty"
                  type="text"
                  placeholder="e.g., 2-year workmanship warranty on all projects"
                  value={values.warranty}
                  onChange={(e) => handleChange('warranty', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
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
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="q-yearsInBusiness">How many years in business?</Label>
                <input
                  id="q-yearsInBusiness"
                  type="text"
                  placeholder="e.g., 12 years"
                  value={values.yearsInBusiness}
                  onChange={(e) => handleChange('yearsInBusiness', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
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
                />
              </div>
            </section>

            {/* Booking & Availability */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-forest border-b pb-2">
                Booking &amp; Availability
              </h3>

              <div className="space-y-1.5">
                <Label htmlFor="q-businessHours">What are your business hours?</Label>
                <input
                  id="q-businessHours"
                  type="text"
                  placeholder="e.g., Mon-Fri 8am-5pm, closed weekends"
                  value={values.businessHours}
                  onChange={(e) => handleChange('businessHours', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="q-pricingHandling">
                  How should the AI handle pricing questions?
                </Label>
                <select
                  id="q-pricingHandling"
                  value={values.pricingHandling}
                  onChange={(e) => handleChange('pricingHandling', e.target.value)}
                  className={SELECT_STYLE}
                >
                  <option value="never_give_prices">
                    Never give prices &mdash; book an estimate
                  </option>
                  <option value="give_general_ranges">Give general ranges</option>
                  <option value="refer_to_website">Refer to website</option>
                </select>
              </div>

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
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </section>

            {error && (
              <p className="text-sm text-sienna bg-[#FDEAE4] rounded-md px-3 py-2">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save to Knowledge Base'}
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
