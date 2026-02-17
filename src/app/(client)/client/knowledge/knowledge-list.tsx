'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { KbEntryForm } from './kb-entry-form';

interface KbEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number | null;
}

const categoryLabels: Record<string, string> = {
  services: 'Services',
  pricing: 'Pricing',
  faq: 'FAQ',
  policies: 'Policies',
  about: 'About',
  custom: 'Custom',
};

const categoryColors: Record<string, string> = {
  services: 'bg-blue-100 text-blue-800',
  pricing: 'bg-green-100 text-green-800',
  faq: 'bg-purple-100 text-purple-800',
  policies: 'bg-orange-100 text-orange-800',
  about: 'bg-gray-100 text-gray-800',
  custom: 'bg-pink-100 text-pink-800',
};

interface KnowledgeListProps {
  grouped: Record<string, KbEntry[]>;
}

export function KnowledgeList({ grouped }: KnowledgeListProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KbEntry | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(deleteId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/client/knowledge/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteId(null);
      router.refresh();
    } catch {
      setDeleteError('Failed to delete entry. Please try again.');
    } finally {
      setDeleting(null);
    }
  }

  function handleSaved() {
    setShowForm(false);
    setEditingEntry(null);
    router.refresh();
  }

  const searchLower = search.toLowerCase();
  const categories = Object.keys(grouped).sort();

  return (
    <>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { setEditingEntry(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Add Entry
        </Button>
      </div>

      {(showForm || editingEntry) && (
        <KbEntryForm
          entry={editingEntry}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditingEntry(null); }}
        />
      )}

      {categories.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>No knowledge base entries yet.</p>
            <p className="text-sm mt-1">Add information about your services, pricing, and FAQs so the AI can answer customer questions accurately.</p>
          </CardContent>
        </Card>
      )}

      {categories.map((category) => {
        const entries = grouped[category].filter((e) =>
          !search ||
          e.title.toLowerCase().includes(searchLower) ||
          e.content.toLowerCase().includes(searchLower)
        );

        if (entries.length === 0) return null;

        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge className={categoryColors[category] || categoryColors.custom}>
                  {categoryLabels[category] || category}
                </Badge>
                <span className="text-sm text-gray-500">{entries.length} entries</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm">{entry.title}</h4>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap line-clamp-3">{entry.content}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingEntry(entry); setShowForm(false); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(entry.id)}
                        disabled={deleting === entry.id}
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {deleteError && (
        <div className="p-3 text-sm text-red-600 bg-red-100 rounded">
          {deleteError}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Entry</AlertDialogTitle>
            <AlertDialogDescription>
              The AI will no longer use this information when responding to customers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
