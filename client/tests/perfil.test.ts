import type { ProfileDto } from '@sanctuary/shared';
import { describe, expect, it } from 'vitest';
import { borradorDe, cambiosDelPerfil, soloCambios } from '../src/utils/perfil';

const perfil: ProfileDto = {
  firstName: 'Lucía',
  lastName: 'Martínez Navarro',
  email: 'lucia.martinez@correo.test',
  phone: '611222006',
  role: 'adopter',
  emailNotifications: true,
  emailFrequency: 'per_update',
  showPublicName: false,
};

describe('CU-23 Cambios del perfil sin guardar', () => {
  it('el borrador parte de lo guardado, con el teléfono con guiones', () => {
    expect(borradorDe(perfil)).toEqual({
      firstName: 'Lucía',
      lastName: 'Martínez Navarro',
      phone: '611-22-20-06',
      emailNotifications: true,
      emailFrequency: 'per_update',
      showPublicName: false,
    });
    expect(borradorDe({ ...perfil, phone: null }).phone).toBe('');
  });

  it('sin cambios, la lista está vacía', () => {
    expect(cambiosDelPerfil(perfil, borradorDe(perfil))).toEqual([]);
  });

  it('enumera los campos cambiados en el orden de la página', () => {
    const borrador = {
      ...borradorDe(perfil),
      showPublicName: true,
      phone: '622-33-44-55',
      firstName: 'Lucía María',
    };
    expect(cambiosDelPerfil(perfil, borrador)).toEqual(['firstName', 'phone', 'showPublicName']);
  });

  it('los espacios de los extremos y los guiones del teléfono no son cambios', () => {
    const borrador = { ...borradorDe(perfil), firstName: ' Lucía ', phone: '611 222 006' };
    expect(cambiosDelPerfil(perfil, borrador)).toEqual([]);
  });

  it('vaciar el teléfono es un cambio', () => {
    expect(cambiosDelPerfil(perfil, { ...borradorDe(perfil), phone: '' })).toEqual(['phone']);
    expect(cambiosDelPerfil({ ...perfil, phone: null }, { ...borradorDe(perfil), phone: '' })).toEqual([]);
  });
});

describe('CU-23 Lo que se envía al guardar', () => {
  it('solo los campos cambiados, con los valores ya validados', () => {
    const datos = {
      firstName: 'Lucía María',
      lastName: 'Martínez Navarro',
      phone: null,
      emailNotifications: true,
      emailFrequency: 'per_update' as const,
      showPublicName: true,
    };
    expect(soloCambios(datos, ['firstName', 'phone', 'showPublicName'])).toEqual({
      firstName: 'Lucía María',
      phone: null,
      showPublicName: true,
    });
    expect(soloCambios(datos, [])).toEqual({});
  });
});
