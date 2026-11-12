import { describe, expect, it } from 'vitest';
import { formatCurrency, formatList, formatLongDate, formatYear } from '../src/utils/format';

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
});
