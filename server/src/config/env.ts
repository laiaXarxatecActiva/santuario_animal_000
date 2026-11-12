import { z } from 'zod';
import { PAYMENT_SIMULATION_MODES } from '../services/payment/simulated.gateway.js';

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/, error: 'Debe ser una URL postgres://' });

// Variables de entorno que se usan por ahora. Se irán añadiendo las de
// TECH_SPEC §14.2 (pagos, jobs…) a medida que se necesiten.

// Lo que necesitan los scripts de base de datos (db:reset), que no arrancan el servidor.
const databaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: postgresUrl,
  TEST_DATABASE_URL: postgresUrl.optional(),
  // Relativa a la carpeta `server/` si no es absoluta.
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
});

const envSchema = databaseEnvSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(32, { error: 'Debe tener al menos 32 caracteres aleatorios' }),
  // Correo: en local, Mailpit (SMTP en el 1025, interfaz en http://localhost:8025).
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(1).default('Santuario <no-reply@santuario.test>'),
  // Pasarela simulada (TECH_SPEC §11.1).
  PAYMENT_SIMULATION_MODE: z.enum(PAYMENT_SIMULATION_MODES).default('always_succeed'),
  PAYMENT_SIMULATION_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.2),
});

export type Config = z.infer<typeof envSchema>;

export type DatabaseConfig = z.infer<typeof databaseEnvSchema>;

function parse<S extends z.ZodType>(schema: S, env: NodeJS.ProcessEnv): z.output<S> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problemas = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuración no válida en las variables de entorno:\n${problemas}`);
  }
  return result.data;
}

/** Valida las variables de entorno del servidor. Lanza un error legible si alguna no es válida. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return parse(envSchema, env);
}

/** Solo las variables de la base de datos, para los scripts como db:reset. */
export function loadDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  return parse(databaseEnvSchema, env);
}
