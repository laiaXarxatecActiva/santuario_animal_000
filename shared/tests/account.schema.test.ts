import { describe, expect, it } from 'vitest';
import { deleteAccountSchema } from '../src/index.js';

describe('CU-25 Eliminar la cuenta: cuerpo de la petición', () => {
  it('3: pide la contraseña, sin recortarla', () => {
    expect(deleteAccountSchema.parse({ password: ' secreta ' })).toEqual({ password: ' secreta ' });
  });

  it('sin contraseña da el error en el campo', () => {
    const r = deleteAccountSchema.safeParse({ password: '' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Escribe tu contraseña.');
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
  });
});
