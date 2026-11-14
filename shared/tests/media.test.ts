import { describe, expect, it } from 'vitest';
import {
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  MAX_FILES_PER_UPLOAD,
  MEDIA_TYPES,
  VIDEO_MAX_BYTES,
  VIDEO_MIME_TYPES,
} from '../src/constants/media.js';

describe('CU-29 constantes de fotos y vídeos', () => {
  it('los tipos coinciden con el CHECK de photos.media_type', () => {
    expect(MEDIA_TYPES).toEqual(['image', 'video']);
  });

  it('TECH_SPEC §13: JPEG, PNG o WebP de hasta 5 MB y MP4 de hasta 50 MB, 10 por subida', () => {
    expect(IMAGE_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(VIDEO_MIME_TYPES).toEqual(['video/mp4']);
    expect(IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(VIDEO_MAX_BYTES).toBe(50 * 1024 * 1024);
    expect(MAX_FILES_PER_UPLOAD).toBe(10);
  });
});
