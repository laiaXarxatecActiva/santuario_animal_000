import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/utils/passwords.js';

describe('contraseñas', () => {
  it('guarda un hash bcrypt de coste 10 que se puede comprobar', async () => {
    const hash = await hashPassword('buitres123');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await verifyPassword('buitres123', hash)).toBe(true);
    expect(await verifyPassword('otra', hash)).toBe(false);
  });

  it('un hash que no es de bcrypt nunca coincide', async () => {
    expect(await verifyPassword('x', 'no-es-un-hash')).toBe(false);
  });
});
