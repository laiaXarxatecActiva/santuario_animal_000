// Fotos y vídeos (CU-29, TECH_SPEC §13). MEDIA_TYPES debe coincidir con el
// CHECK de photos.media_type en seedsql.sql.
export const MEDIA_TYPES = ['image', 'video'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_MIME_TYPES = ['video/mp4'] as const;

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

/** Longitud máxima de photos.alt_text. */
export const ALT_TEXT_MAX_LENGTH = 300;
