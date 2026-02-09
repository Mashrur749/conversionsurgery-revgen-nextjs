'use client';

import { Image as ImageIcon } from 'lucide-react';

interface MediaItem {
  id: string;
  type: string;
  publicUrl: string | null;
  thumbnailUrl: string | null;
  aiDescription: string | null;
}

interface MessageMediaProps {
  items: MediaItem[];
}

export function MessageMedia({ items }: MessageMediaProps) {
  return (
    <div className="mt-2 space-y-1">
      {items.map((m) => (
        <div key={m.id}>
          {m.type === 'image' && (m.thumbnailUrl || m.publicUrl) ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={m.thumbnailUrl || m.publicUrl || ''}
              alt={m.aiDescription || 'Photo'}
              className="rounded-lg max-w-[200px] cursor-pointer"
              onClick={() => m.publicUrl && window.open(m.publicUrl, '_blank')}
            />
          ) : (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <ImageIcon className="h-4 w-4" />
              <span className="text-sm truncate">{m.type}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
