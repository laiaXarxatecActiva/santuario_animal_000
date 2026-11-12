import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createLogger } from './utils/logger.js';

// Carga el .env de la raíz del proyecto si existe (Node 22+).
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env se usan las variables del entorno y los valores por defecto.
}

const config = loadConfig();
const logger = createLogger(config.NODE_ENV);
const app = createApp({ logger });

app.listen(config.PORT, () => {
  logger.info(`API escuchando en http://localhost:${config.PORT} (${config.NODE_ENV})`);
});
