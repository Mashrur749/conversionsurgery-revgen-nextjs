# Phase 18a: Photo & Media Handling

## Prerequisites
- Phase 03 (Core Automations) complete
- Twilio SMS webhooks working
- R2 or S3 bucket configured for storage

## Goal
Accept, store, and display photos/media sent by leads via MMS. AI acknowledges photos contextually.

---

## Step 1: Configure Storage (Cloudflare R2)

**ADD** to `.env.local`:

```env
# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=conversionsurgery-media
R2_PUBLIC_URL=https://media.conversionsurgery.com
```

**CREATE** R2 bucket in Cloudflare dashboard:
1. Go to R2 > Create bucket
2. Name: `conversionsurgery-media`
3. Enable public access (or use signed URLs)

---

## Step 2: Add Media Tables

**MODIFY** `src/lib/db/schema.ts`:

```typescript
// ============================================
// MEDIA ATTACHMENTS
// ============================================
export const mediaTypeEnum = pgEnum('media_type', [
  'image',
  'video',
  'audio',
  'document',
  'other',
]);

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
  
  // File info
  type: mediaTypeEnum('type').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: integer('file_size'), // bytes
  
  // Storage
  storageKey: varchar('storage_key', { length: 500 }).notNull(), // R2 key
  publicUrl: varchar('public_url', { length: 1000 }),
  thumbnailKey: varchar('thumbnail_key', { length: 500 }),
  thumbnailUrl: varchar('thumbnail_url', { length: 1000 }),
  
  // Twilio source
  twilioMediaSid: varchar('twilio_media_sid', { length: 50 }),
  twilioMediaUrl: varchar('twilio_media_url', { length: 1000 }),
  
  // AI analysis
  aiDescription: text('ai_description'),
  aiTags: jsonb('ai_tags').$type<string[]>(),
  
  // Metadata
  width: integer('width'),
  height: integer('height'),
  duration: integer('duration'), // seconds for video/audio
  
  createdAt: timestamp('created_at').defaultNow(),
});

// Index for quick lookup
export const mediaLeadIdx = index('media_lead_idx').on(media.leadId);
export const mediaClientIdx = index('media_client_idx').on(media.clientId);
```

Run migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 3: Create Storage Service

**CREATE** `src/lib/services/storage.ts`:

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

interface UploadResult {
  key: string;
  url: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
}

/**
 * Upload a file to R2
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    key,
    url: `${PUBLIC_URL}/${key}`,
  };
}

/**
 * Upload image with thumbnail generation
 */
export async function uploadImage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  // Upload original
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  // Generate and upload thumbnail
  const thumbnail = await sharp(buffer)
    .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  const thumbnailKey = key.replace(/\.[^.]+$/, '_thumb.jpg');
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbnailKey,
      Body: thumbnail,
      ContentType: 'image/jpeg',
    })
  );

  return {
    key,
    url: `${PUBLIC_URL}/${key}`,
    thumbnailKey,
    thumbnailUrl: `${PUBLIC_URL}/${thumbnailKey}`,
  };
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

/**
 * Get signed URL for private files
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch {
    return null;
  }
}
```

---

## Step 4: Create Media Service

**CREATE** `src/lib/services/media.ts`:

```typescript
import { db } from '@/lib/db';
import { media, messages } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { uploadFile, uploadImage, deleteFile, getImageDimensions } from './storage';
import { v4 as uuid } from 'uuid';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';

interface MediaInput {
  clientId: string;
  leadId: string;
  messageId?: string;
  twilioMediaSid?: string;
  twilioMediaUrl: string;
  mimeType: string;
}

/**
 * Determine media type from MIME type
 */
function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('spreadsheet')
  ) return 'document';
  return 'other';
}

/**
 * Fetch media from Twilio URL with auth
 */
async function fetchTwilioMedia(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString('base64')}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Process and store media from Twilio MMS
 */
