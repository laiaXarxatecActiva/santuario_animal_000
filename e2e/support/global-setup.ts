import { comprobarMailpit } from './mailpit.js';

// Antes de empezar: sin Mailpit no llega el correo de verificación del registro.
export default async function globalSetup(): Promise<void> {
  await comprobarMailpit();
}
