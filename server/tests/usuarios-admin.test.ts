import { describe, expect, it } from 'vitest';
import {
  comprobarCambioEstado,
  comprobarCambioRol,
  estadoCuenta,
  puedeReenviarInvitacion,
} from '../src/dominio/usuarios-admin.js';

const ADMIN = 1;
const cuenta = (
  datos: Partial<{
    id: number;
    role: 'adopter' | 'caretaker' | 'admin';
    isActive: boolean;
    anonymizedAt: Date | null;
  }> = {},
) => ({
  id: 3,
  role: 'caretaker' as const,
  isActive: true,
  anonymizedAt: null,
  ...datos,
});

describe('CU-35 Reglas de la gestión de usuarios', () => {
  it('estado de la cuenta: activa, inactiva o anonimizada', () => {
    expect(estadoCuenta(cuenta())).toBe('active');
    expect(estadoCuenta(cuenta({ isActive: false }))).toBe('inactive');
    expect(estadoCuenta(cuenta({ isActive: false, anonymizedAt: new Date() }))).toBe('anonymized');
  });

  it('4: desactivar y reactivar cuentas de otras personas', () => {
    expect(comprobarCambioEstado(cuenta(), { actorId: ADMIN, activar: false })).toBeNull();
    expect(comprobarCambioEstado(cuenta({ isActive: false }), { actorId: ADMIN, activar: true })).toBeNull();
    expect(comprobarCambioEstado(cuenta({ role: 'adopter' }), { actorId: ADMIN, activar: false })).toBeNull();
  });

  it('4b: el administrador no puede desactivar su propia cuenta', () => {
    expect(comprobarCambioEstado(cuenta({ id: ADMIN, role: 'admin' }), { actorId: ADMIN, activar: false })).toBe(
      'CANNOT_DEACTIVATE_SELF',
    );
  });

  it('4c: una cuenta anonimizada no se puede reactivar', () => {
    const anonimizada = cuenta({ role: 'adopter', isActive: false, anonymizedAt: new Date() });
    expect(comprobarCambioEstado(anonimizada, { actorId: ADMIN, activar: true })).toBe('ANONYMIZED_CANNOT_REACTIVATE');
  });

  it('A1: el rol solo cambia entre cuidador y administrador', () => {
    expect(comprobarCambioRol(cuenta(), { nuevoRol: 'admin', adminsActivos: 2 })).toBeNull();
    expect(comprobarCambioRol(cuenta({ role: 'admin' }), { nuevoRol: 'caretaker', adminsActivos: 2 })).toBeNull();
    expect(comprobarCambioRol(cuenta({ role: 'adopter' }), { nuevoRol: 'caretaker', adminsActivos: 2 })).toBe(
      'ROLE_CHANGE_NOT_ALLOWED',
    );
  });

  it('A1: el último administrador activo no deja de serlo', () => {
    expect(comprobarCambioRol(cuenta({ role: 'admin' }), { nuevoRol: 'caretaker', adminsActivos: 1 })).toBe(
      'LAST_ACTIVE_ADMIN',
    );
    // Un administrador desactivado no cuenta como «el último activo».
    expect(
      comprobarCambioRol(cuenta({ role: 'admin', isActive: false }), { nuevoRol: 'caretaker', adminsActivos: 1 }),
    ).toBeNull();
    // Mantener el mismo rol no cambia nada.
    expect(comprobarCambioRol(cuenta({ role: 'admin' }), { nuevoRol: 'admin', adminsActivos: 1 })).toBeNull();
  });

  it('CU-36 4a: la invitación se reenvía a un trabajador activo que nunca ha entrado', () => {
    expect(puedeReenviarInvitacion({ role: 'caretaker', isActive: true, lastLoginAt: null })).toBe(true);
    expect(puedeReenviarInvitacion({ role: 'admin', isActive: true, lastLoginAt: null })).toBe(true);
    expect(puedeReenviarInvitacion({ role: 'caretaker', isActive: true, lastLoginAt: new Date() })).toBe(false);
    expect(puedeReenviarInvitacion({ role: 'caretaker', isActive: false, lastLoginAt: null })).toBe(false);
    expect(puedeReenviarInvitacion({ role: 'adopter', isActive: true, lastLoginAt: null })).toBe(false);
  });
});
