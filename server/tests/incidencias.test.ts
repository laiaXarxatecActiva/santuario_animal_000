import { describe, expect, it } from 'vitest';
import {
  avisarAlMomento,
  comprobarCambioDeEstado,
  datosDeResolucion,
  destinatariosDeLaIncidencia,
} from '../src/dominio/incidencias.js';
import { desdeDelRelevo, puedeEscribirRelevo, zonasDelRelevo } from '../src/dominio/relevo.js';
import { debeIrPorEmail, tocaElResumen } from '../src/dominio/avisos-personal.js';
import { horaEnZonaSantuario } from '../src/dominio/reloj.js';

describe('CU-70 Incidencias', () => {
  it('solo las de gravedad alta se avisan al momento', () => {
    expect(avisarAlMomento('high')).toBe(true);
    expect(avisarAlMomento('medium')).toBe(false);
    expect(avisarAlMomento('low')).toBe(false);
  });

  it('se avisa a los administradores y a quien tiene turno en la zona, sin repetir y sin quien la comunica', () => {
    expect(destinatariosDeLaIncidencia([1, 2], [3, 5, 1], 3)).toEqual([1, 2, 5]);
    expect(destinatariosDeLaIncidencia([1, 2], [], 1)).toEqual([2]);
  });

  it('el estado cambia a cualquier otro (también se puede reabrir), pero no al mismo', () => {
    expect(comprobarCambioDeEstado('open', 'in_progress')).toBeNull();
    expect(comprobarCambioDeEstado('in_progress', 'resolved')).toBeNull();
    expect(comprobarCambioDeEstado('resolved', 'open')).toBeNull();
    expect(comprobarCambioDeEstado('open', 'open')).toBe('SAME_STATUS');
  });

  it('al resolverla se guarda cómo, quién y cuándo; al reabrirla se borra', () => {
    const ahora = new Date('2026-11-24T12:00:00Z');
    expect(datosDeResolucion('resolved', 'Malla cosida.', 1, ahora)).toEqual({
      resolution: 'Malla cosida.',
      resolvedBy: 1,
      resolvedAt: ahora,
    });
    expect(datosDeResolucion('open', 'Ha vuelto a pasar.', 1, ahora)).toEqual({
      resolution: null,
      resolvedBy: null,
      resolvedAt: null,
    });
  });
});

describe('CU-71 Notas de relevo', () => {
  it('se escriben en las zonas del turno de hoy; el administrador, en cualquiera', () => {
    expect(puedeEscribirRelevo('caretaker', [3, 4], 4)).toBe(true);
    expect(puedeEscribirRelevo('caretaker', [3, 4], 1)).toBe(false);
    expect(puedeEscribirRelevo('caretaker', [], 4)).toBe(false);
    expect(puedeEscribirRelevo('admin', [], 1)).toBe(true);
  });

  it('se leen las de las zonas del turno de hoy; el administrador, todas', () => {
    expect(zonasDelRelevo('caretaker', [4, 3, 4], [1, 2, 3, 4, 5])).toEqual([3, 4]);
    expect(zonasDelRelevo('caretaker', [], [1, 2, 3, 4, 5])).toEqual([]);
    expect(zonasDelRelevo('admin', [4], [1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });

  it('se ven durante 24 horas', () => {
    expect(desdeDelRelevo(new Date('2026-11-24T12:00:00Z'))).toEqual(new Date('2026-11-23T12:00:00Z'));
  });
});

describe('CU-73 y CU-74 Avisos por email y resumen diario', () => {
  it('un aviso va por email si su tipo está elegido en los ajustes', () => {
    expect(debeIrPorEmail('low_intake', ['low_intake', 'coverage_gap'])).toBe(true);
    expect(debeIrPorEmail('vet_visit_today', ['low_intake'])).toBe(false);
  });

  it('el resumen sale si está activado y ya ha llegado su hora', () => {
    expect(tocaElResumen({ dailySummaryEnabled: true, dailySummaryTime: '20:00' }, '20:00')).toBe(true);
    expect(tocaElResumen({ dailySummaryEnabled: true, dailySummaryTime: '20:00' }, '23:45')).toBe(true);
    expect(tocaElResumen({ dailySummaryEnabled: true, dailySummaryTime: '20:00' }, '19:59')).toBe(false);
    expect(tocaElResumen({ dailySummaryEnabled: false, dailySummaryTime: '20:00' }, '21:00')).toBe(false);
  });

  it('la hora que se compara es la de Madrid', () => {
    expect(horaEnZonaSantuario(new Date('2026-11-24T19:05:00Z'))).toBe('20:05');
    expect(horaEnZonaSantuario(new Date('2026-07-01T23:30:00Z'))).toBe('01:30');
  });
});
