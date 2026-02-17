'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, Eye, EyeOff } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string | null;
  sortOrder: number | null;
  isPublished: boolean | null;
}

export function ArticleEditor() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', content: '', category: '', isPublished: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  async function fetchArticles() {
    const res = await fetch('/api/admin/help-articles');
    const data = (await res.json()) as Article[];
    setArticles(data);
    setLoading(false);
  }

  async function handleSave() {
    const url = editing
      ? `/api/admin/help-articles/${editing}`
      : '/api/admin/help-articles';
    const method = editing ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setEditing(null);
      setForm({ title: '', slug: '', content: '', category: '', isPublished: false });
      fetchArticles();
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/help-articles/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
    fetchArticles();
  }

  async function togglePublish(article: Article) {
    await fetch(`/api/admin/help-articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !article.isPublished }),
    });
    fetchArticles();
  }

  function startEdit(article: Article) {
    setEditing(article.id);
    setForm({
      title: article.title,
      slug: article.slug,
      content: article.content,
      category: article.category || '',
      isPublished: article.isPublished ?? false,
    });
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? 'Edit Article' : 'New Article'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              placeholder="Slug (e.g. getting-started)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="border rounded px-3 py-2 text-sm w-full"
          />
          <textarea
            placeholder="Article content (supports markdown)"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="border rounded px-3 py-2 text-sm w-full min-h-[200px]"
          />
          <div className="flex items-center justify-end gap-3">
            <label className="flex items-center gap-2 text-sm mr-auto">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              />
              Published
            </label>
            {editing && (
              <Button variant="ghost" size="sm" onClick={() => {
                setEditing(null);
                setForm({ title: '', slug: '', content: '', category: '', isPublished: false });
              }}>
                Cancel
              </Button>
            )}
            <Button size="sm" onClick={handleSave}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {articles.map((article) => (
          <Card key={article.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{article.title}</span>
                  <Badge variant={article.isPublished ? 'default' : 'secondary'}>
                    {article.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                  {article.category && (
                    <Badge variant="outline">{article.category}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">/{article.slug}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => togglePublish(article)}>
                  {article.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(article)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(article.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Help Article</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this help article. It will no longer be visible to clients.
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
