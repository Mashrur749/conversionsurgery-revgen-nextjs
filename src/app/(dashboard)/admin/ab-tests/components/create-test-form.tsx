'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { Client } from '@/db/schema';

interface Props {
  clients: Client[];
}

type TestType = 'messaging' | 'timing' | 'team' | 'sequence';

interface Variant {
  name: string;
  description: string;
  config: Record<string, string>;
}

export function CreateTestForm({ clients }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    clientId: '',
    name: '',
    description: '',
    testType: 'messaging' as TestType,
    variantAName: 'Variant A',
    variantADesc: '',
    variantBName: 'Variant B',
    variantBDesc: '',
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!formData.clientId) {
      setError('Please select a client');
      setIsLoading(false);
      return;
    }

    if (!formData.name.trim()) {
      setError('Please enter a test name');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: formData.clientId,
          name: formData.name,
          description: formData.description,
          testType: formData.testType,
          variantA: {
            name: formData.variantAName,
            description: formData.variantADesc,
          },
          variantB: {
            name: formData.variantBName,
            description: formData.variantBDesc,
          },
        }),
      });

      const data = (await res.json()) as { success?: boolean; test?: { id: string }; error?: string };

      if (!res.ok) {
        setError(data.error || 'Failed to create test');
        setIsLoading(false);
        return;
      }

      if (data.test) {
        router.push(`/admin/ab-tests/${data.test.id}`);
      }
    } catch (err: any) {
      console.error('Create test error:', err);
      setError(err.message || 'Failed to create test');
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Setup</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 text-sm text-destructive bg-[#FDEAE4] rounded-lg">
              {error}
            </div>
          )}

          {/* Client Selection */}
          <div>
            <Label htmlFor="clientId" className="text-sm font-medium">
              Client
            </Label>
            <Select value={formData.clientId} onValueChange={(value) => setFormData({ ...formData, clientId: value })}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.businessName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Test Name */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Test Name
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Aggressive messaging vs. Conservative approach"
              className="mt-2"
            />
          </div>

          {/* Test Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="What are you trying to learn from this test?"
              className="mt-2"
              rows={3}
            />
          </div>

          {/* Test Type */}
          <div>
            <Label htmlFor="testType" className="text-sm font-medium">
              Test Type
            </Label>
            <Select value={formData.testType} onValueChange={(value) => setFormData({ ...formData, testType: value as TestType })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="messaging">💬 Messaging - Different messages</SelectItem>
                <SelectItem value="timing">⏰ Timing - Different send times</SelectItem>
                <SelectItem value="team">👥 Team - Different team members</SelectItem>
                <SelectItem value="sequence">🔄 Sequence - Different automation flows</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Variants</h3>

            {/* Variant A */}
            <div className="mb-6 p-4 bg-sage-light rounded-lg border border-forest-light/30">
              <h4 className="font-medium mb-3">Variant A</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="variantAName" className="text-sm">
                    Name
                  </Label>
                  <Input
                    id="variantAName"
                    name="variantAName"
                    value={formData.variantAName}
                    onChange={handleChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="variantADesc" className="text-sm">
                    Description
                  </Label>
                  <Textarea
                    id="variantADesc"
                    name="variantADesc"
                    value={formData.variantADesc}
                    onChange={handleChange}
                    placeholder="What makes this variant different?"
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Variant B */}
            <div className="p-4 bg-accent rounded-lg border border-olive/30">
              <h4 className="font-medium mb-3">Variant B</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="variantBName" className="text-sm">
                    Name
                  </Label>
                  <Input
                    id="variantBName"
                    name="variantBName"
                    value={formData.variantBName}
                    onChange={handleChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="variantBDesc" className="text-sm">
                    Description
                  </Label>
                  <Textarea
                    id="variantBDesc"
                    name="variantBDesc"
                    value={formData.variantBDesc}
                    onChange={handleChange}
                    placeholder="What makes this variant different?"
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Test'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
