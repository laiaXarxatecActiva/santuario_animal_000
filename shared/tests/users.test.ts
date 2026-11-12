import { describe, expect, it } from 'vitest';
import { EMAIL_FREQUENCIES, PHONE_PATTERN } from '../src/constants/users.js';

describe('constantes de usuario', () => {
  it('las frecuencias de email coinciden con el CHECK de seedsql.sql', () => {
    expect(EMAIL_FREQUENCIES).toEqual(['per_update', 'monthly_digest']);
  });

  it('el teléfono es un móvil español de 9 dígitos, como users_phone_format', () => {
    expect(PHONE_PATTERN.test('612345678')).toBe(true);
    expect(PHONE_PATTERN.test('712345678')).toBe(true);
    expect(PHONE_PATTERN.test('912345678')).toBe(false);
    expect(PHONE_PATTERN.test('612-34-56-78')).toBe(false);
  });
});
