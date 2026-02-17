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
      <Card className={`p-6 ${isWinner ? 'border-2 border-olive bg-accent' : ''}`}>
        <div className="grid gap-4">
          {/* Header with winner badge */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">{variant.name}</h3>
                {isWinner && (
                  <div className="flex items-center gap-1 rounded-full bg-[#FFF3E0] px-2 py-1">
                    <Trophy className="h-4 w-4 text-olive" />
                    <span className="text-xs font-bold text-olive">WINNER</span>
                  </div>
                )}
                {!variant.isActive && (
                  <Badge variant="outline" className="bg-muted">
                    Inactive
                  </Badge>
                )}
              </div>
              {variant.notes && <p className="text-sm text-muted-foreground">{variant.notes}</p>}
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">conversion rate</p>
            </div>
          </div>

          {/* Message preview */}
          <div className="rounded-lg bg-muted p-3">
            <p className="line-clamp-2 text-sm text-foreground">{variant.content}</p>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mt-2 text-xs text-forest hover:underline"
            >
              {showDetails ? 'Hide' : 'View full'} message
            </button>
            {showDetails && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded border border-border bg-white p-2 text-xs text-foreground">
                {variant.content}
              </div>
            )}
          </div>

          {/* Metrics grid */}
          {variant.metrics ? (
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Executions</p>
                <p className="text-lg font-semibold text-foreground">
                  {variant.metrics.executionsLast30Days.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Delivery</p>
                <p className="text-lg font-semibold text-foreground">{deliveryRate.toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Engagement</p>
                <p className="text-lg font-semibold text-foreground">{engagementRate.toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Response Time</p>
                <p className="text-lg font-semibold text-foreground">
                  {variant.metrics.responseTime ? `${(variant.metrics.responseTime / 60).toFixed(1)}h` : 'N/A'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
              No metrics available yet
            </div>
          )}

          {/* Clients using this variant */}
          <div className="flex items-center gap-2 rounded-lg bg-sage-light p-3">
            <Users className="h-4 w-4 text-forest" />
            <span className="text-sm font-medium text-forest">
              {variant.clientsUsing} client{variant.clientsUsing !== 1 ? 's' : ''} using this variant
            </span>
          </div>

          {/* Comparison with other variants */}
          {variant.comparison && (
            <div
              className={`rounded-lg p-3 ${
                variant.comparison.improvementPercent > 0
                  ? 'border border-[#3D7A50]/30 bg-[#E8F5E9]'
                  : 'border border-destructive/30 bg-[#FDEAE4]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{variant.comparison.recommendation}</p>
                  <p className="text-xs text-muted-foreground">vs {variant.comparison.winnerVs}</p>
                </div>
                <div className="flex items-center gap-1">
                  {variant.comparison.improvementPercent > 0 ? (
                    <>
                      <TrendingUp className="h-4 w-4 text-[#3D7A50]" />
                      <span className="text-sm font-bold text-[#3D7A50]">+{variant.comparison.improvementPercent}%</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-bold text-destructive">{variant.comparison.improvementPercent}%</span>
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
