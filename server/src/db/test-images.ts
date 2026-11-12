import { access, copyFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import pg from 'pg';

// Prefijo de las imágenes de ejemplo de cada especie de TEST_DATA.sql (por
// nombre científico): `<prefijo>_1.jpg` … `_3.jpg` y, de respaldo, `_test.jpg`.
const PREFIJO_POR_ESPECIE: Record<string, string> = {
  'Gyps fulvus': 'buitre_leonado',
  'Aegypius monachus': 'buitre_negro',
  'Neophron percnopterus': 'buitre_alimoche_comun',
  'Gypaetus barbatus': 'buitre_quebrantahuesos',
};
const IMAGENES_POR_ESPECIE = 3;
const IMAGEN_POR_DEFECTO = 'vulture_placeholder.jpg';
const EXTENSIONES_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const PREFIJO_URL = '/uploads/';

interface FotoRow {
  animal_id: number;
  posicion: number;
  url: string;
  thumbnail_url: string | null;
  scientific_name: string | null;
}

const existe = (ruta: string) =>
  access(ruta).then(
    () => true,
    () => false,
  );

/** Candidatas por orden de preferencia para la foto `posicion` (0, 1…) de un animal. */
function candidatas(foto: FotoRow): string[] {
  const prefijo = PREFIJO_POR_ESPECIE[foto.scientific_name ?? ''];
  if (!prefijo) return [IMAGEN_POR_DEFECTO];
  // Rota entre las imágenes de la especie para que los animales vecinos del
  // catálogo no tengan la misma foto.
  const n = ((foto.animal_id - 1 + foto.posicion) % IMAGENES_POR_ESPECIE) + 1;
  return [`${prefijo}_${n}.jpg`, `${prefijo}_test.jpg`, IMAGEN_POR_DEFECTO];
}

/**
 * Los datos de prueba apuntan a fotos en `/uploads/...` que no existen. Copia
 * en cada ruta una imagen de ejemplo de la especie del animal, tomada de
 * `imagesDir` (no está en git: ver `ignore/test-images/`). Si no hay ninguna
 * imagen disponible, la foto se omite. Los vídeos no se crean (solo su
 * miniatura). Devuelve cuántos archivos ha copiado.
 */
export async function copyTestImages(connectionString: string, imagesDir: string, uploadsDir: string): Promise<number> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  let fotos: FotoRow[];
  try {
    ({ rows: fotos } = await client.query<FotoRow>(
      `SELECT p.animal_id, p.url, p.thumbnail_url, s.scientific_name,
              (row_number() OVER (PARTITION BY p.animal_id ORDER BY p.id) - 1)::int AS posicion
         FROM photos p
         JOIN animals a ON a.id = p.animal_id
         JOIN species s ON s.id = a.species_id
        ORDER BY p.id`,
    ));
  } finally {
    await client.end();
  }

  const raiz = resolve(uploadsDir);
  let copiadas = 0;
  for (const foto of fotos) {
    let origen: string | undefined;
    for (const nombre of candidatas(foto)) {
      if (await existe(join(imagesDir, nombre))) {
        origen = join(imagesDir, nombre);
        break;
      }
    }
    if (!origen) continue;

    for (const url of [foto.url, foto.thumbnail_url]) {
      if (!url?.startsWith(PREFIJO_URL) || !EXTENSIONES_IMAGEN.has(extname(url).toLowerCase())) continue;
      const destino = resolve(raiz, url.slice(PREFIJO_URL.length));
      // Nunca se escribe fuera de la carpeta de archivos subidos.
      if (relative(raiz, destino).startsWith('..')) continue;
      await mkdir(dirname(destino), { recursive: true });
      await copyFile(origen, destino);
      copiadas += 1;
    }
  }
  return copiadas;
}
