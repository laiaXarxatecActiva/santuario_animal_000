import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

const DATABASE_URL = 'postgres://sanctuary:sanctuary@localhost:5432/sanctuary';

describe('loadConfig', () => {
  it('aplica los valores por defecto', () => {
    expect(loadConfig({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CLIENT_URL: 'http://localhost:5173',
      DATABASE_URL,
    });
  });

  it('convierte PORT a número', () => {
    expect(loadConfig({ DATABASE_URL, PORT: '4000' }).PORT).toBe(4000);
  });

  it('acepta TEST_DATABASE_URL', () => {
    const TEST_DATABASE_URL = `${DATABASE_URL}_test`;
    expect(loadConfig({ DATABASE_URL, TEST_DATABASE_URL }).TEST_DATABASE_URL).toBe(TEST_DATABASE_URL);
  });

  it('exige DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('rechaza una DATABASE_URL que no es de PostgreSQL', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://localhost/sanctuary' })).toThrow(/DATABASE_URL/);
  });

  it('rechaza valores no válidos con un mensaje que nombra la variable', () => {
    expect(() => loadConfig({ DATABASE_URL, NODE_ENV: 'staging', PORT: 'abc' })).toThrow(/NODE_ENV[\s\S]*PORT/);
  });
});
