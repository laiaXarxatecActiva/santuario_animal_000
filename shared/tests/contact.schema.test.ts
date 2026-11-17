import { describe, expect, it } from 'vitest';
import { contactSchema } from '../src/schemas/contact.schema.js';

const base = {
  name: 'Ana',
  email: 'ana@correo.test',
  subject: 'Visita',
  message: 'Hola, ¿se puede visitar el santuario?',
  acceptPrivacy: true,
};

describe('CU-06 contactSchema', () => {
  it('acepta un mensaje completo', () => {
    expect(contactSchema.parse({ ...base, name: '  Ana  ' })).toEqual(base);
  });

  it('3a: todos los campos son obligatorios y el email debe ser válido', () => {
    for (const campo of ['name', 'email', 'subject', 'message'] as const) {
      expect(contactSchema.safeParse({ ...base, [campo]: '  ' }).success, campo).toBe(false);
    }
    expect(contactSchema.safeParse({ ...base, email: 'ana' }).success).toBe(false);
  });

  it('exige aceptar la política de privacidad', () => {
    expect(contactSchema.safeParse({ ...base, acceptPrivacy: false }).success).toBe(false);
    const { acceptPrivacy: _, ...sinCasilla } = base;
    expect(contactSchema.safeParse(sinCasilla).success).toBe(false);
  });

  it('el asunto es de una sola línea (no se pueden inyectar cabeceras de email)', () => {
    expect(contactSchema.safeParse({ ...base, subject: 'Hola\r\nBcc: x@y.z' }).success).toBe(false);
  });

  it('limita las longitudes', () => {
    expect(contactSchema.safeParse({ ...base, name: 'a'.repeat(101) }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, subject: 'a'.repeat(151) }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, message: 'a'.repeat(5001) }).success).toBe(false);
  });
});
