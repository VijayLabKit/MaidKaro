import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { randomUUID } from 'crypto';

const s3 = new S3Client({
  region: env.STORAGE_REGION ?? 'ap-south-1',
  endpoint: env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? '',
  },
  forcePathStyle: true,
});

const BUCKET = env.STORAGE_BUCKET ?? 'maidkaro';

/**
 * Returns a pre-signed PUT URL the client uploads directly to (no file
 * bytes pass through our API server). `key` is what we store in the DB.
 */
export async function createUploadUrl(prefix: string, contentType: string) {
  const key = `${prefix}/${randomUUID()}`;
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: env.STORAGE_SIGNED_URL_EXPIRY_SECONDS });
  return { uploadUrl, key };
}

/** Short-lived GET URL — used when an admin reviews a KYC document, or a
 * worker/customer views their own profile photo. Never expose `key` to the
 * public directly; always resolve it through this function on demand. */
export async function createViewUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: env.STORAGE_SIGNED_URL_EXPIRY_SECONDS });
}
