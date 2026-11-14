import { randomUUID } from 'node:crypto';
import type { MediaType, RejectedFileDto } from '@sanctuary/shared';
import { clasificarArchivo, MENSAJES_RECHAZO, type ArchivoSubido, type CodigoRechazo } from '../dominio/fotos.js';
import { esMp4, procesarImagen } from '../services/storage/image-processing.js';
import type { StorageService } from '../services/storage/storage.service.js';

/** Archivo ya guardado; `indice` es su posición en la subida. */
export interface MedioGuardado {
  indice: number;
  mediaType: MediaType;
  url: string;
  thumbnailUrl: string | null;
}

export interface ResultadoGuardado {
  guardados: MedioGuardado[];
  rechazados: RejectedFileDto[];
  /** Posición en la subida de cada rechazado. */
  indicesRechazados: number[];
}

export type MediaUploader = ReturnType<typeof createMediaUploader>;

const rechazo = (archivo: ArchivoSubido, code: CodigoRechazo): RejectedFileDto => ({
  fileName: archivo.nombre,
  code,
  message: MENSAJES_RECHAZO[code],
});

/**
 * Guarda los archivos de una subida (CU-29 paso 4 y CU-31 paso 3) en
 * `animals/<animalId>/`, con nombre aleatorio (UUID; TECH_SPEC §11.3). Las
 * imágenes se redimensionan y llevan miniatura; los vídeos se guardan tal cual.
 * Los archivos no válidos se rechazan uno a uno (CU-29 2a).
 */
export function createMediaUploader(storage: StorageService, logError: (error: unknown) => void = () => {}) {
  async function guardarUno(animalId: number, archivo: ArchivoSubido, indice: number) {
    const tipo = clasificarArchivo(archivo);
    if ('rechazo' in tipo) return rechazo(archivo, tipo.rechazo);
    const base = `animals/${animalId}/${randomUUID()}`;
    if (tipo.mediaType === 'video') {
      if (!esMp4(archivo.buffer)) return rechazo(archivo, 'INVALID_FILE');
      const url = await storage.save(archivo.buffer, `${base}.mp4`, 'video/mp4');
      return { indice, mediaType: 'video', url, thumbnailUrl: null } satisfies MedioGuardado;
    }
    const procesada = await procesarImagen(archivo.buffer);
    if (!procesada) return rechazo(archivo, 'INVALID_FILE');
    const url = await storage.save(procesada.imagen, `${base}.webp`, 'image/webp');
    const thumbnailUrl = await storage.save(procesada.miniatura, `${base}_thumb.webp`, 'image/webp');
    return { indice, mediaType: 'image', url, thumbnailUrl } satisfies MedioGuardado;
  }

  /** Borra los archivos de estas URLs. Un fallo solo se registra: el registro ya no existe. */
  async function borrar(urls: readonly string[]): Promise<void> {
    const resultados = await Promise.allSettled(
      urls.map((url) => {
        const ruta = storage.pathFromUrl(url);
        return ruta === null ? Promise.resolve() : storage.delete(ruta);
      }),
    );
    for (const r of resultados) if (r.status === 'rejected') logError(r.reason);
  }

  return {
    /** Uno a uno, para no procesar a la vez varias imágenes grandes en memoria. */
    async guardar(animalId: number, archivos: readonly ArchivoSubido[]): Promise<ResultadoGuardado> {
      const guardados: MedioGuardado[] = [];
      const rechazados: RejectedFileDto[] = [];
      const indicesRechazados: number[] = [];
      try {
        for (const [indice, archivo] of archivos.entries()) {
          const resultado = await guardarUno(animalId, archivo, indice);
          if ('code' in resultado) {
            rechazados.push(resultado);
            indicesRechazados.push(indice);
          } else {
            guardados.push(resultado);
          }
        }
      } catch (error) {
        await borrar(urlsDe(guardados));
        throw error;
      }
      return { guardados, rechazados, indicesRechazados };
    },
    borrar,
  };
}

/** URLs de los archivos (y miniaturas) guardados. */
export function urlsDe(guardados: readonly MedioGuardado[]): string[] {
  return guardados.flatMap((g) => (g.thumbnailUrl ? [g.url, g.thumbnailUrl] : [g.url]));
}
