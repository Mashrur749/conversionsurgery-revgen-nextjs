import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

/** Create a new S3-compatible client configured for Cloudflare R2 */
function getS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

/** Get the configured R2 bucket name */
function getBucket(): string {
  return process.env.R2_BUCKET_NAME!;
}

/** Get the public-facing base URL for R2 assets */
function getPublicUrl(): string {
  return process.env.R2_PUBLIC_URL!;
}

/** Result of uploading a file to R2 storage */
interface UploadResult {
  key: string;
  url: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
}

/**
 * Upload a file to Cloudflare R2 storage.
 *
 * @param buffer - The file contents as a Buffer
 * @param key - The storage key (path) for the file
 * @param contentType - MIME type of the file
 * @returns Upload result containing the storage key and public URL
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    key,
    url: `${getPublicUrl()}/${key}`,
  };
}

/**
 * Upload an image to R2 with automatic thumbnail generation.
 * The thumbnail is resized to fit within 300x300 pixels and saved as JPEG.
 *
 * @param buffer - The original image contents as a Buffer
 * @param key - The storage key (path) for the original image
 * @param contentType - MIME type of the image
 * @returns Upload result containing keys and URLs for both original and thumbnail
 */
export async function uploadImage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  const client = getS3Client();
  const bucket = getBucket();
  const publicUrl = getPublicUrl();

  // Upload original
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
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

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: thumbnailKey,
      Body: thumbnail,
      ContentType: 'image/jpeg',
    })
  );

  return {
    key,
    url: `${publicUrl}/${key}`,
    thumbnailKey,
    thumbnailUrl: `${publicUrl}/${thumbnailKey}`,
  };
}

/**
 * Delete a file from R2 storage.
 *
 * @param key - The storage key of the file to delete
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

/**
 * Extract width and height dimensions from an image buffer using sharp.
 *
 * @param buffer - The image contents as a Buffer
 * @returns Object with width and height, or null if metadata extraction fails
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
  } catch (err) {
    console.error('[Storage] Failed to read image dimensions:', err);
    return null;
  }
}
