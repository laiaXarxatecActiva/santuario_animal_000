import { fileURLToPath } from 'node:url';

/** URL de la base de datos de pruebas (TECH_SPEC §14.2). */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('Falta TEST_DATABASE_URL: cópiala de .env.example a tu .env.');
  }
  return url;
}

/** Carpeta con seedsql.sql y TEST_DATA.sql. */
export const databaseDir = fileURLToPath(new URL('../../../database/', import.meta.url));
