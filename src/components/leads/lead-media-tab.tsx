'use client';

import { useEffect, useState } from 'react';
import { MediaGallery } from '@/components/media/media-gallery';
import { Skeleton } from '@/components/ui/skeleton';

interface LeadMediaTabProps {
  leadId: string;
}

export function LeadMediaTab({ leadId }: LeadMediaTabProps) {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/media`)
      .then(res => res.json() as Promise<any[]>)
      .then(data => {
        setMedia(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [leadId]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this file?')) return;

    await fetch(`/api/media/${id}`, { method: 'DELETE' });
    setMedia(prev => prev.filter(m => m.id !== id));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  return <MediaGallery items={media} onDelete={handleDelete} />;
}
