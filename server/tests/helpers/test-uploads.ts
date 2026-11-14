import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../../src/app.js';
import { createPool } from '../../src/db/pool.js';
import { resetDatabase } from '../../src/db/reset.js';
import { relojFijo } from '../../src/dominio/reloj.js';
import { createMemoryMailer } from '../../src/services/email/email.service.js';
import { databaseDir, testDatabaseUrl } from './test-db.js';
import { opcionesDePrueba, type TestApp } from './test-app.js';

export interface TestAppConSubidas extends TestApp {
  /** Carpeta temporal servida en /uploads. */
  uploadsDir: string;
  /** Borra la carpeta temporal y cierra el pool. */
  cerrar: () => Promise<void>;
}

/**
 * Como `prepararApp`, pero con una carpeta de subidas temporal para que las
 * pruebas de CU-29 y CU-31 no escriban en el repositorio.
 */
export async function prepararAppConSubidas(): Promise<TestAppConSubidas> {
  await resetDatabase(testDatabaseUrl(), databaseDir);
  const uploadsDir = await mkdtemp(join(tmpdir(), 'santuario-uploads-'));
  const pool = createPool(testDatabaseUrl());
  const { rows } = await pool.query<{ hoy: string }>('SELECT CURRENT_DATE::text AS hoy');
  const hoy = rows[0]?.hoy ?? '';
  const reloj = relojFijo(`${hoy}T12:00:00Z`);
  const mailer = createMemoryMailer();
  const app = createApp({ db: pool, reloj, ...opcionesDePrueba(mailer, reloj), uploadsDir });
  return {
    app,
    pool,
    reloj,
    hoy,
    mailer,
    uploadsDir,
    cerrar: async () => {
      await pool.end();
      await rm(uploadsDir, { recursive: true, force: true });
    },
  };
}

/** JPEG de prueba del tamaño indicado. */
export const jpeg = (width = 2000, height = 1000) =>
  sharp({ create: { width, height, channels: 3, background: '#b5653a' } })
    .jpeg()
    .toBuffer();

/** Cabecera mínima de un MP4 (no se procesa, solo se comprueba la firma). */
export const mp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(64)]);

/** ¿Existe en la carpeta de subidas el archivo de esta URL (`/uploads/...`)? */
export function existeSubida(uploadsDir: string, url: string): Promise<boolean> {
  return stat(join(uploadsDir, url.replace(/^\/uploads\//, ''))).then(
    () => true,
    () => false,
  );
}
