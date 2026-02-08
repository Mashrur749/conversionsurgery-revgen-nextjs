# Phase 13a: Setup Wizard Flow

## Current State (after Phase 11)
- Can create clients from admin UI
- Can assign phone numbers
- Can add team members
- Each step is on separate pages

## Goal
Create a guided wizard that walks through complete client setup in one flow.

---

## Step 1: Create Setup Wizard Page

**CREATE** `src/app/(dashboard)/admin/clients/new/wizard/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SetupWizard } from './setup-wizard';

export default async function WizardPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <SetupWizard />
    </div>
  );
}
```

---

## Step 2: Create Setup Wizard Component

**CREATE** `src/app/(dashboard)/admin/clients/new/wizard/setup-wizard.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import { StepBusinessInfo } from './steps/step-business-info';
import { StepPhoneNumber } from './steps/step-phone-number';
import { StepTeamMembers } from './steps/step-team-members';
import { StepBusinessHours } from './steps/step-business-hours';
import { StepReview } from './steps/step-review';

export interface WizardData {
  // Step 1: Business Info
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  timezone: string;
  googleBusinessUrl: string;
  // Step 2: Phone Number
  clientId?: string;
  twilioNumber?: string;
  // Step 3: Team Members
  teamMembers: {
    name: string;
    phone: string;
    email: string;
    role: string;
  }[];
  // Step 4: Business Hours
  businessHours: {
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isOpen: boolean;
  }[];
}

const INITIAL_DATA: WizardData = {
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  timezone: 'America/Edmonton',
  googleBusinessUrl: '',
  teamMembers: [],
  businessHours: [
    { dayOfWeek: 0, openTime: '08:00', closeTime: '18:00', isOpen: false },
    { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 6, openTime: '08:00', closeTime: '18:00', isOpen: false },
  ],
};

const STEPS = [
  { id: 'business', title: 'Business Info', description: 'Basic business details' },
  { id: 'phone', title: 'Phone Number', description: 'Assign a Twilio number' },
  { id: 'team', title: 'Team Members', description: 'Who receives notifications' },
  { id: 'hours', title: 'Business Hours', description: 'When to connect calls' },
  { id: 'review', title: 'Review & Launch', description: 'Confirm and activate' },
];

export function SetupWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [isComplete, setIsComplete] = useState(false);

  function updateData(updates: Partial<WizardData>) {
    setData(prev => ({ ...prev, ...updates }));
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }

  function handleComplete() {
    setIsComplete(true);
  }

  if (isComplete) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
          <p className="text-muted-foreground mb-6">
            {data.businessName} is now live and ready to receive leads.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => router.push(`/admin/clients/${data.clientId}`)}>
              View Client
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              Back to All Clients
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const step = STEPS[currentStep];

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold">New Client Setup</h1>
          <span className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`flex flex-col items-center ${
              i <= currentStep ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : i === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span className="text-xs mt-1 hidden md:block">{s.title}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && (
            <StepBusinessInfo
              data={data}
              updateData={updateData}
              onNext={nextStep}
            />
          )}
          {currentStep === 1 && (
            <StepPhoneNumber
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 2 && (
            <StepTeamMembers
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 3 && (
            <StepBusinessHours
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === 4 && (
            <StepReview
              data={data}
              onBack={prevStep}
              onComplete={handleComplete}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 3: Install Progress Component

```bash
npx shadcn@latest add progress
```

---

## Step 4: Create Steps Directory

```bash
mkdir -p src/app/\(dashboard\)/admin/clients/new/wizard/steps
```

---

## Step 5: Create Business Info Step

**CREATE** `src/app/(dashboard)/admin/clients/new/wizard/steps/step-business-info.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WizardData } from '../setup-wizard';

const TIMEZONES = [
  { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { value: 'America/Edmonton', label: 'Mountain (Edmonton/Calgary)' },
  { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
  { value: 'America/Toronto', label: 'Eastern (Toronto)' },
  { value: 'America/Halifax', label: 'Atlantic (Halifax)' },
];

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
}

export function StepBusinessInfo({ data, updateData, onNext }: Props) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    setError('');

    // Validate
    if (!data.businessName || !data.ownerName || !data.email || !data.phone) {
      setError('Please fill in all required fields');
      return;
    }

    // Email validation
    if (!data.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Create the client
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: data.businessName,
          ownerName: data.ownerName,
          email: data.email,
          phone: data.phone,
          timezone: data.timezone,
          googleBusinessUrl: data.googleBusinessUrl,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to create client');
        return;
      }

      // Save the client ID
      updateData({ clientId: result.client.id });
      onNext();
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name *</Label>
          <Input
            id="businessName"
            value={data.businessName}
            onChange={(e) => updateData({ businessName: e.target.value })}
            placeholder="ABC Roofing Ltd."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerName">Owner Name *</Label>
          <Input
            id="ownerName"
            value={data.ownerName}
            onChange={(e) => updateData({ ownerName: e.target.value })}
            placeholder="John Smith"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => updateData({ email: e.target.value })}
            placeholder="john@abcroofing.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            type="tel"
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            placeholder="403-555-1234"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            value={data.timezone}
            onValueChange={(value) => updateData({ timezone: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="googleBusinessUrl">Google Business URL</Label>
          <Input
            id="googleBusinessUrl"
            type="url"
            value={data.googleBusinessUrl}
            onChange={(e) => updateData({ googleBusinessUrl: e.target.value })}
            placeholder="https://g.page/abc-roofing"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleNext} disabled={loading}>
          {loading ? 'Creating...' : 'Next: Phone Number →'}
        </Button>
      </div>
    </div>
  );
}
```

---

## Step 6: Create Phone Number Step

**CREATE** `src/app/(dashboard)/admin/clients/new/wizard/steps/step-phone-number.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatPhoneNumber } from '@/lib/utils/phone';
import type { WizardData } from '../setup-wizard';

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepPhoneNumber({ data, updateData, onNext, onBack }: Props) {
  const [areaCode, setAreaCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [error, setError] = useState('');

  async function handleSearch() {
    if (!areaCode || areaCode.length !== 3) {
      setError('Please enter a 3-digit area code');
      return;
    }

    setSearching(true);
    setError('');
    setNumbers([]);

    try {
      const res = await fetch(`/api/admin/twilio/search?areaCode=${areaCode}&country=CA`);
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to search');
        return;
      }

      setNumbers(result.numbers || []);

      if (result.numbers?.length === 0) {
        setError('No numbers found. Try a different area code.');
      }
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(phoneNumber: string) {
    if (!data.clientId) {
      setError('Client not created yet');
      return;
    }

    setPurchasing(true);
    setError('');

    try {
      const res = await fetch('/api/admin/twilio/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          clientId: data.clientId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to purchase');
        return;
      }

      updateData({ twilioNumber: phoneNumber });
      onNext();
    } finally {
      setPurchasing(false);
    }
  }

  // If already has number, show it
  if (data.twilioNumber) {
    return (
      <div className="space-y-4">
        <div className="p-6 border rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-2">Assigned Number</p>
          <p className="text-3xl font-mono font-bold">
            {formatPhoneNumber(data.twilioNumber)}
          </p>
          <div className="flex justify-center gap-2 mt-3">
            <Badge variant="outline">Voice</Badge>
            <Badge variant="outline">SMS</Badge>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
          <Button onClick={onNext}>
            Next: Team Members →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="areaCode">Search by Area Code</Label>
          <Input
            id="areaCode"
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="403"
            maxLength={3}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleSearch} disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {numbers.length > 0 && (
        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {numbers.map((num) => (
            <div
              key={num.phoneNumber}
              className="flex items-center justify-between p-3 hover:bg-gray-50"
            >
              <div>
                <p className="font-mono font-medium">
                  {formatPhoneNumber(num.phoneNumber)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {num.locality}, {num.region}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handlePurchase(num.phoneNumber)}
                disabled={purchasing}
              >
                {purchasing ? 'Purchasing...' : 'Select'}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button variant="ghost" onClick={onNext}>
          Skip for now →
        </Button>
      </div>
    </div>
  );
}
```

---

## Verify

1. `npm run dev`
2. Visit `/admin/clients/new/wizard`
3. See step progress indicator
4. Fill business info → creates client → moves to step 2
5. Search and purchase number → moves to step 3

---

## Next
Proceed to **Phase 13b** for remaining wizard steps.
