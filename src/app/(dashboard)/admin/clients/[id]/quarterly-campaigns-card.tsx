'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CampaignSummary {
  id: string;
  quarterKey: string;
  campaignType: string;
  campaignTypeLabel: string;
  status: string;
  statusLabel: string;
  scheduledAt: string | null;
  launchedAt: string | null;
  completedAt: string | null;
  requiredAssets: string[];
  completedAssets: string[];
  missingAssets: string[];
  missingAssetLabels: string[];
  evidenceCount: number;
  planNotes: string | null;
  outcomeSummary: string | null;
}

interface Props {
  clientId: string;
  initialCampaigns: CampaignSummary[];
}

function formatDate(value: string | null): string {
  if (!value) return 'n/a';
  return new Date(value).toLocaleDateString();
}

export function QuarterlyCampaignsCard({ clientId, initialCampaigns }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [quarterKey, setQuarterKey] = useState('');
  const [evidenceDraft, setEvidenceDraft] = useState<Record<string, string>>({});
  const [outcomeDraft, setOutcomeDraft] = useState<Record<string, string>>({});

  async function refreshCampaigns() {
    const response = await fetch(`/api/admin/clients/${clientId}/quarterly-campaigns`);
    const data = (await response.json()) as { campaigns?: CampaignSummary[]; error?: string };
    if (!response.ok || !data.campaigns) {
      throw new Error(data.error || 'Failed to refresh campaigns');
    }
    setCampaigns(data.campaigns);
  }

  async function applyAction(campaignId: string, payload: Record<string, unknown>) {
    setLoading(campaignId);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/clients/${clientId}/quarterly-campaigns/${campaignId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = (await response.json()) as { campaign?: CampaignSummary; error?: string };
      if (!response.ok || !data.campaign) {
        throw new Error(data.error || 'Failed to update campaign');
      }
      setCampaigns((prev) => prev.map((campaign) => (campaign.id === data.campaign!.id ? data.campaign! : campaign)));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong');
    } finally {
      setLoading(null);
    }
  }

  async function createDraft() {
    setLoading('create');
    setError('');
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/quarterly-campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quarterKey: quarterKey || undefined }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign');
      }
      await refreshCampaigns();
      setQuarterKey('');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Something went wrong');
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quarterly Growth Blitz</CardTitle>
        <CardDescription>
          Plan, launch, and track quarterly campaign execution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg text-sm text-destructive bg-[#FDEAE4]">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="YYYY-QN (optional)"
            value={quarterKey}
            onChange={(event) => setQuarterKey(event.target.value)}
          />
          <Button onClick={createDraft} disabled={loading === 'create'}>
            {loading === 'create' ? 'Creating...' : 'Create Draft'}
          </Button>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quarterly campaigns yet.</p>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{campaign.campaignTypeLabel}</p>
                    <p className="text-sm text-muted-foreground">{campaign.quarterKey}</p>
                  </div>
                  <Badge variant="secondary">{campaign.statusLabel}</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                  <p>Scheduled: {formatDate(campaign.scheduledAt)}</p>
                  <p>Launched: {formatDate(campaign.launchedAt)}</p>
                  <p>Completed: {formatDate(campaign.completedAt)}</p>
                </div>

                {campaign.requiredAssets.length > 0 && (
                  <div className="space-y-2">
                    <Label>Required assets</Label>
                    {campaign.requiredAssets.map((asset) => {
                      const checked = campaign.completedAssets.includes(asset);
                      return (
                        <div key={asset} className="flex items-center justify-between">
                          <p className="text-sm">{asset}</p>
                          <Switch
                            checked={checked}
                            onCheckedChange={(value) =>
                              applyAction(campaign.id, {
                                action: 'toggle_asset',
                                assetKey: asset,
                                completed: value,
                              })
                            }
                            disabled={loading === campaign.id}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {campaign.status === 'planned' && (
                    <Button
                      variant="outline"
                      onClick={() => applyAction(campaign.id, { action: 'approve_plan' })}
                      disabled={loading === campaign.id}
                    >
                      Approve Plan
                    </Button>
                  )}
                  {campaign.status === 'scheduled' && (
                    <Button
                      variant="outline"
                      onClick={() => applyAction(campaign.id, { action: 'launch_campaign' })}
                      disabled={loading === campaign.id}
                    >
                      Launch Campaign
                    </Button>
                  )}
                  {campaign.status === 'launched' && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        applyAction(campaign.id, {
                          action: 'complete_campaign',
                          outcomeSummary: outcomeDraft[campaign.id] || campaign.outcomeSummary || '',
                        })
                      }
                      disabled={loading === campaign.id}
                    >
                      Mark Completed
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Outcome summary</Label>
                  <Textarea
                    value={outcomeDraft[campaign.id] ?? campaign.outcomeSummary ?? ''}
                    onChange={(event) =>
                      setOutcomeDraft((prev) => ({ ...prev, [campaign.id]: event.target.value }))
                    }
                    rows={3}
                    placeholder="Add outcome summary for completion and reporting..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Evidence links/notes</Label>
                  <div className="flex gap-2">
                    <Input
                      value={evidenceDraft[campaign.id] || ''}
                      onChange={(event) =>
                        setEvidenceDraft((prev) => ({ ...prev, [campaign.id]: event.target.value }))
                      }
                      placeholder="https://... or note"
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        applyAction(campaign.id, {
                          action: 'add_evidence',
                          evidence: evidenceDraft[campaign.id] || '',
                        })
                      }
                      disabled={loading === campaign.id || !(evidenceDraft[campaign.id] || '').trim()}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Evidence items logged: {campaign.evidenceCount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
