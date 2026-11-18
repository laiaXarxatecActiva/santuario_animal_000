import { describe, expect, it } from 'vitest';
import { anotar, cierreAdmin, comprobarAccion, prefijoReferenciaManual } from '../src/dominio/adopciones-admin.js';

describe('CU-37 Gestionar adopciones: reglas', () => {
  describe('comprobarAccion', () => {
    it('A1: solo se pausa una adopción activa sin baja solicitada', () => {
      expect(comprobarAccion({ status: 'active', cancelRequested: false }, 'pause')).toBeNull();
      expect(comprobarAccion({ status: 'active', cancelRequested: true }, 'pause')).toBe('ADOPTION_ACTION_NOT_ALLOWED');
      for (const status of ['pending', 'paused', 'cancelled', 'finished'] as const) {
        expect(comprobarAccion({ status, cancelRequested: false }, 'pause')).toBe('ADOPTION_ACTION_NOT_ALLOWED');
      }
    });

    it('A2: solo se reanuda una adopción pausada', () => {
      expect(comprobarAccion({ status: 'paused', cancelRequested: false }, 'resume')).toBeNull();
      for (const status of ['pending', 'active', 'cancelled', 'finished'] as const) {
        expect(comprobarAccion({ status, cancelRequested: false }, 'resume')).toBe('ADOPTION_ACTION_NOT_ALLOWED');
      }
    });

    it('A3: se cancela cualquier adopción abierta, también con la baja ya solicitada', () => {
      for (const status of ['pending', 'active', 'paused'] as const) {
        expect(comprobarAccion({ status, cancelRequested: false }, 'cancel')).toBeNull();
      }
      expect(comprobarAccion({ status: 'active', cancelRequested: true }, 'cancel')).toBeNull();
      for (const status of ['cancelled', 'finished'] as const) {
        expect(comprobarAccion({ status, cancelRequested: false }, 'cancel')).toBe('ADOPTION_ACTION_NOT_ALLOWED');
      }
    });
  });

  describe('cierreAdmin (A3)', () => {
    it('cancela con admin_cancelled y fecha de fin hoy', () => {
      expect(cierreAdmin({ startDate: '2026-01-10' }, '2026-11-18')).toEqual({
        status: 'cancelled',
        endReason: 'admin_cancelled',
        endDate: '2026-11-18',
      });
    });

    it('una pendiente (sin inicio) también termina hoy', () => {
      expect(cierreAdmin({ startDate: null }, '2026-11-18').endDate).toBe('2026-11-18');
    });

    it('la fecha de fin nunca queda antes del inicio', () => {
      expect(cierreAdmin({ startDate: '2026-11-20' }, '2026-11-18').endDate).toBe('2026-11-20');
    });
  });

  describe('anotar (notas internas)', () => {
    const entrada = { fecha: '2026-11-18', accion: 'Pausa', autor: 'Marta Soler', texto: 'Lo pidió por teléfono.' };

    it('la primera nota es una línea con fecha, acción y autor', () => {
      expect(anotar(null, entrada)).toBe('18/11/2026 · Pausa · Marta Soler: Lo pidió por teléfono.');
    });

    it('las siguientes se añaden al final sin borrar las anteriores', () => {
      const previas = 'Alta en la jornada de puertas abiertas.';
      expect(anotar(previas, entrada)).toBe(`${previas}\n18/11/2026 · Pausa · Marta Soler: Lo pidió por teléfono.`);
    });

    it('recorta los espacios del texto', () => {
      expect(anotar('', { ...entrada, texto: '  Motivo  ' })).toBe('18/11/2026 · Pausa · Marta Soler: Motivo');
    });
  });

  it('prefijo de la referencia de un pago manual según el método', () => {
    expect(prefijoReferenciaManual('cash')).toBe('CASH');
    expect(prefijoReferenciaManual('bank_transfer')).toBe('TRF');
  });
});
