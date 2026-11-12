import { describe, expect, it } from 'vitest';
import { formatEuros, formatFecha } from '../../src/utils/format.js';

describe('formato para los emails', () => {
  it('importes en euros con coma decimal', () => {
    expect(formatEuros('5.00')).toMatch(/^5,00\s€$/);
    expect(formatEuros('1234.50')).toMatch(/^1234,50\s€$|^1\.234,50\s€$/);
  });

  it('fechas DD/MM/AAAA sin pasar por la zona horaria', () => {
    expect(formatFecha('2026-01-05')).toBe('05/01/2026');
  });
});
