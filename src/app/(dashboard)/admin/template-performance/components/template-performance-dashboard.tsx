'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TemplatePerformanceCard } from './template-performance-card';
import { VariantCreationModal } from './variant-creation-modal';
import { Plus, TrendingUp, AlertCircle } from 'lucide-react';

interface PerformanceData {
  templateVariants: any[];
  dateRange: string;
  generatedAt: string;
}

export function TemplatePerformanceDashboard() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dateRange, setDateRange] = useState('last_30_days');

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        const url = new URL('/api/admin/templates/performance', window.location.origin);
        url.searchParams.append('dateRange', dateRange);
        if (selectedType) {
          url.searchParams.append('templateType', selectedType);
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch template performance');

        const result = (await response.json()) as PerformanceData;
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [dateRange, selectedType]);

  // Group by template type
  const groupedByType: Record<string, any[]> = {};
  if (data?.templateVariants) {
    data.templateVariants.forEach((variant) => {
      if (!groupedByType[variant.templateType]) {
        groupedByType[variant.templateType] = [];
      }
      groupedByType[variant.templateType].push(variant);
    });
  }

  const templateTypes = Object.keys(groupedByType).sort();

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="last_90_days">Last 90 days</option>
          </select>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Template Variant
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-48 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : templateTypes.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="space-y-2">
            <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
            <p className="text-lg font-medium text-gray-900">No template variants yet</p>
            <p className="text-sm text-gray-600">
              Create your first template variant to start tracking performance
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="mt-4">
              Create First Variant
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {templateTypes.map((templateType) => (
            <div key={templateType} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900 capitalize">
                  {templateType.replace(/_/g, ' ')} Templates
                </h2>
                <Badge variant="secondary">{groupedByType[templateType].length}</Badge>
              </div>

              <div className="grid gap-4">
                {groupedByType[templateType]
                  .sort((a, b) => {
                    // Sort by conversion rate (highest first)
                    const aConv = Number(a.metrics?.conversionRate) || 0;
                    const bConv = Number(b.metrics?.conversionRate) || 0;
                    return bConv - aConv;
                  })
                  .map((variant, index) => (
                    <TemplatePerformanceCard
                      key={variant.id}
                      variant={variant}
                      isWinner={index === 0}
                      onVariantUpdated={() => {
                        // Refetch data after variant update
                        setData(null);
                      }}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <VariantCreationModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            setData(null); // Refetch
          }}
        />
      )}
    </div>
  );
}
