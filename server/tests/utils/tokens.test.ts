import { describe, expect, it } from 'vitest';
import { firmaValida, firmar, generarToken, hashToken } from '../../src/utils/tokens.js';

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

describe('CU-05 Firma del enlace al recibo de una donación', () => {
  const SECRETO = 'un-secreto-de-pruebas-de-32-caracteres';

  it('la firma depende del texto y del secreto, y solo vale la correcta', () => {
    const firma = firmar(SECRETO, 'donation-receipt:7');
    expect(firma).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(firmaValida(SECRETO, 'donation-receipt:7', firma)).toBe(true);
    expect(firmaValida(SECRETO, 'donation-receipt:8', firma)).toBe(false);
    expect(firmaValida('otro-secreto-distinto-de-32-caracteres', 'donation-receipt:7', firma)).toBe(false);
    expect(firmaValida(SECRETO, 'donation-receipt:7', '')).toBe(false);
    expect(firmaValida(SECRETO, 'donation-receipt:7', 'corta')).toBe(false);
  });
});
