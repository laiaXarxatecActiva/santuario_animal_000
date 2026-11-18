import { fileURLToPath } from 'node:url';

// Configuración de las pruebas extremo a extremo. Arrancan su propia API y su
// propio Vite en puertos distintos de los de `npm run dev`, contra la base de
// datos de pruebas, así que pueden ejecutarse con el entorno de desarrollo abierto.

/** Carpeta raíz del repositorio. */
export const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

// El .env de la raíz aporta TEST_DATABASE_URL, SESSION_SECRET y el SMTP de Mailpit.
// Las variables que ya existan en el entorno tienen prioridad.
try {
  process.loadEnvFile(`${RAIZ}.env`);
} catch {
  // Sin .env se usan las variables del entorno.
}

function puerto(nombre: string, porDefecto: number): number {
  const valor = Number(process.env[nombre] ?? porDefecto);
  if (!Number.isInteger(valor) || valor < 1 || valor > 65535) {
    throw new Error(`${nombre} debe ser un número de puerto válido`);
  }
  return valor;
}

export const API_PORT = puerto('E2E_API_PORT', 3100);
export const WEB_PORT = puerto('E2E_WEB_PORT', 5174);
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
/** Interfaz y API de Mailpit, donde llegan los correos. */
export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

/** Base de datos de pruebas: la misma que usa `npm test` (se reinicia al empezar). */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('Falta TEST_DATABASE_URL en el .env de la raíz (ver .env.example).');
  }
  return url;
}
