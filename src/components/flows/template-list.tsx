'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Users,
  Upload,
  FileText,
  DollarSign,
  Star,
  Calendar,
  Phone,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  version: number | null;
  isPublished: boolean | null;
  usageCount: number | null;
  tags: unknown;
  updatedAt: Date | null;
}

interface TemplateListProps {
  templates: Template[];
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  estimate: FileText,
  payment: DollarSign,
  review: Star,
  referral: Users,
  appointment: Calendar,
  missed_call: Phone,
  form_response: MessageSquare,
  custom: FileText,
};

const categoryColors: Record<string, string> = {
  estimate: 'bg-blue-100 text-blue-800',
  payment: 'bg-green-100 text-green-800',
  review: 'bg-yellow-100 text-yellow-800',
  referral: 'bg-purple-100 text-purple-800',
  appointment: 'bg-orange-100 text-orange-800',
  missed_call: 'bg-red-100 text-red-800',
  form_response: 'bg-cyan-100 text-cyan-800',
  custom: 'bg-gray-100 text-gray-800',
};

export function TemplateList({ templates }: TemplateListProps) {
  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No templates yet</p>
          <Button asChild className="mt-4">
            <Link href="/admin/flow-templates/new">Create First Template</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const grouped = templates.reduce(
    (acc, template) => {
      const cat = template.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(template);
      return acc;
    },
    {} as Record<string, Template[]>
  );

  const tags = (t: Template): string[] => {
    if (Array.isArray(t.tags)) return t.tags as string[];
    return [];
  };

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([category, categoryTemplates]) => {
        const Icon = categoryIcons[category] || FileText;

        return (
          <div key={category}>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 capitalize">
              <Icon className="h-5 w-5" />
              {category.replace('_', ' ')}
            </h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description || 'No description'}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/flow-templates/${template.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/flow-templates/${template.id}/push`}>
                              <Upload className="h-4 w-4 mr-2" />
                              Push Update
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{template.version ?? 1}</Badge>
                        {template.isPublished ? (
                          <Badge className="bg-green-100 text-green-800">Published</Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{template.usageCount || 0} clients</span>
                      </div>
                    </div>

                    {tags(template).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {tags(template).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-3">
                      Updated{' '}
                      {formatDistanceToNow(template.updatedAt || new Date(), {
                        addSuffix: true,
                      })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
