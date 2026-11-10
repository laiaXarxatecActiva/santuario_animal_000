import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

describe('loadConfig', () => {
  it('aplica los valores por defecto', () => {
    expect(loadConfig({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CLIENT_URL: 'http://localhost:5173',
    });
  });

  it('convierte PORT a número', () => {
    expect(loadConfig({ PORT: '4000' }).PORT).toBe(4000);
  });

  it('rechaza valores no válidos con un mensaje que nombra la variable', () => {
    expect(() => loadConfig({ NODE_ENV: 'staging', PORT: 'abc' })).toThrow(/NODE_ENV[\s\S]*PORT/);
  });
});
