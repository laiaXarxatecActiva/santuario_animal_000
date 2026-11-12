import { describe, expect, it } from 'vitest';
import {
  changePasswordFormSchema,
  changePasswordSchema,
  profileDataSchema,
  updateProfileSchema,
} from '../src/schemas/profile.schema.js';

const errores = (resultado: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  resultado.error?.issues.map((i) => i.path.join('.')) ?? [];

describe('CU-23 updateProfileSchema', () => {
  it('acepta cambios parciales y recorta los textos', () => {
    expect(updateProfileSchema.parse({ firstName: '  Lucía ' })).toEqual({ firstName: 'Lucía' });
    expect(updateProfileSchema.parse({ showPublicName: false, emailFrequency: 'monthly_digest' })).toEqual({
      showPublicName: false,
      emailFrequency: 'monthly_digest',
    });
  });

  it('el teléfono es un móvil español de 9 dígitos; los guiones y espacios se quitan', () => {
    expect(updateProfileSchema.parse({ phone: '612-34-56-78' })).toEqual({ phone: '612345678' });
    expect(updateProfileSchema.parse({ phone: '712 345 678' })).toEqual({ phone: '712345678' });
    expect(updateProfileSchema.parse({ phone: '' })).toEqual({ phone: null });
    expect(updateProfileSchema.parse({ phone: null })).toEqual({ phone: null });
  });

  it.each([['912345678'], ['61234567'], ['6123456789'], ['+34612345678'], ['612.345.678'], ['61234567a']])(
    '3a: rechaza el teléfono %s',
    (phone) => {
      expect(errores(updateProfileSchema.safeParse({ phone }))).toEqual(['phone']);
    },
  );

  it('3a: el nombre y los apellidos no pueden quedar vacíos', () => {
    expect(errores(updateProfileSchema.safeParse({ firstName: '  ', lastName: '' }))).toEqual([
      'firstName',
      'lastName',
    ]);
  });

  it('3b: el email no se puede cambiar, y hay que enviar algún cambio', () => {
    expect(updateProfileSchema.safeParse({ email: 'otra@correo.test' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.safeParse({ emailFrequency: 'weekly' }).success).toBe(false);
  });
});

describe('CU-24 changePasswordSchema', () => {
  it('pide la contraseña actual y una nueva válida', () => {
    expect(changePasswordSchema.parse({ currentPassword: 'vieja', newPassword: 'nueva-segura' })).toEqual({
      currentPassword: 'vieja',
      newPassword: 'nueva-segura',
    });
    expect(errores(changePasswordSchema.safeParse({ currentPassword: '', newPassword: 'corta' }))).toEqual([
      'currentPassword',
      'newPassword',
    ]);
  });

  it('la nueva contraseña debe ser distinta de la actual', () => {
    const resultado = changePasswordSchema.safeParse({ currentPassword: 'misma-clave', newPassword: 'misma-clave' });
    expect(errores(resultado)).toEqual(['newPassword']);
  });

  it('2b: en el formulario, la nueva se repite y debe coincidir', () => {
    const datos = { currentPassword: 'vieja', newPassword: 'nueva-segura', newPasswordConfirm: 'otra-cosa' };
    expect(errores(changePasswordFormSchema.safeParse(datos))).toEqual(['newPasswordConfirm']);
    expect(changePasswordFormSchema.safeParse({ ...datos, newPasswordConfirm: 'nueva-segura' }).success).toBe(true);
  });
});

describe('CU-23 profileDataSchema', () => {
  it('«Tus datos» exige nombre y apellidos y normaliza el teléfono', () => {
    expect(profileDataSchema.parse({ firstName: 'Ana', lastName: 'Ferrer', phone: '612-34-56-78' })).toEqual({
      firstName: 'Ana',
      lastName: 'Ferrer',
      phone: '612345678',
    });
    expect(errores(profileDataSchema.safeParse({ firstName: '', lastName: '', phone: '' }))).toEqual([
      'firstName',
      'lastName',
    ]);
  });
});
