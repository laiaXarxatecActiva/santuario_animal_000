import { describe, expect, it } from 'vitest';
import {
  clasificarArchivo,
  MENSAJES_RECHAZO,
  ordenValido,
  puedeCambiarVisibilidad,
  puedeSerPortada,
} from '../src/dominio/fotos.js';

const MB = 1024 * 1024;

describe('CU-29 reglas de las fotos y vídeos', () => {
  it('2: acepta JPEG, PNG y WebP de hasta 5 MB y MP4 de hasta 50 MB', () => {
    expect(clasificarArchivo({ mimeType: 'image/jpeg', size: 5 * MB })).toEqual({ mediaType: 'image' });
    expect(clasificarArchivo({ mimeType: 'image/png', size: 10 })).toEqual({ mediaType: 'image' });
    expect(clasificarArchivo({ mimeType: 'image/webp', size: 10 })).toEqual({ mediaType: 'image' });
    expect(clasificarArchivo({ mimeType: 'video/mp4', size: 50 * MB })).toEqual({ mediaType: 'video' });
  });

  it('2a: rechaza otros formatos y los archivos demasiado grandes', () => {
    expect(clasificarArchivo({ mimeType: 'image/gif', size: 10 })).toEqual({ rechazo: 'UNSUPPORTED_FORMAT' });
    expect(clasificarArchivo({ mimeType: 'video/quicktime', size: 10 })).toEqual({ rechazo: 'UNSUPPORTED_FORMAT' });
    expect(clasificarArchivo({ mimeType: 'image/jpeg', size: 5 * MB + 1 })).toEqual({ rechazo: 'IMAGE_TOO_LARGE' });
    expect(clasificarArchivo({ mimeType: 'video/mp4', size: 50 * MB + 1 })).toEqual({ rechazo: 'VIDEO_TOO_LARGE' });
  });

  it('2a: cada rechazo tiene un mensaje claro', () => {
    expect(MENSAJES_RECHAZO).toEqual({
      UNSUPPORTED_FORMAT: 'Formato no permitido: solo JPEG, PNG, WebP o MP4.',
      IMAGE_TOO_LARGE: 'La imagen supera los 5 MB.',
      VIDEO_TOO_LARGE: 'El vídeo supera los 50 MB.',
      INVALID_FILE: 'El archivo está dañado o no corresponde a su formato.',
    });
  });

  it('5a: la portada es una imagen pública de la galería del mismo animal', () => {
    const foto = { animalId: 1, updateId: null, mediaType: 'image', visibility: 'public' } as const;
    expect(puedeSerPortada(foto, 1)).toBe(true);
    expect(puedeSerPortada(foto, 2)).toBe(false);
    expect(puedeSerPortada({ ...foto, mediaType: 'video' }, 1)).toBe(false);
    expect(puedeSerPortada({ ...foto, visibility: 'adopters' }, 1)).toBe(false);
    expect(puedeSerPortada({ ...foto, updateId: 3 }, 1)).toBe(false);
  });

  it('A1: la portada no puede pasar a «solo adoptantes»', () => {
    expect(puedeCambiarVisibilidad(true, 'adopters')).toBe(false);
    expect(puedeCambiarVisibilidad(true, 'public')).toBe(true);
    expect(puedeCambiarVisibilidad(false, 'adopters')).toBe(true);
  });

  it('5: el nuevo orden contiene exactamente las fotos de la galería, una vez cada una', () => {
    expect(ordenValido([1, 16, 17], [17, 1, 16])).toBe(true);
    expect(ordenValido([1, 16, 17], [17, 1])).toBe(false);
    expect(ordenValido([1, 16, 17], [17, 1, 16, 19])).toBe(false);
    expect(ordenValido([1, 16, 17], [17, 1, 1])).toBe(false);
    expect(ordenValido([1, 16, 17], [17, 1, 16, 16])).toBe(false);
  });
});
