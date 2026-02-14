'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy, Check } from 'lucide-react';

interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string[] | null;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [clientId, setClientId] = useState('');
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function fetchKeys() {
    if (!clientId) return;
    setLoading(true);
    const res = await fetch(`/api/admin/api-keys?clientId=${clientId}`);
    if (res.ok) setKeys((await res.json()) as ApiKey[]);
    setLoading(false);
  }

  useEffect(() => {
    if (clientId) fetchKeys();
  }, [clientId]);

  async function handleCreate() {
    const res = await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        label,
        scopes: scopes ? scopes.split(',').map((s) => s.trim()) : [],
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { key: string };
      setNewKey(data.key);
      setLabel('');
      setScopes('');
      setShowCreate(false);
      fetchKeys();
    }
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    fetchKeys();
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium">Client ID</label>
          <input
            placeholder="Enter client UUID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-full mt-1"
          />
        </div>
        <Button size="sm" onClick={fetchKeys} disabled={!clientId}>
          Load Keys
        </Button>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)} disabled={!clientId}>
          <Plus className="h-4 w-4 mr-1" /> New Key
        </Button>
      </div>

      {newKey && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="py-3">
            <p className="text-sm font-medium text-green-800 mb-1">
              API key created. Copy it now — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-white px-2 py-1 rounded border flex-1 break-all">
                {newKey}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setNewKey(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <input
              placeholder="Label (e.g. CRM Integration)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <input
              placeholder="Scopes (comma-separated: leads:read, leads:write)"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!label}>
                Create
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading...</p>}

      <div className="space-y-2">
        {keys.map((k) => (
          <Card key={k.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{k.label}</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {k.keyPrefix}...
                  </Badge>
                  {k.isActive ? (
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Revoked</Badge>
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                  {k.lastUsedAt && (
                    <span>Last used: {new Date(k.lastUsedAt).toLocaleDateString()}</span>
                  )}
                  {k.expiresAt && (
                    <span>Expires: {new Date(k.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
                {k.scopes && (k.scopes as string[]).length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {(k.scopes as string[]).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
              {k.isActive && (
                <Button variant="ghost" size="sm" onClick={() => handleRevoke(k.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {!loading && clientId && keys.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No API keys for this client. Create one to get started.
          </p>
        )}
      </div>
    </div>
  );
}
