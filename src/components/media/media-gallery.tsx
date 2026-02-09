'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Image as ImageIcon,
  Video,
  FileAudio,
  FileText,
  File,
  Download,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

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

interface MediaGalleryProps {
  items: MediaItem[];
  onDelete?: (id: string) => void;
}

const typeIcons = {
  image: ImageIcon,
  video: Video,
  audio: FileAudio,
  document: FileText,
  other: File,
};

export function MediaGallery({ items, onDelete }: MediaGalleryProps) {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No photos or files yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {items.map((item) => {
          const Icon = typeIcons[item.type];

          return (
            <button
              key={item.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 ring-primary transition-all"
              onClick={() => setSelectedItem(item)}
            >
              {item.type === 'image' && (item.thumbnailUrl || item.publicUrl) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.thumbnailUrl || item.publicUrl || ''}
                  alt={item.aiDescription || 'Uploaded image'}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}

              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white" />
              </div>
            </button>
          );
        })}
      </div>

      <Dialog
        open={!!selectedItem}
        onOpenChange={(open) => { if (!open) setSelectedItem(null); }}
      >
        <DialogContent className="max-w-3xl">
          {selectedItem && (
            <div className="space-y-4 p-6">
              {selectedItem.type === 'image' && selectedItem.publicUrl ? (
                <div className="relative aspect-video flex items-center justify-center bg-black rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedItem.publicUrl}
                    alt={selectedItem.aiDescription || 'Uploaded image'}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  {(() => {
                    const Icon = typeIcons[selectedItem.type];
                    return <Icon className="h-16 w-16 text-muted-foreground" />;
                  })()}
                </div>
              )}

              <div className="space-y-2">
                {selectedItem.aiDescription && (
                  <p className="text-sm">{selectedItem.aiDescription}</p>
                )}

                {selectedItem.aiTags && selectedItem.aiTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.aiTags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {selectedItem.createdAt &&
                    formatDistanceToNow(new Date(selectedItem.createdAt), { addSuffix: true })}
                  {selectedItem.width && selectedItem.height &&
                    ` · ${selectedItem.width}×${selectedItem.height}`}
                </p>
              </div>

              <div className="flex gap-2">
                {selectedItem.publicUrl && (
                  <Button variant="outline" asChild>
                    <a href={selectedItem.publicUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onDelete(selectedItem.id);
                      setSelectedItem(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
