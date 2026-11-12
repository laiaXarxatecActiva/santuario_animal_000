import { z } from 'zod';

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/, error: 'Debe ser una URL postgres://' });

// Variables de entorno que el servidor usa por ahora. Se irán añadiendo las de
// TECH_SPEC §14.2 (pagos, jobs…) a medida que se necesiten.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  DATABASE_URL: postgresUrl,
  TEST_DATABASE_URL: postgresUrl.optional(),
  // Relativa a la carpeta `server/` si no es absoluta.
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
  SESSION_SECRET: z.string().min(32, { error: 'Debe tener al menos 32 caracteres aleatorios' }),
  // Correo: en local, Mailpit (SMTP en el 1025, interfaz en http://localhost:8025).
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(1).default('Santuario <no-reply@santuario.test>'),
});

export type Config = z.infer<typeof envSchema>;

/** Valida las variables de entorno. Lanza un error legible si alguna no es válida. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problemas = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuración no válida en las variables de entorno:\n${problemas}`);
  }
  return result.data;
}
