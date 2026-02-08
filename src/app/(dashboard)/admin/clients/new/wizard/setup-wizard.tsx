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
            <Button variant="outline" onClick={() => router.push('/admin/clients')}>
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
