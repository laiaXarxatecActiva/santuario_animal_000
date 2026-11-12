import { describe, expect, it } from 'vitest';
import {
  forgotPasswordSchema,
  loginSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from '../src/schemas/auth.schema.js';

const registroValido = {
  firstName: 'Ana',
  lastName: 'Ferrer Soler',
  email: 'ana@correo.test',
  password: 'buitres123',
  passwordConfirm: 'buitres123',
  privacyAccepted: true,
};

const camposConError = (resultado: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  resultado.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('CU-07 registerSchema', () => {
  it('acepta un registro válido', () => {
    expect(registerSchema.parse(registroValido)).toEqual(registroValido);
  });

  it('normaliza el email: sin espacios y en minúsculas', () => {
    expect(registerSchema.parse({ ...registroValido, email: '  Ana@Correo.TEST ' }).email).toBe('ana@correo.test');
  });

  it('quita los espacios del nombre y los apellidos', () => {
    const datos = registerSchema.parse({ ...registroValido, firstName: ' Ana ', lastName: ' Ferrer ' });
    expect(datos).toMatchObject({ firstName: 'Ana', lastName: 'Ferrer' });
  });

  it('ignora el campo role (RN-02)', () => {
    expect(registerSchema.parse({ ...registroValido, role: 'admin' })).not.toHaveProperty('role');
  });

  it('exige nombre, apellidos y un email válido', () => {
    const r = registerSchema.safeParse({ ...registroValido, firstName: '  ', lastName: '', email: 'ana' });
    expect(camposConError(r)).toEqual(['firstName', 'lastName', 'email']);
  });

  it(`3b: la contraseña tiene al menos ${PASSWORD_MIN_LENGTH} caracteres`, () => {
    const r = registerSchema.safeParse({ ...registroValido, password: 'corta', passwordConfirm: 'corta' });
    expect(camposConError(r)).toEqual(['password']);
    expect(r.error?.issues[0]?.message).toBe('La contraseña debe tener al menos 8 caracteres.');
  });

  it(`la contraseña no supera ${PASSWORD_MAX_LENGTH} caracteres (límite de bcrypt)`, () => {
    const larga = 'a'.repeat(PASSWORD_MAX_LENGTH + 1);
    expect(
      camposConError(registerSchema.safeParse({ ...registroValido, password: larga, passwordConfirm: larga })),
    ).toEqual(['password']);
  });

  it('3b: las contraseñas tienen que coincidir', () => {
    const r = registerSchema.safeParse({ ...registroValido, passwordConfirm: 'otra-cosa' });
    expect(camposConError(r)).toEqual(['passwordConfirm']);
    expect(r.error?.issues[0]?.message).toBe('Las contraseñas no coinciden.');
  });

  it('avisa de que no coinciden aunque haya otros campos con errores', () => {
    const r = registerSchema.safeParse({
      ...registroValido,
      firstName: '',
      passwordConfirm: 'otra',
      privacyAccepted: false,
    });
    expect(camposConError(r)).toEqual(['firstName', 'privacyAccepted', 'passwordConfirm']);
  });

  it('no compara las contraseñas si falta alguna', () => {
    const { passwordConfirm: _omitida, ...sinConfirmacion } = registroValido;
    expect(camposConError(registerSchema.safeParse(sinConfirmacion))).toEqual(['passwordConfirm']);
  });

  it('3c: hay que aceptar la política de privacidad', () => {
    expect(camposConError(registerSchema.safeParse({ ...registroValido, privacyAccepted: false }))).toEqual([
      'privacyAccepted',
    ]);
    const { privacyAccepted: _omitido, ...sinCasilla } = registroValido;
    expect(camposConError(registerSchema.safeParse(sinCasilla))).toEqual(['privacyAccepted']);
  });
});

describe('CU-09 loginSchema', () => {
  it('normaliza el email y no valida la longitud de la contraseña', () => {
    expect(loginSchema.parse({ email: ' Lucia.Martinez@correo.test', password: 'x' })).toEqual({
      email: 'lucia.martinez@correo.test',
      password: 'x',
    });
  });

  it('exige email y contraseña', () => {
    expect(camposConError(loginSchema.safeParse({ email: '', password: '' }))).toEqual(['email', 'password']);
  });
});

describe('CU-08 tokenSchema', () => {
  it('exige un token', () => {
    expect(tokenSchema.parse({ token: 'abc' })).toEqual({ token: 'abc' });
    expect(tokenSchema.safeParse({ token: '' }).success).toBe(false);
    expect(tokenSchema.safeParse({}).success).toBe(false);
  });
});

describe('CU-10 forgotPasswordSchema y resetPasswordSchema', () => {
  it('pide un email válido', () => {
    expect(forgotPasswordSchema.parse({ email: 'ANA@correo.test' })).toEqual({ email: 'ana@correo.test' });
    expect(forgotPasswordSchema.safeParse({ email: 'no-es-un-email' }).success).toBe(false);
  });

  it('la nueva contraseña cumple el mínimo y coincide con la repetición', () => {
    const valido = { token: 't', password: 'nueva-clave', passwordConfirm: 'nueva-clave' };
    expect(resetPasswordSchema.parse(valido)).toEqual(valido);
    expect(
      camposConError(resetPasswordSchema.safeParse({ ...valido, password: 'corta', passwordConfirm: 'corta' })),
    ).toEqual(['password']);
    expect(camposConError(resetPasswordSchema.safeParse({ ...valido, passwordConfirm: 'distinta' }))).toEqual([
      'passwordConfirm',
    ]);
  });
});
