import { getDb, mediaAttachments } from '@/db';
import type { MediaAttachment } from '@/db/schema/media-attachments';
import { eq, desc, and } from 'drizzle-orm';
import { uploadFile, uploadImage, deleteFile, getImageDimensions } from './storage';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';

/** Supported media type categories */
type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';

/** Input for processing an incoming media attachment from Twilio MMS */
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
 * Fetch media from a Twilio-hosted URL using Basic auth credentials.
 * @param url - The Twilio media URL to fetch
 * @returns The file contents as a Buffer
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
    throw new Error(`[Media] Failed to fetch Twilio media: HTTP ${response.status} for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Process and store a media attachment received via Twilio MMS.
 * Downloads the file from Twilio, uploads it to R2 storage (with thumbnail
 * generation for images), runs AI analysis on images, and persists the
 * record in the database.
 *
 * @param input - Media metadata including client/lead IDs and Twilio source info
 * @returns The saved MediaAttachment database record
 */
export async function processIncomingMedia(input: MediaInput): Promise<MediaAttachment> {
  const db = getDb();
  const mediaType = getMediaType(input.mimeType);
  const fileId = randomUUID();
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

  // Analyze image with AI (async, don't block)
  let aiDescription: string | null = null;
  let aiTags: string[] = [];

  if (mediaType === 'image') {
    try {
      const analysis = await analyzeImage(uploadResult.url);
      aiDescription = analysis.description;
      aiTags = analysis.tags;
    } catch (err) {
      console.error('[Media] Image analysis failed:', err);
    }
  }

  // Save to database
  const [saved] = await db
    .insert(mediaAttachments)
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
 * Analyze an image using OpenAI Vision to generate a description and tags.
 * Used for contextual acknowledgment messages and media categorization.
 *
 * @param imageUrl - Public URL of the image to analyze
 * @returns Object containing a description string and an array of tags
 */
async function analyzeImage(
  imageUrl: string
): Promise<{ description: string; tags: string[] }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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
  } catch (err) {
    console.error('[Media] Failed to parse AI image analysis response:', err);
    return {
      description: 'Image received',
      tags: ['unanalyzed'],
    };
  }
}

/**
 * Retrieve all media attachments for a given lead, ordered by most recent first.
 *
 * @param leadId - UUID of the lead
 * @returns Array of MediaAttachment records
 */
export async function getLeadMedia(leadId: string): Promise<MediaAttachment[]> {
  const db = getDb();
  return db
    .select()
    .from(mediaAttachments)
    .where(eq(mediaAttachments.leadId, leadId))
    .orderBy(desc(mediaAttachments.createdAt));
}

/**
 * Retrieve media attachments for a client, with optional pagination and type filtering.
 * Used for the gallery view in the admin dashboard.
 *
 * @param clientId - UUID of the client
 * @param options - Optional pagination (limit, offset) and type filter
 * @returns Array of MediaAttachment records
 */
export async function getClientMedia(
  clientId: string,
  options: { limit?: number; offset?: number; type?: MediaType } = {}
): Promise<MediaAttachment[]> {
  const db = getDb();
  const { limit = 50, offset = 0, type } = options;

  const conditions = [eq(mediaAttachments.clientId, clientId)];
  if (type) {
    conditions.push(eq(mediaAttachments.type, type));
  }

  return db
    .select()
    .from(mediaAttachments)
    .where(and(...conditions))
    .orderBy(desc(mediaAttachments.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Retrieve media attachments associated with a specific conversation message.
 *
 * @param messageId - UUID of the conversation message
 * @returns Array of MediaAttachment records
 */
export async function getMessageMedia(messageId: string): Promise<MediaAttachment[]> {
  const db = getDb();
  return db
    .select()
    .from(mediaAttachments)
    .where(eq(mediaAttachments.messageId, messageId))
    .orderBy(desc(mediaAttachments.createdAt));
}

/**
 * Delete a media attachment from both R2 storage (including thumbnail) and the database.
 *
 * @param mediaId - UUID of the media attachment to delete
 */
export async function deleteMedia(mediaId: string): Promise<void> {
  const db = getDb();

  const [item] = await db
    .select()
    .from(mediaAttachments)
    .where(eq(mediaAttachments.id, mediaId))
    .limit(1);

  if (!item) return;

  // Delete from storage
  await deleteFile(item.storageKey);
  if (item.thumbnailKey) {
    await deleteFile(item.thumbnailKey);
  }

  // Delete from database
  await db.delete(mediaAttachments).where(eq(mediaAttachments.id, mediaId));
}

/**
 * Generate a contextual acknowledgment message for a photo received from a lead.
 * Uses AI-generated tags and description to craft a relevant response.
 *
 * @param aiDescription - AI-generated description of the image, or null
 * @param aiTags - AI-generated tags for categorization, or null
 * @returns A human-friendly acknowledgment string
 */
export function generatePhotoAcknowledgment(
  aiDescription: string | null,
  aiTags: string[] | null
): string {
  const tags = aiTags || [];

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

  if (aiDescription) {
    return `Thanks for the photo! I can see ${aiDescription.toLowerCase()}. Our team will review this shortly.`;
  }

  return "Thanks for the photo! I've saved it to your file and our team will take a look.";
}
