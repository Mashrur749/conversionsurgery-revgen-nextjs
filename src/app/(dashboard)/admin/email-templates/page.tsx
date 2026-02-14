'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Template {
  id: string;
  slug: string;
  name: string;
  subject: string;
  variables: string[] | null;
  isDefault: boolean | null;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ slug: '', name: '', subject: '', htmlBody: '', variables: '' });

  useEffect(() => { fetchTemplates(); }, []);

  async function fetchTemplates() {
    const res = await fetch('/api/admin/email-templates');
    setTemplates((await res.json()) as Template[]);
    setLoading(false);
  }

  async function handleCreate() {
    const res = await fetch('/api/admin/email-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        variables: form.variables ? form.variables.split(',').map((v) => v.trim()) : [],
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ slug: '', name: '', subject: '', htmlBody: '', variables: '' });
      fetchTemplates();
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/email-templates/${id}`, { method: 'DELETE' });
    fetchTemplates();
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">Manage email templates with variable interpolation.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Slug (e.g. new-lead)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="border rounded px-3 py-2 text-sm" />
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded px-3 py-2 text-sm" />
            </div>
            <input placeholder="Subject line" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="border rounded px-3 py-2 text-sm w-full" />
            <textarea placeholder="HTML body (use {{variable}} for placeholders)" value={form.htmlBody} onChange={(e) => setForm({ ...form, htmlBody: e.target.value })} className="border rounded px-3 py-2 text-sm w-full min-h-[150px]" />
            <input placeholder="Variables (comma-separated: businessName, leadPhone)" value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} className="border rounded px-3 py-2 text-sm w-full" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate}>Create</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{t.name}</span>
                  <Badge variant="outline">{t.slug}</Badge>
                  {t.isDefault && <Badge>Default</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Subject: {t.subject}</p>
                {t.variables && t.variables.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {t.variables.map((v) => (
                      <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <Link href={`/admin/email-templates/${t.id}`}>
                  <Button variant="ghost" size="sm"><Edit2 className="h-4 w-4" /></Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No email templates yet. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}
