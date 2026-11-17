import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/utils/passwords.js';

describe('contraseñas', () => {
  it('guarda un hash Argon2id con los parámetros de OWASP que se puede comprobar', async () => {
    const hash = await hashPassword('buitres123');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
    expect(await verifyPassword('buitres123', hash)).toBe(true);
    expect(await verifyPassword('buitres124', hash)).toBe(false);
  });

  it('usa una sal distinta en cada hash', async () => {
    expect(await hashPassword('buitres123')).not.toBe(await hashPassword('buitres123'));
  });

  it('no trunca las contraseñas largas (a diferencia de bcrypt)', async () => {
    const larga = 'a'.repeat(100);
    expect(await verifyPassword(`${larga}b`, await hashPassword(larga))).toBe(false);
  });

  it('un hash que no es Argon2id, o con un coste desorbitado, nunca coincide', async () => {
    expect(await verifyPassword('x', 'no-es-un-hash')).toBe(false);
    expect(await verifyPassword('buitres123', '$2a$10$abcdefghijklmnopqrstuuMhJ3XQbZp3m7Fh0lEc3H1hQ0Z5Q9y2a')).toBe(
      false,
    );
    expect(
      await verifyPassword('x', '$argon2id$v=19$m=999999999,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA'),
    ).toBe(false);
  });
});
