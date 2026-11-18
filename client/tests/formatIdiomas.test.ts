import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n';
import { formatCurrency, formatDate, formatList, formatMonth, formatRelative } from '../src/utils/format';

afterEach(() => i18n.changeLanguage('es'));

describe('Fase 3 Formatos según el idioma de la web', () => {
  it('importes', async () => {
    await i18n.changeLanguage('en');
    expect(formatCurrency('5.00')).toBe('€5.00');
    await i18n.changeLanguage('ca');
    expect(formatCurrency('5.00')).toBe('5,00 €');
  });

  it('fechas y meses', async () => {
    await i18n.changeLanguage('en');
    expect(formatDate('2026-11-29')).toBe('29 November 2026');
    expect(formatMonth('2026-11')).toBe('November 2026');
    await i18n.changeLanguage('ca');
    expect(formatDate('2026-11-29')).toMatch(/^29 de novembre del? 2026$/);
  });

  it('listas y tiempo relativo', async () => {
    await i18n.changeLanguage('en');
    expect(formatList(['Lucía', 'Elena', 'Irene'])).toBe('Lucía, Elena and Irene');
    expect(formatRelative('2026-01-01T10:00:00Z', new Date('2026-01-03T10:00:00Z'))).toBe('2 days ago');
  });

  it('en castellano, igual que antes', () => {
    expect(formatCurrency('5.00')).toBe('5,00 €');
    expect(formatDate('2026-11-29')).toBe('29 de noviembre de 2026');
  });
});
