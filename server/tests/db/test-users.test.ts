import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { relojFijo } from '../../src/dominio/reloj.js';
import { resetDatabase } from '../../src/db/reset.js';
import { parseTestUsers, writeTestUsersFile } from '../../src/db/test-users.js';
import { databaseDir, testDatabaseUrl } from '../helpers/test-db.js';

const testDataSql = join(databaseDir, 'TEST_DATA.sql');
const reloj = relojFijo('2026-11-14T09:30:00Z');
let outDir: string;
let outFile: string;

beforeAll(async () => {
  await resetDatabase(testDatabaseUrl(), databaseDir);
  outDir = await mkdtemp(join(tmpdir(), 'test-users-'));
  outFile = join(outDir, 'USUARIOS_PRUEBA.txt');
});
afterAll(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe('parseTestUsers', () => {
  it('extrae la contraseña en claro de cada crypt() de TEST_DATA.sql', async () => {
    const usuarios = parseTestUsers(await readFile(testDataSql, 'utf8'));
    expect(usuarios.get('marta.soler@santuario.test')?.password).toBe('MartaSoler26#!');
    expect(usuarios.get('sergio.llorens@correo.test')?.password).toBe('Sergio#Vuela7');
    expect(usuarios.get('teresa.vicent@correo.test')?.password).toBe('Teresa*55');
  });

  it('ignora al usuario anonimizado, cuya contraseña es aleatoria', async () => {
    const usuarios = parseTestUsers(await readFile(testDataSql, 'utf8'));
    expect(usuarios.has('deleted-15@anonymized.invalid')).toBe(false);
    expect(usuarios.size).toBe(14);
  });

  it('toma las notas de la cabecera de TEST_DATA.sql', async () => {
    const usuarios = parseTestUsers(await readFile(testDataSql, 'utf8'));
    expect(usuarios.get('pablo.garcia@correo.test')?.notes).toBe('cambio de plan programado; una devolución');
    expect(usuarios.get('marta.soler@santuario.test')?.notes).toBe('');
  });

  it("admite comillas escapadas ('') dentro de la contraseña", () => {
    const usuarios = parseTestUsers("('ana@x.test', crypt('O''Neil1!', gen_salt('bf', 10)))");
    expect(usuarios.get('ana@x.test')?.password).toBe("O'Neil1!");
  });
});

describe('writeTestUsersFile', () => {
  it('escribe cada usuario de la base de datos con su rol y su contraseña', async () => {
    const total = await writeTestUsersFile(testDatabaseUrl(), testDataSql, outFile, reloj);
    expect(total).toBe(15);
    const texto = await readFile(outFile, 'utf8');
    expect(texto).toContain('2026-11-14 10:30');
    expect(texto).toMatch(/marta\.soler@santuario\.test\s+MartaSoler26#!/);
    expect(texto).toMatch(/nuria\.peris@santuario\.test\s+NuriaPeris26#!/);
    expect(texto).toMatch(/lucia\.martinez@correo\.test\s+Lucia\.buitres1/);
    expect(texto.indexOf('ADMINISTRADORES')).toBeLessThan(texto.indexOf('marta.soler@santuario.test'));
    expect(texto.indexOf('CUIDADORES')).toBeLessThan(texto.indexOf('nuria.peris@santuario.test'));
    expect(texto.indexOf('ADOPTANTES')).toBeLessThan(texto.indexOf('lucia.martinez@correo.test'));
  });

  it('marca las cuentas que no pueden entrar con normalidad', async () => {
    await writeTestUsersFile(testDatabaseUrl(), testDataSql, outFile, reloj);
    const texto = await readFile(outFile, 'utf8');
    expect(texto).toMatch(/adrian\.moreno@correo\.test.*email sin verificar/);
    expect(texto).toMatch(/teresa\.vicent@correo\.test.*cuenta desactivada/);
    expect(texto).toMatch(/deleted-15@anonymized\.invalid.*anonimizado/);
  });

  it('refleja los cambios hechos en la base de datos después de la carga', async () => {
    const client = new pg.Client({ connectionString: testDatabaseUrl() });
    await client.connect();
    try {
      await client.query(`UPDATE users SET password_hash = crypt('Otra1234!', gen_salt('bf', 4)) WHERE id = 6`);
      await client.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, privacy_accepted_at)
         VALUES ('Nueva', 'Persona', 'nueva@correo.test', crypt('Nueva1234!', gen_salt('bf', 4)), 'adopter', now())`,
      );
    } finally {
      await client.end();
    }

    const total = await writeTestUsersFile(testDatabaseUrl(), testDataSql, outFile, reloj);
    expect(total).toBe(16);
    const texto = await readFile(outFile, 'utf8');
    expect(texto).not.toContain('Lucia.buitres1');
    expect(texto).toMatch(/lucia\.martinez@correo\.test.*cambiada/);
    expect(texto).toMatch(/nueva@correo\.test.*desconocida/);
  });
});
