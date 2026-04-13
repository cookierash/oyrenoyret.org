import { S3Client } from '@aws-sdk/client-s3';

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  endpoint: string;
};

function normalizeBaseUrl(value: string): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/g, '');
}

export function getR2Config(): R2Config | null {
  const accountId = String(process.env.R2_ACCOUNT_ID ?? '').trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID ?? '').trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY ?? '').trim();
  const bucket = String(process.env.R2_BUCKET ?? '').trim();
  const publicBaseUrl = normalizeBaseUrl(String(process.env.R2_PUBLIC_BASE_URL ?? ''));

  const endpoint =
    normalizeBaseUrl(String(process.env.R2_ENDPOINT ?? '')) ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl || !endpoint) return null;

  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl, endpoint };
}

export function createR2Client(cfg: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: true,
    // Avoid adding checksum query params/headers unless required; keeps presigned PUT simpler for browsers/R2.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}
