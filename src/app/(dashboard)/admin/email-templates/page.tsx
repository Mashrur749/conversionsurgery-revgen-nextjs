'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/email-templates/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate}>Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {templates.filter((t) => {
          if (!search) return true;
          const q = search.toLowerCase();
          return t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
        }).map((t) => (
          <Card key={t.id} className="hover:bg-gray-50 transition-colors">
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
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(t.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-2">No email templates yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create templates for client reports, onboarding emails, and notifications.</p>
              <Button asChild>
                <Link href="/admin/email-templates/new">Create First Template</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this email template. Any automations using it will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
