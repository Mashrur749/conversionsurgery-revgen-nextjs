'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Version {
  id: string;
  version: number;
  snapshot: {
    name: string;
    steps: Array<{
      stepNumber: number;
      delayMinutes: number;
      messageTemplate: string;
    }>;
  } | null;
  changeNotes: string | null;
  publishedAt: string;
  publishedBy: string | null;
}

export function VersionHistory({ templateId }: { templateId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/flow-templates/${templateId}/versions`)
      .then((r) => r.json() as Promise<Version[]>)
      .then((data) => {
        setVersions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [templateId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading versions...</p>;
  if (versions.length === 0) return <p className="text-sm text-muted-foreground">No published versions yet.</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Version History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {versions.map((v) => (
          <div key={v.id} className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">v{v.version}</Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(v.publishedAt), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(expanded === v.id ? null : v.id)}
              >
                {expanded === v.id ? 'Hide' : 'Details'}
              </Button>
            </div>
            {v.changeNotes && (
              <p className="text-sm mt-1">{v.changeNotes}</p>
            )}
            {expanded === v.id && v.snapshot && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {v.snapshot.steps.length} steps
                </p>
                {v.snapshot.steps.map((step) => (
                  <div key={step.stepNumber} className="text-xs bg-gray-50 rounded p-2">
                    <span className="font-medium">Step {step.stepNumber}</span>
                    {step.delayMinutes > 0 && (
                      <span className="text-muted-foreground ml-2">
                        (delay: {step.delayMinutes}min)
                      </span>
                    )}
                    <p className="mt-1 text-muted-foreground truncate">
                      {step.messageTemplate}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PublishButton({
  templateId,
  onPublished,
}: {
  templateId: string;
  onPublished?: () => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/flow-templates/${templateId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeNotes: notes || undefined }),
      });
      if (res.ok) {
        setShowForm(false);
        setNotes('');
        onPublished?.();
      }
    } finally {
      setPublishing(false);
    }
  }

  if (!showForm) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
        Publish Version
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Change notes (optional)"
        className="border rounded px-2 py-1 text-sm flex-1"
      />
      <Button size="sm" onClick={handlePublish} disabled={publishing}>
        {publishing ? 'Publishing...' : 'Publish'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
        Cancel
      </Button>
    </div>
  );
}
