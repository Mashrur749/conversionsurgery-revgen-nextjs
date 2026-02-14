'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string | null;
}

export default function ClientHelpPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/client/help-articles')
      .then((r) => r.json())
      .then((data) => setArticles(data as Article[]))
      .catch(() => {});
  }, []);

  const filtered = search
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.content.toLowerCase().includes(search.toLowerCase())
      )
    : articles;

  const categories = [...new Set(filtered.map((a) => a.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Help Center</h1>
        <p className="text-muted-foreground">Find answers to common questions.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {categories.map((cat) => (
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

      {filtered.filter((a) => !a.category).length > 0 && (
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

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          {search ? 'No articles match your search.' : 'No help articles available yet.'}
        </p>
      )}
    </div>
  );
}
