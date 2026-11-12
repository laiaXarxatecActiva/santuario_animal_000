import { describe, expect, it } from 'vitest';
import { formatPhone } from '../src/utils/phone';

describe('CU-23 formatPhone', () => {
  it('agrupa el móvil como 612-34-56-78', () => {
    expect(formatPhone('612345678')).toBe('612-34-56-78');
  });

  it('da formato mientras se escribe', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('61')).toBe('61');
    expect(formatPhone('6123')).toBe('612-3');
    expect(formatPhone('612345')).toBe('612-34-5');
  });

  it('solo admite dígitos y como mucho 9', () => {
    expect(formatPhone('612a34-56 78')).toBe('612-34-56-78');
    expect(formatPhone('6123456789999')).toBe('612-34-56-78');
  });
});
