import { describe, expect, it } from 'vitest';
import { loadConfig, loadDatabaseConfig } from '../src/config/env.js';

const DATABASE_URL = 'postgres://sanctuary:sanctuary@localhost:5432/sanctuary';
const SESSION_SECRET = 'a'.repeat(32);

describe('loadConfig', () => {
  it('aplica los valores por defecto', () => {
    expect(loadConfig({ DATABASE_URL, SESSION_SECRET })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CLIENT_URL: 'http://localhost:5173',
      DATABASE_URL,
      UPLOADS_DIR: './uploads',
      SESSION_SECRET,
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      MAIL_FROM: 'Santuario <no-reply@santuario.test>',
    });
  });

  it('acepta otra carpeta de archivos subidos', () => {
    expect(loadConfig({ DATABASE_URL, SESSION_SECRET, UPLOADS_DIR: '/srv/uploads' }).UPLOADS_DIR).toBe('/srv/uploads');
  });

  it('convierte PORT a número', () => {
    expect(loadConfig({ DATABASE_URL, SESSION_SECRET, PORT: '4000' }).PORT).toBe(4000);
  });

  it('acepta TEST_DATABASE_URL', () => {
    const TEST_DATABASE_URL = `${DATABASE_URL}_test`;
    expect(loadConfig({ DATABASE_URL, SESSION_SECRET, TEST_DATABASE_URL }).TEST_DATABASE_URL).toBe(TEST_DATABASE_URL);
  });

  it('exige DATABASE_URL', () => {
    expect(() => loadConfig({ SESSION_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('exige un SESSION_SECRET de al menos 32 caracteres', () => {
    expect(() => loadConfig({ DATABASE_URL })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ DATABASE_URL, SESSION_SECRET: 'corto' })).toThrow(/SESSION_SECRET/);
  });

  it('lee la configuración SMTP', () => {
    const config = loadConfig({
      DATABASE_URL,
      SESSION_SECRET,
      SMTP_HOST: 'smtp.test',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
    });
    expect(config).toMatchObject({ SMTP_HOST: 'smtp.test', SMTP_PORT: 587, SMTP_USER: 'u' });
  });

  it('rechaza una DATABASE_URL que no es de PostgreSQL', () => {
    expect(() => loadConfig({ SESSION_SECRET, DATABASE_URL: 'mysql://localhost/sanctuary' })).toThrow(/DATABASE_URL/);
  });

  it('rechaza valores no válidos con un mensaje que nombra la variable', () => {
    expect(() => loadConfig({ DATABASE_URL, SESSION_SECRET, NODE_ENV: 'staging', PORT: 'abc' })).toThrow(
      /NODE_ENV[\s\S]*PORT/,
    );
  });
});

describe('loadDatabaseConfig', () => {
  it('los scripts de base de datos no necesitan SESSION_SECRET', () => {
    expect(loadDatabaseConfig({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      DATABASE_URL,
      UPLOADS_DIR: './uploads',
    });
  });

  it('sigue exigiendo DATABASE_URL', () => {
    expect(() => loadDatabaseConfig({})).toThrow(/DATABASE_URL/);
  });
});
