import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AVATAR_BUCKET = process.env.AVATAR_BUCKET || 'avatars';

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Upload a base64 image data URL to Supabase Storage and return its public URL.
 * Avatars used to be stored as base64 directly on the User row (~200KB returned
 * on every /auth/me); this keeps only a small URL in the DB. Uses the Storage
 * REST API over HTTPS (no extra dependency); the service-role key is server-only.
 */
export async function uploadAvatarToStorage(
  dataUrl: string,
  userId: string,
): Promise<string> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new InternalServerErrorException(
      'Avatar storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).',
    );
  }

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new BadRequestException('Invalid image data URL');
  const contentType = match[1];
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) throw new BadRequestException('Unsupported image type');
  const buffer = Buffer.from(match[2], 'base64');

  // Deterministic path per user + upsert, so a new avatar overwrites the old one
  // (no orphaned files to clean up).
  const path = `${userId}.${ext}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${path}`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': '3600',
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new InternalServerErrorException(
      `Avatar upload failed (${res.status}): ${detail}`,
    );
  }

  // Public URL (bucket must be public-read). Cache-bust with a version param so
  // the browser fetches the new image after an upsert to the same path.
  return `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}?v=${Date.now()}`;
}
