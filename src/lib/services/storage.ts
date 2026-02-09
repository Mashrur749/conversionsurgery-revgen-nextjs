import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

function getS3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function getBucket() {
  return process.env.R2_BUCKET_NAME!;
}

function getPublicUrl() {
  return process.env.R2_PUBLIC_URL!;
}

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
 * Upload image with thumbnail generation
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
 * Delete a file from R2
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
 * Get signed URL for private files
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
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
