import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, normalize, resolve, sep } from 'node:path';
import type { StorageService } from './storage.service.js';

const PREFIJO_URL = '/uploads/';

/** Ruta relativa segura: sin `..` ni rutas absolutas. */
function rutaSegura(ruta: string): string | null {
  if (ruta === '' || isAbsolute(ruta) || ruta.includes('\\')) return null;
  const normalizada = normalize(ruta);
  if (normalizada === '..' || normalizada.startsWith(`..${sep}`) || normalizada.split(sep).includes('..')) return null;
  return normalizada.split(sep).join('/');
}

/**
 * Guarda los archivos en `baseDir` (en la app, `server/uploads/`), que Express
 * sirve en `/uploads`.
 */
export function createLocalStorage(baseDir: string): StorageService {
  const raiz = resolve(baseDir);

  function absoluta(ruta: string): string {
    const segura = rutaSegura(ruta);
    const destino = segura === null ? null : resolve(raiz, segura);
    if (destino === null || !destino.startsWith(raiz + sep)) {
      throw new RangeError(`Ruta de almacenamiento no válida: ${ruta}`);
    }
    return destino;
  }

  return {
    async save(file, path) {
      const destino = absoluta(path);
      await mkdir(dirname(destino), { recursive: true });
      await writeFile(destino, file);
      return PREFIJO_URL + rutaSegura(path);
    },

    async delete(path) {
      try {
        await unlink(absoluta(path));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    },

    pathFromUrl(url) {
      if (!url.startsWith(PREFIJO_URL)) return null;
      return rutaSegura(url.slice(PREFIJO_URL.length));
    },
  };
}
