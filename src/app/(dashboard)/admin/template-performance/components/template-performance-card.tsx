'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, TrendingDown, Users, Eye, Copy } from 'lucide-react';
import { RolloutModal } from './rollout-modal';

interface TemplateVariant {
  id: string;
  name: string;
  templateType: string;
  content: string;
  isActive: boolean;
  notes?: string;
  clientsUsing: number;
  metrics: {
    executionsLast30Days: number;
    deliveryRate: number;
    engagementRate: number;
    conversionRate: number;
    responseTime?: number;
  } | null;
  comparison: {
    winnerVs: string;
    improvementPercent: number;
    recommendation: string;
  } | null;
}

interface Props {
  variant: TemplateVariant;
  isWinner: boolean;
  onVariantUpdated?: () => void;
}

export function TemplatePerformanceCard({ variant, isWinner, onVariantUpdated }: Props) {
  const [showRollout, setShowRollout] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const conversionRate = variant.metrics?.conversionRate ? Number(variant.metrics.conversionRate) * 100 : 0;
  const engagementRate = variant.metrics?.engagementRate ? Number(variant.metrics.engagementRate) * 100 : 0;
  const deliveryRate = variant.metrics?.deliveryRate ? Number(variant.metrics.deliveryRate) * 100 : 0;

  return (
    <>
      <Card className={`p-6 ${isWinner ? 'border-2 border-amber-400 bg-amber-50' : ''}`}>
        <div className="grid gap-4">
          {/* Header with winner badge */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{variant.name}</h3>
                {isWinner && (
                  <div className="flex items-center gap-1 rounded-full bg-amber-200 px-2 py-1">
                    <Trophy className="h-4 w-4 text-amber-700" />
                    <span className="text-xs font-bold text-amber-700">WINNER</span>
                  </div>
                )}
                {!variant.isActive && (
                  <Badge variant="outline" className="bg-gray-100">
                    Inactive
                  </Badge>
                )}
              </div>
              {variant.notes && <p className="text-sm text-gray-600">{variant.notes}</p>}
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-600">conversion rate</p>
            </div>
          </div>

          {/* Message preview */}
          <div className="rounded-lg bg-gray-100 p-3">
            <p className="line-clamp-2 text-sm text-gray-700">{variant.content}</p>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              {showDetails ? 'Hide' : 'View full'} message
            </button>
            {showDetails && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white p-2 text-xs text-gray-700">
                {variant.content}
              </div>
            )}
          </div>

          {/* Metrics grid */}
          {variant.metrics ? (
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600">Executions</p>
                <p className="text-lg font-semibold text-gray-900">
                  {variant.metrics.executionsLast30Days.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Delivery</p>
                <p className="text-lg font-semibold text-gray-900">{deliveryRate.toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Engagement</p>
                <p className="text-lg font-semibold text-gray-900">{engagementRate.toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Response Time</p>
                <p className="text-lg font-semibold text-gray-900">
                  {variant.metrics.responseTime ? `${(variant.metrics.responseTime / 60).toFixed(1)}h` : 'N/A'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-100 p-4 text-center text-sm text-gray-600">
              No metrics available yet
            </div>
          )}

          {/* Clients using this variant */}
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              {variant.clientsUsing} client{variant.clientsUsing !== 1 ? 's' : ''} using this variant
            </span>
          </div>

          {/* Comparison with other variants */}
          {variant.comparison && (
            <div
              className={`rounded-lg p-3 ${
                variant.comparison.improvementPercent > 0
                  ? 'border border-green-200 bg-green-50'
                  : 'border border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{variant.comparison.recommendation}</p>
                  <p className="text-xs text-gray-600">vs {variant.comparison.winnerVs}</p>
                </div>
                <div className="flex items-center gap-1">
                  {variant.comparison.improvementPercent > 0 ? (
                    <>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-bold text-green-600">+{variant.comparison.improvementPercent}%</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-bold text-red-600">{variant.comparison.improvementPercent}%</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {variant.isActive && (
              <Button onClick={() => setShowRollout(true)} variant="default" size="sm" className="flex-1 gap-2">
                <TrendingUp className="h-4 w-4" />
                Roll to Clients
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {showRollout && (
        <RolloutModal
          variantId={variant.id}
          variantName={variant.name}
          templateType={variant.templateType}
          clientsAlreadyUsing={variant.clientsUsing}
          onClose={() => setShowRollout(false)}
          onSuccess={() => {
            setShowRollout(false);
            onVariantUpdated?.();
          }}
        />
      )}
    </>
  );
}
