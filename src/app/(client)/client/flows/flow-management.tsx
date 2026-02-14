'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FlowInfo {
  id: string;
  name: string;
  description: string | null;
  category: string;
  trigger: string;
  isActive: boolean | null;
}

interface FlowManagementProps {
  flows: FlowInfo[];
}

const categoryColors: Record<string, string> = {
  estimate: 'bg-blue-100 text-blue-800',
  payment: 'bg-green-100 text-green-800',
  review: 'bg-yellow-100 text-yellow-800',
  referral: 'bg-purple-100 text-purple-800',
  appointment: 'bg-orange-100 text-orange-800',
  missed_call: 'bg-red-100 text-red-800',
  form_response: 'bg-cyan-100 text-cyan-800',
  custom: 'bg-gray-100 text-gray-800',
};

export function FlowManagement({ flows: initialFlows }: FlowManagementProps) {
  const [flows, setFlows] = useState(initialFlows);
  const [toggling, setToggling] = useState<string | null>(null);

  const toggleFlow = async (flowId: string, isActive: boolean) => {
    setToggling(flowId);
    const res = await fetch(`/api/client/flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });

    if (res.ok) {
      setFlows((prev) =>
        prev.map((f) => (f.id === flowId ? { ...f, isActive } : f))
      );
    }
    setToggling(null);
  };

  if (flows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No automation flows have been assigned to your account yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {flows.map((flow) => (
        <Card key={flow.id}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{flow.name}</span>
                <Badge className={categoryColors[flow.category] || categoryColors.custom}>
                  {flow.category.replace('_', ' ')}
                </Badge>
              </div>
              {flow.description && (
                <p className="text-sm text-muted-foreground">{flow.description}</p>
              )}
              <p className="text-xs text-muted-foreground capitalize">
                Trigger: {flow.trigger.replace('_', ' ')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={flow.isActive ?? false}
              disabled={toggling === flow.id}
              onClick={() => toggleFlow(flow.id, !flow.isActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
                flow.isActive ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  flow.isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
