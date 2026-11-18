import { describe, expect, it } from 'vitest';
import { referenciaManual } from '../src/utils/referencias.js';

describe('CU-37 y CU-38 Referencia de un pago manual', () => {
  it('lleva el método, el día y una parte aleatoria', () => {
    expect(referenciaManual('cash', '2026-11-18')).toMatch(/^CASH-20261118-[0-9A-F]{10}$/);
    expect(referenciaManual('bank_transfer', '2026-11-18')).toMatch(/^TRF-20261118-[0-9A-F]{10}$/);
  });

  it('no se repite', () => {
    expect(referenciaManual('cash', '2026-11-18')).not.toBe(referenciaManual('cash', '2026-11-18'));
  });
});
