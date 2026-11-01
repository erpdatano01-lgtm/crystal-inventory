import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const bucketName = process.env.R2_BUCKET_NAME || 'crystal-assets';
const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';
const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

export const isR2Configured = Boolean(
  (accountId || endpoint) &&
  accessKeyId &&
  secretAccessKey &&
  accountId !== 'your_cloudflare_account_id' &&
  accessKeyId !== 'your_r2_access_key'
);

export const r2Client = isR2Configured
  ? new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    })
  : null;

/**
 * Upload buffer to Cloudflare R2 with structured folder:
 * - receipts: receipts/2026-11/filename.webp
 * - products: products/SKU/filename.webp (or products/2026-11/filename.webp)
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  folder: 'receipts' | 'products' = 'products',
  sku?: string,
  contentType: string = 'image/webp'
): Promise<string> {
  if (!r2Client) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const today = new Date().toISOString().slice(0, 7); // e.g. "2026-11"
  let key: string;

  if (folder === 'receipts') {
    key = `receipts/${today}/${fileName}`;
  } else {
    const subFolder = sku ? sku.replace(/[^a-zA-Z0-9_-]/g, '_') : today;
    key = `products/${subFolder}/${fileName}`;
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
  return `${baseUrl}/${key}`;
}

/**
 * Generate a Presigned URL for client-side direct upload to R2
 */
export async function getR2PresignedUploadUrl(
  fileName: string,
  folder: 'receipts' | 'products' = 'products',
  sku?: string,
  contentType: string = 'image/webp',
  expiresIn = 3600
): Promise<{ uploadUrl: string; publicFileUrl: string; key: string }> {
  if (!r2Client) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const today = new Date().toISOString().slice(0, 7);
  let key: string;

  if (folder === 'receipts') {
    key = `receipts/${today}/${fileName}`;
  } else {
    const subFolder = sku ? sku.replace(/[^a-zA-Z0-9_-]/g, '_') : today;
    key = `products/${subFolder}/${fileName}`;
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
  const publicFileUrl = `${baseUrl}/${key}`;

  return { uploadUrl, publicFileUrl, key };
}
