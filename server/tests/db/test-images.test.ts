import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetDatabase } from '../../src/db/reset.js';
import { copyTestImages } from '../../src/db/test-images.js';
import { databaseDir, testDatabaseUrl } from '../helpers/test-db.js';

// Las fotos reales no están en git (ignore/test-images/): se usan archivos
// falsos cuyo contenido es su propio nombre.
const ESPECIES = ['buitre_leonado', 'buitre_negro', 'buitre_alimoche_comun', 'buitre_quebrantahuesos'];
let imagesDir: string;
let uploadsDir: string;
let copiadas: number;

const leer = (ruta: string) => readFile(join(uploadsDir, ruta), 'utf8');
const existe = (ruta: string) =>
  stat(join(uploadsDir, ruta)).then(
    () => true,
    () => false,
  );

beforeAll(async () => {
  await resetDatabase(testDatabaseUrl(), databaseDir);
  imagesDir = await mkdtemp(join(tmpdir(), 'images-'));
  uploadsDir = await mkdtemp(join(tmpdir(), 'uploads-'));
  for (const especie of ESPECIES) {
    for (const n of [1, 2, 3]) await writeFile(join(imagesDir, `${especie}_${n}.jpg`), `${especie}_${n}`);
  }
  // El quebrantahuesos solo tiene la imagen de respaldo.
  for (const n of [1, 2, 3]) await rm(join(imagesDir, `buitre_quebrantahuesos_${n}.jpg`));
  await writeFile(join(imagesDir, 'buitre_quebrantahuesos_test.jpg'), 'buitre_quebrantahuesos_test');
  copiadas = await copyTestImages(testDatabaseUrl(), imagesDir, uploadsDir);
});
afterAll(async () => {
  await rm(imagesDir, { recursive: true, force: true });
  await rm(uploadsDir, { recursive: true, force: true });
});

describe('copyTestImages', () => {
  it('crea cada foto y su miniatura en la ruta que indica la base de datos', async () => {
    expect(await existe('animals/1/cover.jpg')).toBe(true);
    expect(await existe('animals/1/thumb_cover.jpg')).toBe(true);
    expect(await existe('animals/2/update_6.jpg')).toBe(true);
  });

  it('usa una foto de la especie del animal, rotando entre las tres según el animal', async () => {
    expect(await leer('animals/1/cover.jpg')).toBe('buitre_leonado_1');
    expect(await leer('animals/2/cover.jpg')).toBe('buitre_leonado_2');
    expect(await leer('animals/3/cover.jpg')).toBe('buitre_leonado_3');
    expect(await leer('animals/4/cover.jpg')).toBe('buitre_leonado_1');
    expect(await leer('animals/8/cover.jpg')).toMatch(/^buitre_negro_/);
    expect(await leer('animals/11/cover.jpg')).toMatch(/^buitre_alimoche_comun_/);
  });

  it('las demás fotos del mismo animal usan las siguientes de la especie', async () => {
    expect(await leer('animals/1/02.jpg')).toBe('buitre_leonado_2');
    expect(await leer('animals/1/03.jpg')).toBe('buitre_leonado_3');
  });

  it('la miniatura es la misma imagen que su foto', async () => {
    expect(await leer('animals/1/thumb_02.jpg')).toBe(await leer('animals/1/02.jpg'));
  });

  it('si faltan las numeradas usa la imagen _test de la especie', async () => {
    expect(await leer('animals/13/cover.jpg')).toBe('buitre_quebrantahuesos_test');
  });

  it('no inventa vídeos: solo copia la miniatura del vídeo', async () => {
    expect(await existe('animals/4/update_8.mp4')).toBe(false);
    expect(await existe('animals/4/thumb_update_8.jpg')).toBe(true);
  });

  it('devuelve cuántos archivos ha copiado (21 fotos + 21 miniaturas − 1 vídeo)', () => {
    expect(copiadas).toBe(41);
  });

  it('sin carpeta de imágenes no copia nada y no falla', async () => {
    expect(await copyTestImages(testDatabaseUrl(), join(imagesDir, 'no-existe'), uploadsDir)).toBe(0);
  });
});
