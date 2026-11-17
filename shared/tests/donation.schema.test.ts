import { describe, expect, it } from 'vitest';
import { donationSchema } from '../src/schemas/donation.schema.js';

const valido = (amount: string) => donationSchema.safeParse({ amount });

describe('CU-05 donationSchema', () => {
  it('normaliza el importe a dos decimales, sin pasar por números', () => {
    expect(donationSchema.parse({ amount: '20' })).toEqual({ amount: '20.00', isAnonymous: false });
    expect(donationSchema.parse({ amount: '3,5' }).amount).toBe('3.50');
    expect(donationSchema.parse({ amount: ' 0.50 ' }).amount).toBe('0.50');
    expect(donationSchema.parse({ amount: '007' }).amount).toBe('7.00');
    expect(donationSchema.parse({ amount: '0.01' }).amount).toBe('0.01');
  });

  it('3a: vacío, 0, negativo, con más de dos decimales o desorbitado no vale (sin mínimo)', () => {
    for (const importe of ['', '0', '0.00', '-5', '5.123', 'abc', '1e3', '123456789']) {
      expect(valido(importe).success, importe).toBe(false);
    }
  });

  it('3b: el email es opcional, pero si llega debe ser válido; los vacíos se descartan', () => {
    expect(
      donationSchema.parse({ amount: '5', donorName: '  ', donorEmail: '', message: '', isAnonymous: true }),
    ).toEqual({ amount: '5.00', isAnonymous: true });
    expect(donationSchema.parse({ amount: '5', donorEmail: ' Ana@Correo.TEST ' }).donorEmail).toBe(
      'ana@correo.test',
    );
    expect(donationSchema.safeParse({ amount: '5', donorEmail: 'no-es-email' }).success).toBe(false);
  });

  it('limita la longitud del nombre y del mensaje, y admite el resultado simulado', () => {
    expect(donationSchema.safeParse({ amount: '5', donorName: 'a'.repeat(201) }).success).toBe(false);
    expect(donationSchema.safeParse({ amount: '5', message: 'a'.repeat(1001) }).success).toBe(false);
    expect(donationSchema.parse({ amount: '5', simulatedOutcome: 'failure' }).simulatedOutcome).toBe('failure');
  });
});
