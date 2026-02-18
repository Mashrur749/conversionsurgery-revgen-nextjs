'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Client } from '@/db/schema';

interface Props {
  clients: Client[];
}

export default function GenerateReportForm({ clients }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clientId: '',
    startDate: '',
    endDate: '',
    reportType: 'bi-weekly' as 'bi-weekly' | 'monthly' | 'custom',
    title: '',
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!formData.clientId) {
      setError('Please select a client');
      setLoading(false);
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setError('Please enter both start and end dates');
      setLoading(false);
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      setError('Start date must be before end date');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: formData.clientId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reportType: formData.reportType,
          title: formData.title || undefined,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        report?: { id: string };
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate report');
      }

      if (data.report?.id) {
        router.push(`/admin/reports/${data.report.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6">
      {error && (
        <div className="mb-6 p-3 rounded-md bg-[#FDEAE4] text-sienna text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Client Selection */}
        <div className="space-y-2">
          <Label htmlFor="clientId">Client</Label>
          <select
            id="clientId"
            name="clientId"
            value={formData.clientId}
            onChange={handleChange}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
            required
          >
            <option value="">Select a client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Report Type */}
        <div className="space-y-2">
          <Label htmlFor="reportType">Report Type</Label>
          <select
            id="reportType"
            name="reportType"
            value={formData.reportType}
            onChange={handleChange}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="bi-weekly">Bi-Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Custom Title (optional) */}
        <div className="space-y-2">
          <Label htmlFor="title">Custom Title (optional)</Label>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Leave blank for auto-generated title"
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4 justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </div>
    </form>
  );
}
