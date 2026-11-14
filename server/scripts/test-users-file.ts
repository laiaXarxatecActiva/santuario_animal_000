// Uso: npm run users:file → escribe USUARIOS_PRUEBA.txt en la raíz con los
// usuarios actuales de DATABASE_URL. Nunca falla: si la base de datos no está
// disponible, avisa y sale con código 0 (se ejecuta antes de «npm run dev»).
import { fileURLToPath } from 'node:url';
import { loadDatabaseConfig } from '../src/config/env.js';
import { relojSistema } from '../src/dominio/reloj.js';
import { writeTestUsersFile } from '../src/db/test-users.js';

try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env se usan las variables del entorno.
}

const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url));

try {
  const { DATABASE_URL } = loadDatabaseConfig();
  const total = await writeTestUsersFile(
    DATABASE_URL,
    ruta('../../database/TEST_DATA.sql'),
    ruta('../../USUARIOS_PRUEBA.txt'),
    relojSistema,
  );
  console.log(`USUARIOS_PRUEBA.txt actualizado (${total} usuarios).`);
} catch (error) {
  console.warn('No se pudo actualizar USUARIOS_PRUEBA.txt:', error instanceof Error ? error.message : error);
}
