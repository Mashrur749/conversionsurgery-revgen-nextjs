'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Template {
  id: string;
  slug: string;
  name: string;
  subject: string;
  htmlBody: string;
  variables: string[] | null;
  isDefault: boolean | null;
}

export default function EmailTemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', htmlBody: '' });
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    fetch(`/api/admin/email-templates/${params.id}`)
      .then((r) => r.json() as Promise<Template>)
      .then((data) => {
        setTemplate(data);
        setForm({ name: data.name, subject: data.subject, htmlBody: data.htmlBody });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/admin/email-templates/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = (await res.json()) as Template;
      setTemplate(updated);
    }
    setSaving(false);
  }

  function handlePreview() {
    let html = form.htmlBody;
    if (template?.variables) {
      for (const v of template.variables) {
        html = html.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), `<strong>[${v}]</strong>`);
      }
    }
    setPreviewHtml(html);
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!template) return <p className="text-destructive">Template not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/email-templates">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit: {template.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{template.slug}</Badge>
            {template.variables && template.variables.map((v) => (
              <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <input
              placeholder="Subject line"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <textarea
              placeholder="HTML body"
              value={form.htmlBody}
              onChange={(e) => setForm({ ...form, htmlBody: e.target.value })}
              className="border rounded px-3 py-2 text-sm w-full min-h-[300px] font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePreview}>
                Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {previewHtml ? (
              <div
                className="border rounded p-4 bg-white"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <p className="text-muted-foreground text-sm">Click Preview to see the rendered template.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
