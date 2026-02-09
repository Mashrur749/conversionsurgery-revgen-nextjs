'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number | null;
}

interface Props {
  clientId: string;
  entries: KnowledgeEntry[];
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  services: { label: 'Services', color: 'bg-blue-100 text-blue-800' },
  pricing: { label: 'Pricing', color: 'bg-green-100 text-green-800' },
  faq: { label: 'FAQ', color: 'bg-purple-100 text-purple-800' },
  policies: { label: 'Policies', color: 'bg-yellow-100 text-yellow-800' },
  about: { label: 'About', color: 'bg-gray-100 text-gray-800' },
  custom: { label: 'Custom', color: 'bg-orange-100 text-orange-800' },
};

export function KnowledgeList({ clientId, entries }: Props) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm('Delete this entry?')) return;

    await fetch(`/api/admin/clients/${clientId}/knowledge/${id}`, {
      method: 'DELETE',
    });
    router.refresh();
  }

  // Group by category
  const byCategory: Record<string, KnowledgeEntry[]> = {};
  for (const entry of entries) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = [];
    }
    byCategory[entry.category].push(entry);
  }

  const categoryOrder = ['about', 'services', 'pricing', 'policies', 'faq', 'custom'];

  return (
    <div className="space-y-6">
      {categoryOrder.map((category) => {
        const categoryEntries = byCategory[category];
        if (!categoryEntries?.length) return null;

        const catInfo = categoryLabels[category] || { label: category, color: 'bg-gray-100' };

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={catInfo.color}>{catInfo.label}</Badge>
                <span className="text-sm text-muted-foreground font-normal">
                  {categoryEntries.length} entries
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{entry.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {entry.content.length > 200
                          ? `${entry.content.slice(0, 200)}...`
                          : entry.content}
                      </p>
                      {entry.keywords && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Keywords: {entry.keywords}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/clients/${clientId}/knowledge/${entry.id}`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleDelete(entry.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {entries.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No knowledge entries yet. Add your first entry to help the AI respond accurately.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
