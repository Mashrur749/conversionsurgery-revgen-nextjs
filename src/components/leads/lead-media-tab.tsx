'use client';

import { useEffect, useState } from 'react';
import { MediaGallery } from '@/components/media/media-gallery';
import { Skeleton } from '@/components/ui/skeleton';

/** Shape of a media item as returned by the leads media API */
interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  mimeType: string | null;
  publicUrl: string | null;
  thumbnailUrl: string | null;
  aiDescription: string | null;
  aiTags: string[] | null;
  createdAt: string | null;
  width: number | null;
  height: number | null;
}

interface LeadMediaTabProps {
  leadId: string;
}

export function LeadMediaTab({ leadId }: LeadMediaTabProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/media`)
      .then(res => res.json() as Promise<MediaItem[]>)
      .then(data => {
        setMedia(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[LeadMediaTab] Failed to fetch media:', err);
        setLoading(false);
      });
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
