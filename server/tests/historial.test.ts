import { describe, expect, it } from 'vitest';
import { inicioDelHistorial } from '../src/dominio/historial.js';
import { relojFijo } from '../src/dominio/reloj.js';

describe('CU-15 Historial: solo el último año', () => {
  it('empieza el mismo día del año anterior, en la zona del santuario', () => {
    expect(inicioDelHistorial(relojFijo('2026-11-25T12:00:00Z'))).toBe('2025-11-25');
    // Las 23:30 del 31 de diciembre en UTC ya son 1 de enero en Madrid.
    expect(inicioDelHistorial(relojFijo('2026-12-31T23:30:00Z'))).toBe('2026-01-01');
  });

  it('el 29 de febrero se cuenta desde el 28 de febrero del año anterior', () => {
    expect(inicioDelHistorial(relojFijo('2028-02-29T12:00:00Z'))).toBe('2027-02-28');
  });
});
