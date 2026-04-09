'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import Link from 'next/link';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string | null;
}

interface HelpContentProps {
  operatorName: string | null;
  operatorPhone: string | null;
}

export function HelpContent({ operatorName, operatorPhone }: HelpContentProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadArticles = useCallback(() => {
    setError('');
    fetch('/api/client/help-articles')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((data) => setArticles(data as Article[]))
      .catch(() => setError('Unable to load help articles. Please try again later.'));
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const filtered = search
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.content.toLowerCase().includes(search.toLowerCase())
      )
    : articles;

  const categories = [...new Set(filtered.map((a) => a.category).filter(Boolean))];

  return (
    <>
      {operatorPhone && (
        <Card className="border-[#6B7E54]/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Your Account Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{operatorName ?? 'ConversionSurgery Team'}</p>
            <p className="text-sm text-muted-foreground">{operatorPhone}</p>
            <p className="text-xs text-muted-foreground mt-1">Text or call anytime during business hours</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-[#FDEAE4] bg-[#FDEAE4] px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-[#C15B2E]">{error}</p>
          <Button variant="ghost" size="sm" className="text-[#C15B2E] hover:text-[#C15B2E]" onClick={loadArticles}>
            Retry
          </Button>
        </div>
      )}

      {!error && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {!error && categories.map((cat) => (
        <div key={cat}>
          <h2 className="text-lg font-semibold mb-3">{cat}</h2>
          <div className="space-y-2">
            {filtered
              .filter((a) => a.category === cat)
              .map((article) => (
                <Card key={article.id} className="cursor-pointer" onClick={() => setExpanded(expanded === article.id ? null : article.id)}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">{article.title}</CardTitle>
                  </CardHeader>
                  {expanded === article.id && (
                    <CardContent className="pt-0">
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {article.content}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
          </div>
        </div>
      ))}

      {!error && filtered.filter((a) => !a.category).length > 0 && (
        <div className="space-y-2">
          {filtered
            .filter((a) => !a.category)
            .map((article) => (
              <Card key={article.id} className="cursor-pointer" onClick={() => setExpanded(expanded === article.id ? null : article.id)}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">{article.title}</CardTitle>
                </CardHeader>
                {expanded === article.id && (
                  <CardContent className="pt-0">
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {article.content}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
        </div>
      )}

      {!error && filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          {search ? 'No articles match your search.' : 'No help articles available yet.'}
        </p>
      )}

      <div className="text-center pt-2">
        <Link href="/client/discussions" className="text-sm text-[#6B7E54] hover:underline">
          Need more help? Start a conversation
        </Link>
      </div>
    </>
  );
}
