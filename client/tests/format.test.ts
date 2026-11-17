import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatList,
  formatLongDate,
  formatRelative,
  formatShortDate,
  formatShortInstant,
  formatYear,
  previousDay,
} from '../src/utils/format';

describe('format', () => {
  it('importes en formato español a partir del string de la API', () => {
    expect(formatCurrency('5.00')).toMatch(/^5,00\s€$/);
    expect(formatCurrency('12.00')).toMatch(/^12,00\s€$/);
  });

  it('año de una fecha YYYY-MM-DD sin pasar por la zona horaria', () => {
    expect(formatYear('2021-01-01')).toBe('2021');
  });

  it('fecha larga en la zona del santuario', () => {
    expect(formatLongDate('2026-10-12T23:30:00.000Z')).toBe('13 de octubre de 2026');
  });

  it('listas con «y»', () => {
    expect(formatList(['Lucía'])).toBe('Lucía');
    expect(formatList(['Lucía', 'Elena', 'Irene'])).toBe('Lucía, Elena e Irene');
  });

  it('formatDate da formato a un DATE sin saltos de zona horaria', () => {
    expect(formatDate('2026-11-29')).toBe('29 de noviembre de 2026');
    expect(formatDate('2026-01-01')).toBe('1 de enero de 2026');
  });
});

describe('formatRelative', () => {
  const ahora = new Date('2026-11-17T12:00:00Z');
  it('fecha relativa en castellano', () => {
    expect(formatRelative('2026-11-17T11:59:40Z', ahora)).toBe('ahora');
    expect(formatRelative('2026-11-17T11:15:00Z', ahora)).toBe('hace 45 minutos');
    expect(formatRelative('2026-11-17T09:00:00Z', ahora)).toBe('hace 3 horas');
    expect(formatRelative('2026-11-16T12:00:00Z', ahora)).toBe('hace 1 día');
    expect(formatRelative('2026-11-15T12:00:00Z', ahora)).toBe('hace 2 días');
    expect(formatRelative('2026-09-10T12:00:00Z', ahora)).toBe('hace 2 meses');
    expect(formatRelative('2024-11-10T12:00:00Z', ahora)).toBe('hace 2 años');
  });
});

describe('fechas cortas y día anterior (CU-19, CU-21)', () => {
  it('formatShortDate y formatShortInstant dan «5 nov 2026»', () => {
    expect(formatShortDate('2026-11-05')).toBe('5 nov 2026');
    // 23:30 UTC del 4 de noviembre ya es el 5 en Madrid.
    expect(formatShortInstant('2026-11-04T23:30:00.000Z')).toBe('5 nov 2026');
  });

  it('previousDay cruza meses y años', () => {
    expect(previousDay('2026-12-05')).toBe('2026-12-04');
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });
});