export async function processIncomingMedia(input: MediaInput) {
  const mediaType = getMediaType(input.mimeType);
  const fileId = uuid();
  const extension = input.mimeType.split('/')[1]?.split(';')[0] || 'bin';
  const key = `${input.clientId}/${input.leadId}/${fileId}.${extension}`;
  
  // Fetch from Twilio
  const buffer = await fetchTwilioMedia(input.twilioMediaUrl);
  const fileSize = buffer.length;
  
  // Upload to R2
  let uploadResult;
  let dimensions = null;
  
  if (mediaType === 'image') {
    uploadResult = await uploadImage(buffer, key, input.mimeType);
    dimensions = await getImageDimensions(buffer);
  } else {
    uploadResult = await uploadFile(buffer, key, input.mimeType);
  }
  
  // Analyze image with AI (optional, async)
  let aiDescription = null;
  let aiTags: string[] = [];
  
  if (mediaType === 'image') {
    try {
      const analysis = await analyzeImage(uploadResult.url);
      aiDescription = analysis.description;
      aiTags = analysis.tags;
    } catch (err) {
      console.error('Image analysis failed:', err);
    }
  }
  
  // Save to database
  const [saved] = await db
    .insert(media)
    .values({
      clientId: input.clientId,
      leadId: input.leadId,
      messageId: input.messageId,
      type: mediaType,
      mimeType: input.mimeType,
      fileSize,
      storageKey: uploadResult.key,
      publicUrl: uploadResult.url,
      thumbnailKey: uploadResult.thumbnailKey,
      thumbnailUrl: uploadResult.thumbnailUrl,
      twilioMediaSid: input.twilioMediaSid,
      twilioMediaUrl: input.twilioMediaUrl,
      aiDescription,
      aiTags,
      width: dimensions?.width,
      height: dimensions?.height,
    })
    .returning();
  
  return saved;
}

/**
 * Analyze image with OpenAI Vision
 */
async function analyzeImage(
  imageUrl: string
): Promise<{ description: string; tags: string[] }> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this image from a contractor's customer. 
            
Provide:
1. A brief description (1-2 sentences) of what's shown
2. Tags for categorization (e.g., "roof damage", "leak", "before photo", "completed work")

Respond in JSON format:
{
  "description": "...",
  "tags": ["tag1", "tag2"]
}`,
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
    max_tokens: 300,
  });
  
  try {
    const content = response.choices[0].message.content || '{}';
    // Handle markdown code blocks
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return {
      description: 'Image received',
      tags: ['unanalyzed'],
    };
  }
}

/**
 * Get all media for a lead
 */
export async function getLeadMedia(leadId: string) {
  return db
    .select()
    .from(media)
    .where(eq(media.leadId, leadId))
    .orderBy(desc(media.createdAt));
}

/**
 * Get media for a client (for gallery view)
 */
export async function getClientMedia(
  clientId: string,
  options: { limit?: number; offset?: number; type?: MediaType } = {}
) {
  const { limit = 50, offset = 0, type } = options;
  
  const conditions = [eq(media.clientId, clientId)];
  if (type) {
    conditions.push(eq(media.type, type));
  }
  
  return db
    .select()
    .from(media)
    .where(and(...conditions))
    .orderBy(desc(media.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Delete media (and file from storage)
 */
export async function deleteMedia(mediaId: string) {
  const [item] = await db
    .select()
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);
  
  if (!item) return;
  
  // Delete from storage
  await deleteFile(item.storageKey);
  if (item.thumbnailKey) {
    await deleteFile(item.thumbnailKey);
  }
  
  // Delete from database
  await db.delete(media).where(eq(media.id, mediaId));
}

/**
 * Generate contextual AI acknowledgment for received photo
 */
export function generatePhotoAcknowledgment(
  aiDescription: string | null,
  aiTags: string[] | null
): string {
  const tags = aiTags || [];
  
  // Check for specific scenarios
  if (tags.includes('roof damage') || tags.includes('damage')) {
    return "Thanks for the photo! I can see the damage you're dealing with. Let me get our team to review this right away.";
  }
  
  if (tags.includes('leak') || tags.includes('water damage')) {
    return "I can see that in the photo - water damage needs quick attention. Let me connect you with our team to get this assessed ASAP.";
  }
  
  if (tags.includes('completed work') || tags.includes('finished')) {
    return "That looks great! Thanks for sharing the finished result.";
  }
  
  if (tags.includes('before photo')) {
    return "Got it! This before photo will be helpful for our assessment. We'll compare it with the finished work.";
  }
  
  // Generic acknowledgment
  if (aiDescription) {
    return `Thanks for the photo! I can see ${aiDescription.toLowerCase()}. Our team will review this shortly.`;
  }
  
  return "Thanks for the photo! I've saved it to your file and our team will take a look.";
}
```

