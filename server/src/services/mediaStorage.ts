import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists safely
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
  mediaType?: 'image' | 'video';
  extension?: string;
}

export interface SavedMediaInfo {
  storageKey: string;
  mediaType: 'image' | 'video';
  mimeType: string;
  sizeBytes: number;
}

/**
 * Validates actual binary magic bytes.
 * Never trusts filename extension or client-supplied MIME alone.
 */
export function validateMediaBuffer(buffer: Buffer, declaredMime?: string): MediaValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File buffer is empty.' };
  }

  // 1. Enforce size limits: 10MB for images, 50MB for videos
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

  if (buffer.length > MAX_VIDEO_SIZE) {
    return { valid: false, error: 'File exceeds absolute maximum upload limit of 50MB.' };
  }

  // 2. Reject executable / script / HTML / SVG content
  const headerText = buffer.slice(0, 1024).toString('utf8', 0, Math.min(buffer.length, 1024)).toLowerCase();
  if (
    headerText.includes('<?php') ||
    headerText.includes('<script') ||
    headerText.includes('<svg') ||
    headerText.includes('<!doctype html') ||
    headerText.includes('<html') ||
    headerText.includes('#!/bin/')
  ) {
    return { valid: false, error: 'Executable, script, or unsafe markup content is strictly forbidden.' };
  }

  // Windows PE executable check (MZ header)
  if (buffer.length > 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { valid: false, error: 'Executable binary files are strictly forbidden.' };
  }

  // Linux ELF executable check
  if (buffer.length > 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { valid: false, error: 'Executable binary files are strictly forbidden.' };
  }

  // 3. Inspect magic bytes for allowed image/video formats

  // JPEG: FF D8 FF
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (buffer.length > MAX_IMAGE_SIZE) {
      return { valid: false, error: 'Image exceeds 10MB maximum limit.' };
    }
    return { valid: true, detectedMime: 'image/jpeg', mediaType: 'image', extension: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (buffer.length > MAX_IMAGE_SIZE) {
      return { valid: false, error: 'Image exceeds 10MB maximum limit.' };
    }
    return { valid: true, detectedMime: 'image/png', mediaType: 'image', extension: 'png' };
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (
    buffer.length > 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    if (buffer.length > MAX_IMAGE_SIZE) {
      return { valid: false, error: 'Image exceeds 10MB maximum limit.' };
    }
    return { valid: true, detectedMime: 'image/gif', mediaType: 'image', extension: 'gif' };
  }

  // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer.length > 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    if (buffer.length > MAX_IMAGE_SIZE) {
      return { valid: false, error: 'Image exceeds 10MB maximum limit.' };
    }
    return { valid: true, detectedMime: 'image/webp', mediaType: 'image', extension: 'webp' };
  }

  // MP4 / QuickTime / MOV: 'ftyp' marker at bytes 4-7 (0x66 0x74 0x79 0x70)
  if (
    buffer.length > 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return { valid: true, detectedMime: 'video/mp4', mediaType: 'video', extension: 'mp4' };
  }

  // WebM: 1A 45 DF A3 (EBML ID)
  if (
    buffer.length > 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { valid: true, detectedMime: 'video/webm', mediaType: 'video', extension: 'webm' };
  }

  return {
    valid: false,
    error: `Unsupported file format or invalid media signature. Expected JPEG, PNG, WEBP, GIF, or MP4.`,
  };
}

/**
 * Validates a storageKey strictly to prevent path traversal
 */
export function isSafeStorageKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  // Strictly alphanumeric, dashes, underscores, and exactly one standard file extension
  return /^[a-zA-Z0-9_-]+\.[a-z0-9]{2,6}$/.test(key);
}

export interface IMediaStorageProvider {
  save(buffer: Buffer, originalFilename: string): Promise<SavedMediaInfo>;
  delete(storageKey: string): Promise<boolean>;
  getFilePath(storageKey: string): string | null;
}

export class LocalStorageProvider implements IMediaStorageProvider {
  async save(buffer: Buffer, originalFilename: string): Promise<SavedMediaInfo> {
    const validation = validateMediaBuffer(buffer);
    if (!validation.valid || !validation.detectedMime || !validation.extension || !validation.mediaType) {
      throw new Error(validation.error || 'Invalid media format.');
    }

    const randomId = crypto.randomUUID();
    const storageKey = `${randomId}.${validation.extension}`;
    const destinationPath = path.join(UPLOADS_DIR, storageKey);

    await fs.promises.writeFile(destinationPath, buffer);

    return {
      storageKey,
      mediaType: validation.mediaType,
      mimeType: validation.detectedMime,
      sizeBytes: buffer.length,
    };
  }

  async delete(storageKey: string): Promise<boolean> {
    if (!isSafeStorageKey(storageKey)) return false;
    const targetPath = path.join(UPLOADS_DIR, storageKey);
    try {
      if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  getFilePath(storageKey: string): string | null {
    if (!isSafeStorageKey(storageKey)) return null;
    const targetPath = path.join(UPLOADS_DIR, storageKey);
    if (fs.existsSync(targetPath)) {
      return targetPath;
    }
    return null;
  }
}

// Authoritative storage instance (defaults to local storage in development)
export const mediaStorage = new LocalStorageProvider();

/**
 * Orphan Media Cleanup Strategy:
 * Queries all unattached media assets older than maxAgeHours,
 * unlinks the physical file from disk/object store, and removes the DB record.
 */
export async function cleanupOrphanMedia(maxAgeHours: number = 24): Promise<number> {
  const { MediaAsset } = await import('../models/MediaAsset.js');
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const orphans = await MediaAsset.find({ isAttached: false, createdAt: { $lt: cutoff } });

  let cleaned = 0;
  for (const orphan of orphans) {
    await mediaStorage.delete(orphan.storageKey);
    await orphan.deleteOne();
    cleaned++;
  }
  return cleaned;
}
