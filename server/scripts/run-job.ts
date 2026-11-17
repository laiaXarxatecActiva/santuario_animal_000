// Uso: npm run job -- <nombre>   (billing, expire-pending, finish-cancelled)
// Ejecuta una tarea programada a mano contra DATABASE_URL e imprime el resumen.
import { loadConfig } from '../src/config/env.js';
import { createJobDeps } from '../src/jobs/job-deps.js';
import { JOB_NAMES, createJobRunner } from '../src/jobs/registry.js';

try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env se usan las variables del entorno.
}

const nombre = process.argv[2];
if (!nombre) {
  console.error(`Indica la tarea: npm run job -- <${JOB_NAMES.join('|')}>`);
  process.exit(1);
}

const deps = createJobDeps(loadConfig(), (error, contexto) => console.error(contexto, error));
try {
  const resultado = await createJobRunner(deps).run(nombre);
  console.log(`Tarea ${nombre} terminada:`, resultado);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await deps.db.end();
}