---

## Step 5: Update Twilio Webhook for MMS

**MODIFY** `src/app/api/webhooks/twilio/incoming/route.ts`:

```typescript
import { processIncomingMedia, generatePhotoAcknowledgment } from '@/lib/services/media';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const body = formData.get('Body') as string;
  const from = formData.get('From') as string;
  const to = formData.get('To') as string;
  
  // Check for media attachments
  const numMedia = parseInt(formData.get('NumMedia') as string || '0', 10);
  const mediaItems = [];
  
  // ... existing code to find/create lead and save message ...
  
  // Process media attachments
  if (numMedia > 0) {
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string;
      const mediaContentType = formData.get(`MediaContentType${i}`) as string;
      const mediaSid = formData.get(`MediaSid${i}`) as string;
      
      if (mediaUrl && mediaContentType) {
        try {
          const savedMedia = await processIncomingMedia({
            clientId: client.id,
            leadId: lead.id,
            messageId: message.id, // from saved message
            twilioMediaSid: mediaSid,
            twilioMediaUrl: mediaUrl,
            mimeType: mediaContentType,
          });
          
          mediaItems.push(savedMedia);
        } catch (err) {
          console.error('Failed to process media:', err);
        }
      }
    }
  }
  
  // Generate AI response
  let aiResponse: string;
  
  if (mediaItems.length > 0 && !body?.trim()) {
    // Photo only, no text - acknowledge the photo
    const firstMedia = mediaItems[0];
    aiResponse = generatePhotoAcknowledgment(
      firstMedia.aiDescription,
      firstMedia.aiTags
    );
  } else if (mediaItems.length > 0 && body?.trim()) {
    // Photo with text - process normally but acknowledge photo
    const photoContext = mediaItems
      .filter(m => m.type === 'image')
      .map(m => m.aiDescription || 'a photo')
      .join(', ');
    
    // Add photo context to AI prompt
    aiResponse = await generateAIResponse({
      conversation,
      clientContext,
      additionalContext: `The customer also sent ${mediaItems.length} photo(s) showing: ${photoContext}`,
    });
  } else {
    // No media - normal flow
    aiResponse = await generateAIResponse({ conversation, clientContext });
  }
  
  // ... rest of existing code ...
}
```

---

## Step 6: Create Media API Routes

**CREATE** `src/app/api/leads/[id]/media/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeadMedia, deleteMedia } from '@/lib/services/media';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const media = await getLeadMedia(params.id);
  return NextResponse.json(media);
}
```

**CREATE** `src/app/api/media/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteMedia } from '@/lib/services/media';
import { db } from '@/lib/db';
import { media } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [item] = await db
    .select()
    .from(media)
    .where(eq(media.id, params.id))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await deleteMedia(params.id);
  return NextResponse.json({ success: true });
}
```

---

## Step 7: Media Gallery Component

