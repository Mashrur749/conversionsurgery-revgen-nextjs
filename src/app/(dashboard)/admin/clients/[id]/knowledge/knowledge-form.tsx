'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { industryPresets, industryOptions } from '@/lib/data/industry-presets';
import type { StructuredKnowledgeData } from '@/lib/services/structured-knowledge';

interface KnowledgeFormProps {
  clientId: string;
  initialData?: StructuredKnowledgeData | null;
  onSave?: () => void;
}

const emptyData: StructuredKnowledgeData = {
  services: [{ name: '', priceRangeMin: 0, priceRangeMax: 0, canDiscussPrice: 'defer' }],
  dontDo: [''],
  coveredAreas: [''],
  areaExclusions: [],
  offersEstimates: true,
  estimateConditions: '',
  offersExactQuotes: false,
  pricingNotes: '',
  afterBooking: '',
  paymentTerms: '',
  warranty: '',
  faqs: [{ question: '', answer: '' }],
  neverSay: [''],
};

export default function KnowledgeForm({ clientId, initialData, onSave }: KnowledgeFormProps) {
  const [data, setData] = useState<StructuredKnowledgeData>(initialData || emptyData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function applyPreset(industry: string) {
    const preset = industryPresets[industry];
    if (!preset) return;

    setData(prev => ({
      ...prev,
      services: preset.services.map(s => ({ ...s, canDiscussPrice: 'yes_range' as const })),
      dontDo: preset.dontDo.length > 0 ? preset.dontDo : [''],
      faqs: preset.commonFaqs.length > 0 ? preset.commonFaqs : [{ question: '', answer: '' }],
      neverSay: preset.neverSay.length > 0 ? preset.neverSay : [''],
    }));
  }

  // ---- Service helpers ----
  function updateService(index: number, field: string, value: string | number) {
    setData(prev => {
      const updated = [...prev.services];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, services: updated };
    });
  }

  function addService() {
    setData(prev => ({
      ...prev,
      services: [...prev.services, { name: '', priceRangeMin: 0, priceRangeMax: 0, canDiscussPrice: 'defer' }],
    }));
  }

  function removeService(index: number) {
    setData(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }));
  }

  // ---- List helpers ----
  function updateListItem(field: 'dontDo' | 'coveredAreas' | 'areaExclusions' | 'neverSay', index: number, value: string) {
    setData(prev => {
      const updated = [...prev[field]];
      updated[index] = value;
      return { ...prev, [field]: updated };
    });
  }

  function addListItem(field: 'dontDo' | 'coveredAreas' | 'areaExclusions' | 'neverSay') {
    setData(prev => ({ ...prev, [field]: [...prev[field], ''] }));
  }

  function removeListItem(field: 'dontDo' | 'coveredAreas' | 'areaExclusions' | 'neverSay', index: number) {
    setData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  }

  // ---- FAQ helpers ----
  function updateFaq(index: number, field: 'question' | 'answer', value: string) {
    setData(prev => {
      const updated = [...prev.faqs];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, faqs: updated };
    });
  }

  function addFaq() {
    setData(prev => ({ ...prev, faqs: [...prev.faqs, { question: '', answer: '' }] }));
  }

  function removeFaq(index: number) {
    setData(prev => ({ ...prev, faqs: prev.faqs.filter((_, i) => i !== index) }));
  }

  // ---- Save ----
  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);

    // Filter out empty entries
    const cleanData: StructuredKnowledgeData = {
      ...data,
      services: data.services.filter(s => s.name.trim()),
      dontDo: data.dontDo.filter(d => d.trim()),
      coveredAreas: data.coveredAreas.filter(a => a.trim()),
      areaExclusions: data.areaExclusions.filter(a => a.trim()),
      faqs: data.faqs.filter(f => f.question.trim() && f.answer.trim()),
      neverSay: data.neverSay.filter(n => n.trim()),
    };

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/knowledge/structured`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData),
      });

      if (!res.ok) {
        const errBody: { error?: string } = await res.json();
        throw new Error(errBody.error || 'Failed to save');
      }

      setSaved(true);
      onSave?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Industry Preset Selector */}
      <div className="p-4 bg-muted/50 rounded-lg border">
        <Label className="text-sm font-medium">Quick Start: Load industry presets</Label>
        <p className="text-xs text-muted-foreground mb-2">Pre-populates common services, FAQs, and restrictions for your trade.</p>
        <div className="flex gap-2 flex-wrap">
          {industryOptions.map(opt => (
            <Button key={opt.value} variant="outline" size="sm" onClick={() => applyPreset(opt.value)}>
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Section 1: Services */}
      <section>
        <h3 className="text-lg font-semibold mb-1">Services You Offer</h3>
        <p className="text-sm text-muted-foreground mb-4">List the services you provide. This helps AI answer questions and classify leads.</p>

        <div className="space-y-3">
          {data.services.map((service, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  placeholder="Service name (e.g. Drain cleaning)"
                  value={service.name}
                  onChange={e => updateService(i, 'name', e.target.value)}
                />
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  placeholder="Min $"
                  value={service.priceRangeMin || ''}
                  onChange={e => updateService(i, 'priceRangeMin', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  placeholder="Max $"
                  value={service.priceRangeMax || ''}
                  onChange={e => updateService(i, 'priceRangeMax', parseInt(e.target.value) || 0)}
                />
              </div>
              <Select
                value={service.canDiscussPrice}
                onValueChange={v => updateService(i, 'canDiscussPrice', v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes_range">Share range</SelectItem>
                  <SelectItem value="defer">Defer to estimate</SelectItem>
                  <SelectItem value="never">Never discuss</SelectItem>
                </SelectContent>
              </Select>
              {data.services.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeService(i)}>X</Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addService}>+ Add Service</Button>
        </div>
      </section>

      {/* Boundaries */}
      <section>
        <h3 className="text-lg font-semibold mb-1">What You DON'T Do</h3>
        <p className="text-sm text-muted-foreground mb-4">Critical for AI — prevents making promises about services you can't deliver.</p>

        <div className="space-y-2">
          {data.dontDo.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="e.g. Gas line work"
                value={item}
                onChange={e => updateListItem('dontDo', i, e.target.value)}
                className="flex-1"
              />
              {data.dontDo.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeListItem('dontDo', i)}>X</Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addListItem('dontDo')}>+ Add Item</Button>
        </div>
      </section>

      {/* Section 2: Service Area */}
      <section>
        <h3 className="text-lg font-semibold mb-1">Service Area</h3>
        <p className="text-sm text-muted-foreground mb-4">Where do you work?</p>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">Cities/areas you cover</Label>
            <div className="space-y-2 mt-1">
              {data.coveredAreas.map((area, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="e.g. Calgary, Airdrie"
                    value={area}
                    onChange={e => updateListItem('coveredAreas', i, e.target.value)}
                    className="flex-1"
                  />
                  {data.coveredAreas.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeListItem('coveredAreas', i)}>X</Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addListItem('coveredAreas')}>+ Add Area</Button>
            </div>
          </div>

          <div>
            <Label className="text-sm">Areas you do NOT service (optional)</Label>
            <div className="space-y-2 mt-1">
              {data.areaExclusions.map((area, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="e.g. Outside city limits"
                    value={area}
                    onChange={e => updateListItem('areaExclusions', i, e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeListItem('areaExclusions', i)}>X</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addListItem('areaExclusions')}>+ Add Exclusion</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Pricing */}
      <section>
        <h3 className="text-lg font-semibold mb-1">Pricing & Estimates</h3>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={data.offersEstimates}
              onCheckedChange={v => setData(prev => ({ ...prev, offersEstimates: v }))}
            />
            <Label>We offer free estimates</Label>
          </div>
          {data.offersEstimates && (
            <Input
              placeholder="Any conditions? (e.g. Free for jobs over $500)"
              value={data.estimateConditions}
              onChange={e => setData(prev => ({ ...prev, estimateConditions: e.target.value }))}
            />
          )}

          <div className="flex items-center gap-3">
            <Switch
              checked={data.offersExactQuotes}
              onCheckedChange={v => setData(prev => ({ ...prev, offersExactQuotes: v }))}
            />
            <Label>AI can give exact quotes over text</Label>
          </div>

          <div>
            <Label className="text-sm">Additional pricing notes (optional)</Label>
            <Textarea
              placeholder="e.g. We offer financing for jobs over $3,000..."
              value={data.pricingNotes}
              onChange={e => setData(prev => ({ ...prev, pricingNotes: e.target.value }))}
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
      </section>

      {/* Section 4: Process */}
      <section>
        <h3 className="text-lg font-semibold mb-1">Process & Logistics</h3>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">What happens after someone books?</Label>
            <Textarea
              placeholder="e.g. A technician will call 30 minutes before arrival. Please make sure someone is home..."
              value={data.afterBooking}
              onChange={e => setData(prev => ({ ...prev, afterBooking: e.target.value }))}
              className="mt-1"
              rows={3}
            />
          </div>
          <div>
            <Label className="text-sm">Payment terms</Label>
            <Textarea
              placeholder="e.g. Payment due on completion. We accept credit cards, debit, and e-transfer."
              value={data.paymentTerms}
              onChange={e => setData(prev => ({ ...prev, paymentTerms: e.target.value }))}
              className="mt-1"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-sm">Warranty</Label>
            <Textarea
              placeholder="e.g. 1-year warranty on labour, manufacturer warranty on parts."
              value={data.warranty}
              onChange={e => setData(prev => ({ ...prev, warranty: e.target.value }))}
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
      </section>

      {/* Section 5: FAQs */}
      <section>
        <h3 className="text-lg font-semibold mb-1">Common Questions</h3>
        <p className="text-sm text-muted-foreground mb-4">Add at least 5 questions people commonly ask. The AI will use these to answer accurately.</p>

        <div className="space-y-4">
          {data.faqs.map((faq, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Question"
                  value={faq.question}
                  onChange={e => updateFaq(i, 'question', e.target.value)}
                  className="flex-1"
                />
                {data.faqs.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeFaq(i)}>X</Button>
                )}
              </div>
              <Textarea
                placeholder="Answer"
                value={faq.answer}
                onChange={e => updateFaq(i, 'answer', e.target.value)}
                rows={2}
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addFaq}>+ Add FAQ</Button>
        </div>
      </section>

      {/* Section 6: Never Say */}
      <section>
        <h3 className="text-lg font-semibold mb-1">Things AI Must Never Say</h3>
        <p className="text-sm text-muted-foreground mb-4">Hard boundaries the AI must respect at all times.</p>

        <div className="space-y-2">
          {data.neverSay.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="e.g. Never guarantee same-day service"
                value={item}
                onChange={e => updateListItem('neverSay', i, e.target.value)}
                className="flex-1"
              />
              {data.neverSay.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeListItem('neverSay', i)}>X</Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addListItem('neverSay')}>+ Add Rule</Button>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4 pt-4 border-t">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Knowledge Base'}
        </Button>
        {saved && <p className="text-sm text-[#3D7A50]">Saved successfully!</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
