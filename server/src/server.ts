import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

// Carga el .env de la raíz del proyecto si existe (Node 22+).
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env se usan las variables del entorno y los valores por defecto.
}

const config = loadConfig();
const app = createApp();

app.listen(config.PORT, () => {
  console.log(`API escuchando en http://localhost:${config.PORT} (${config.NODE_ENV})`);
});