**CREATE** `src/components/media/media-gallery.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Image as ImageIcon, 
  Video, 
  FileAudio, 
  FileText, 
  File,
  Download,
  Trash2,
  ZoomIn
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  mimeType: string;
  publicUrl: string;
  thumbnailUrl?: string;
  aiDescription?: string;
  aiTags?: string[];
  createdAt: string;
  width?: number;
  height?: number;
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
      {/* Grid view */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {items.map((item) => {
          const Icon = typeIcons[item.type];
          
          return (
            <Dialog key={item.id}>
              <DialogTrigger asChild>
                <button
                  className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 ring-primary transition-all"
                  onClick={() => setSelectedItem(item)}
                >
                  {item.type === 'image' && (item.thumbnailUrl || item.publicUrl) ? (
                    <Image
                      src={item.thumbnailUrl || item.publicUrl}
                      alt={item.aiDescription || 'Uploaded image'}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Icon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>
                </button>
              </DialogTrigger>
              
              <DialogContent className="max-w-3xl">
                <div className="space-y-4">
                  {/* Full image */}
                  {item.type === 'image' ? (
                    <div className="relative aspect-video">
                      <Image
                        src={item.publicUrl}
                        alt={item.aiDescription || 'Uploaded image'}
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                      <Icon className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Details */}
                  <div className="space-y-2">
                    {item.aiDescription && (
                      <p className="text-sm">{item.aiDescription}</p>
                    )}
                    
                    {item.aiTags && item.aiTags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.aiTags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      {item.width && item.height && ` • ${item.width}×${item.height}`}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" asChild>
                      <a href={item.publicUrl} download target="_blank">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
                    {onDelete && (
                      <Button
                        variant="destructive"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Step 8: Add Media to Conversation View

**MODIFY** `src/components/crm/conversation-detail.tsx`:

ADD media display in messages:

```typescript
import { MediaGallery } from '@/components/media/media-gallery';
import { ImageIcon } from 'lucide-react';

// In the message component, ADD:
{message.hasMedia && message.media && message.media.length > 0 && (
  <div className="mt-2 max-w-[200px]">
    {message.media.map((m) => (
      <div key={m.id} className="relative">
        {m.type === 'image' ? (
          <Image
            src={m.thumbnailUrl || m.publicUrl}
            alt={m.aiDescription || 'Photo'}
            width={200}
            height={150}
            className="rounded-lg object-cover cursor-pointer"
            onClick={() => window.open(m.publicUrl, '_blank')}
          />
        ) : (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <ImageIcon className="h-4 w-4" />
            <span className="text-sm truncate">{m.type}</span>
          </div>
        )}
      </div>
    ))}
  </div>
)}
```

---

## Step 9: Lead Media Tab

**CREATE** `src/components/leads/lead-media-tab.tsx`:

```typescript
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
      .then(res => res.json())
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
```

---

## Step 10: Install Dependencies

```bash
npm install sharp @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add media table |
| `src/lib/services/storage.ts` | Created |
| `src/lib/services/media.ts` | Created |
| `src/app/api/webhooks/twilio/incoming/route.ts` | Modified - Handle MMS |
| `src/app/api/leads/[id]/media/route.ts` | Created |
| `src/app/api/media/[id]/route.ts` | Created |
| `src/components/media/media-gallery.tsx` | Created |
| `src/components/crm/conversation-detail.tsx` | Modified |
| `src/components/leads/lead-media-tab.tsx` | Created |

---

## Verification

```bash
# 1. Run migration
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Test with MMS
# Send an image via SMS to your Twilio number
# Check that:
# - Media saved to R2
# - Thumbnail generated
# - AI analysis stored
# - Photo appears in conversation

# 3. Verify media API
curl http://localhost:3000/api/leads/[LEAD_ID]/media

# 4. Check gallery UI
# Lead detail page should show photos tab
```

## Success Criteria
- [ ] MMS photos download from Twilio
- [ ] Photos upload to R2 with thumbnails
- [ ] AI analyzes and tags images
- [ ] Contextual acknowledgment sent to lead
- [ ] Photos visible in conversation view
- [ ] Gallery view works with zoom/download
