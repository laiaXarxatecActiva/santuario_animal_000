// Uso: npm run db:reset            → DATABASE_URL
//      npm run db:reset -- --test  → TEST_DATABASE_URL
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config/env.js';
import { resetDatabase } from '../src/db/reset.js';

try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env se usan las variables del entorno.
}

const useTest = process.argv.includes('--test');
const config = loadConfig();
const url = useTest ? config.TEST_DATABASE_URL : config.DATABASE_URL;
if (!url) {
  console.error('Falta TEST_DATABASE_URL en el .env.');
  process.exit(1);
}

const databaseDir = fileURLToPath(new URL('../../database/', import.meta.url));
const nombre = new URL(url).pathname.slice(1);

try {
  await resetDatabase(url, databaseDir);
  console.log(`Base de datos «${nombre}» reiniciada con seedsql.sql y TEST_DATA.sql.`);
} catch (error) {
  console.error(`No se pudo reiniciar «${nombre}»:`, error instanceof Error ? error.message : error);
  process.exit(1);
}
