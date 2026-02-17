'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  version: number;
}

interface FlowUsage {
  flowId: string;
  flowName: string;
  syncMode: string | null;
  templateVersion: number | null;
  clientId: string;
  clientName: string;
}

interface PushResult {
  affected: number;
  skipped: number;
  details: Array<{
    clientId: string;
    flowId: string;
    action: 'updated' | 'skipped';
    reason?: string;
  }>;
}

interface PushUpdateViewProps {
  template: Template;
  usage: FlowUsage[];
}

export function PushUpdateView({ template, usage }: PushUpdateViewProps) {
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);

  const inherit = usage.filter((u) => u.syncMode === 'inherit');
  const override = usage.filter((u) => u.syncMode === 'override');
  const detached = usage.filter((u) => u.syncMode === 'detached');
  const outdated = usage.filter((u) => u.templateVersion !== template.version);

  const push = async () => {
    setPushing(true);
    try {
      const res = await fetch(`/api/admin/flow-templates/${template.id}/push`, {
        method: 'POST',
      });

      const data = (await res.json()) as PushResult;
      setResult(data);
      toast.success(`Updated ${data.affected} client flows`);
    } catch {
      toast.error('Failed to push update');
    } finally {
      setPushing(false);
    }
  };

  const dryRun = async () => {
    setPushing(true);
    try {
      const res = await fetch(
        `/api/admin/flow-templates/${template.id}/push?dryRun=true`,
        { method: 'POST' }
      );

      const data = (await res.json()) as PushResult;
      setResult(data);
    } catch {
      toast.error('Failed to preview');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/flow-templates/${template.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Push Template Update</h1>
          <p className="text-muted-foreground">
            {template.name} &bull; Version {template.version}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{usage.length}</div>
            <p className="text-sm text-muted-foreground">Total using template</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-[#3D7A50]">{inherit.length}</div>
            <p className="text-sm text-muted-foreground">Will update (inherit)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-sienna">{override.length}</div>
            <p className="text-sm text-muted-foreground">Partial update (override)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-muted-foreground">{detached.length}</div>
            <p className="text-sm text-muted-foreground">Won&apos;t update (detached)</p>
          </CardContent>
        </Card>
      </div>

      {/* Client list */}
      <Card>
        <CardHeader>
          <CardTitle>Affected Clients ({outdated.length} outdated)</CardTitle>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No client flows use this template yet.
            </p>
          ) : (
            <div className="space-y-2">
              {usage.map((u) => {
                const isOutdated = u.templateVersion !== template.version;
                const willUpdate = u.syncMode !== 'detached' && isOutdated;

                return (
                  <div
                    key={u.flowId}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {willUpdate ? (
                        <CheckCircle className="h-5 w-5 text-[#3D7A50]" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{u.clientName}</p>
                        <p className="text-sm text-muted-foreground">{u.flowName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          u.syncMode === 'inherit'
                            ? 'default'
                            : u.syncMode === 'override'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {u.syncMode}
                      </Badge>
                      {isOutdated && (
                        <Badge variant="destructive">
                          v{u.templateVersion} &rarr; v{template.version}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              {result.affected > 0 ? 'Update Complete' : 'Preview Results'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-[#3D7A50]">
                &#10003; {result.affected} flows updated
              </p>
              <p className="text-muted-foreground">
                &#10007; {result.skipped} flows skipped
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={dryRun} disabled={pushing}>
          Preview Changes
        </Button>
        <Button onClick={push} disabled={pushing || outdated.length === 0}>
          {pushing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Push to {inherit.length + override.length} Clients
        </Button>
      </div>
    </div>
  );
}
