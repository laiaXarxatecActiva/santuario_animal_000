// Uso: npm run db:reset            → DATABASE_URL
//      npm run db:reset -- --test  → TEST_DATABASE_URL
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDatabaseConfig } from '../src/config/env.js';
import { resetDatabase } from '../src/db/reset.js';
import { copyTestImages } from '../src/db/test-images.js';

try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env se usan las variables del entorno.
}

const useTest = process.argv.includes('--test');
const config = loadDatabaseConfig();
const url = useTest ? config.TEST_DATABASE_URL : config.DATABASE_URL;
if (!url) {
  console.error('Falta TEST_DATABASE_URL en el .env.');
  process.exit(1);
}

const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url));
const databaseDir = ruta('../../database/');
// Las fotos de ejemplo no están en git (derechos de autor sin comprobar).
const imagesDir = ruta('../../ignore/test-images/');
const uploadsDir = resolve(ruta('../'), config.UPLOADS_DIR);
const nombre = new URL(url).pathname.slice(1);

try {
  await resetDatabase(url, databaseDir);
  console.log(`Base de datos «${nombre}» reiniciada con seedsql.sql y TEST_DATA.sql.`);
  const copiadas = await copyTestImages(url, imagesDir, uploadsDir);
  console.log(
    copiadas > 0
      ? `${copiadas} fotos de ejemplo copiadas en ${uploadsDir}.`
      : `Sin fotos de ejemplo: no se ha encontrado ninguna en ${imagesDir}.`,
  );
} catch (error) {
  console.error(`No se pudo reiniciar «${nombre}»:`, error instanceof Error ? error.message : error);
  process.exit(1);
}
