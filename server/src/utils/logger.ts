import { pino, type DestinationStream, type Logger } from 'pino';
import type { Config } from '../config/env.js';

// Nunca se registran contraseñas, tokens ni cookies (TECH_SPEC §13).
const REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
];

/** Logger JSON de la aplicación. En las pruebas no escribe nada. */
export function createLogger(nodeEnv: Config['NODE_ENV'], destination?: DestinationStream): Logger {
  const options = {
    level: nodeEnv === 'test' ? 'silent' : 'info',
    redact: { paths: REDACT, censor: '[oculto]' },
  };
  return destination ? pino(options, destination) : pino(options);
}
