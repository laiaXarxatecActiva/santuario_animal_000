import { describe, expect, it } from 'vitest';
import { generarToken, hashToken } from '../../src/utils/tokens.js';

describe('tokens de un solo uso', () => {
  it('genera 32 bytes aleatorios en base64url y su hash SHA-256 en hexadecimal', () => {
    const { token, hash } = generarToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hash);
  });

  it('cada token es distinto', () => {
    expect(generarToken().token).not.toBe(generarToken().token);
  });
});
