'use client';

import { useEffect, useState } from 'react';
import { MediaGallery } from '@/components/media/media-gallery';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    await fetch(`/api/media/${id}`, { method: 'DELETE' });
    setMedia(prev => prev.filter(m => m.id !== id));
    setDeleteId(null);
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

  return (
    <>
      <MediaGallery items={media} onDelete={(id) => setDeleteId(id)} />
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
