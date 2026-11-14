import {
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  VIDEO_MAX_BYTES,
  VIDEO_MIME_TYPES,
  type MediaType,
  type RejectedFileDto,
  type Visibility,
} from '@sanctuary/shared';

// CU-29 Gestionar fotos y vídeos: reglas sin dependencias externas.

export type CodigoRechazo = RejectedFileDto['code'];

/** CU-29 2a: mensaje claro de cada rechazo. */
export const MENSAJES_RECHAZO: Record<CodigoRechazo, string> = {
  UNSUPPORTED_FORMAT: 'Formato no permitido: solo JPEG, PNG, WebP o MP4.',
  IMAGE_TOO_LARGE: 'La imagen supera los 5 MB.',
  VIDEO_TOO_LARGE: 'El vídeo supera los 50 MB.',
  INVALID_FILE: 'El archivo está dañado o no corresponde a su formato.',
};

const esUno = (lista: readonly string[], valor: string) => lista.includes(valor);

/** Paso 2 y 2a: formato y tamaño permitidos según el tipo declarado del archivo. */
export function clasificarArchivo(archivo: {
  mimeType: string;
  size: number;
}): { mediaType: MediaType } | { rechazo: CodigoRechazo } {
  if (esUno(IMAGE_MIME_TYPES, archivo.mimeType)) {
    return archivo.size > IMAGE_MAX_BYTES ? { rechazo: 'IMAGE_TOO_LARGE' } : { mediaType: 'image' };
  }
  if (esUno(VIDEO_MIME_TYPES, archivo.mimeType)) {
    return archivo.size > VIDEO_MAX_BYTES ? { rechazo: 'VIDEO_TOO_LARGE' } : { mediaType: 'video' };
  }
  return { rechazo: 'UNSUPPORTED_FORMAT' };
}

export interface FotoParaPortada {
  animalId: number;
  updateId: number | null;
  mediaType: MediaType;
  visibility: Visibility;
}

/** 5a: la portada es una imagen pública de la galería (no de una actualización) del mismo animal. */
export function puedeSerPortada(foto: FotoParaPortada, animalId: number): boolean {
  return (
    foto.animalId === animalId && foto.updateId === null && foto.mediaType === 'image' && foto.visibility === 'public'
  );
}

/** A1: la portada no puede pasar a «solo adoptantes». */
export function puedeCambiarVisibilidad(esPortada: boolean, nueva: Visibility): boolean {
  return !esPortada || nueva === 'public';
}

/** Paso 5: el nuevo orden contiene exactamente las fotos de la galería, una vez cada una. */
export function ordenValido(galeria: readonly number[], propuesto: readonly number[]): boolean {
  if (propuesto.length !== galeria.length || new Set(propuesto).size !== propuesto.length) return false;
  const actuales = new Set(galeria);
  return propuesto.every((id) => actuales.has(id));
}

/** Archivo recibido en una subida, ya en memoria. */
export interface ArchivoSubido {
  nombre: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}
