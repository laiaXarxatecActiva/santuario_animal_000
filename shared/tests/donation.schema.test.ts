import { describe, expect, it } from 'vitest';
import { donationSchema } from '../src/schemas/donation.schema.js';

/** Los datos obligatorios del donante; cada caso añade o cambia lo que comprueba. */
const DONANTE = {
  donorName: 'Ana',
  donorSurname: 'Pérez Gil',
  donorEmail: 'ana@correo.test',
  acceptPrivacy: true,
} as const;
const donacion = (datos: Record<string, unknown>) => donationSchema.safeParse({ ...DONANTE, ...datos });
const valido = (amount: string) => donacion({ amount });

describe('CU-05 donationSchema', () => {
  it('normaliza el importe a dos decimales, sin pasar por números', () => {
    expect(donationSchema.parse({ ...DONANTE, amount: '20' })).toEqual({
      ...DONANTE,
      amount: '20.00',
      isAnonymous: false,
      donorPhone: null,
      taxCertificate: false,
    });
    expect(donationSchema.parse({ ...DONANTE, amount: '3,5' }).amount).toBe('3.50');
    expect(donationSchema.parse({ ...DONANTE, amount: ' 0.50 ' }).amount).toBe('0.50');
    expect(donationSchema.parse({ ...DONANTE, amount: '007' }).amount).toBe('7.00');
    expect(donationSchema.parse({ ...DONANTE, amount: '0.01' }).amount).toBe('0.01');
  });

  it('3a: vacío, 0, negativo, con más de dos decimales o desorbitado no vale (sin mínimo)', () => {
    for (const importe of ['', '0', '0.00', '-5', '5.123', 'abc', '1e3', '123456789']) {
      expect(valido(importe).success, importe).toBe(false);
    }
  });

  it('3b: el email es obligatorio y debe ser válido; los opcionales vacíos se descartan', () => {
    expect(donationSchema.parse({ ...DONANTE, amount: '5', donorPhone: '', message: '', isAnonymous: true })).toEqual({
      ...DONANTE,
      amount: '5.00',
      isAnonymous: true,
      donorPhone: null,
      taxCertificate: false,
    });
    expect(donationSchema.parse({ ...DONANTE, amount: '5', donorEmail: ' Ana@Correo.TEST ' }).donorEmail).toBe(
      'ana@correo.test',
    );
    expect(donacion({ amount: '5', donorEmail: 'no-es-email' }).success).toBe(false);
    expect(donacion({ amount: '5', donorEmail: '' }).success).toBe(false);
    expect(donacion({ amount: '5', donorEmail: undefined }).success).toBe(false);
  });

  it('limita la longitud del nombre y del mensaje, y admite el resultado simulado', () => {
    expect(donacion({ amount: '5', donorName: 'a'.repeat(101) }).success).toBe(false);
    expect(donacion({ amount: '5', message: 'a'.repeat(1001) }).success).toBe(false);
    expect(donationSchema.parse({ ...DONANTE, amount: '5', simulatedOutcome: 'failure' }).simulatedOutcome).toBe(
      'failure',
    );
  });
});

describe('CU-05 Datos del donante y certificado para desgravar', () => {
  it('nombre, apellidos y la aceptación de la privacidad son obligatorios', () => {
    expect(donacion({ amount: '5', donorName: ' ' }).success).toBe(false);
    expect(donacion({ amount: '5', donorSurname: '' }).success).toBe(false);
    expect(donacion({ amount: '5', acceptPrivacy: false }).success).toBe(false);
  });

  it('el teléfono es opcional; si llega, es un móvil español y se guarda sin separadores', () => {
    expect(donationSchema.parse({ ...DONANTE, amount: '5', donorPhone: '612-345-678' }).donorPhone).toBe('612345678');
    expect(donacion({ amount: '5', donorPhone: '912345678' }).success).toBe(false);
  });

  it('con el certificado, el NIF y la dirección completa son obligatorios', () => {
    const r = donacion({ amount: '5', taxCertificate: true });
    expect(r.success).toBe(false);
    const campos = r.error?.issues.map((i) => i.path.join('.')).sort();
    expect(campos).toEqual(['donorAddress', 'donorCountry', 'donorPostalCode', 'donorProvince', 'donorTaxId']);
  });

  it('acepta un DNI o NIE con la letra correcta y un código postal español', () => {
    const fiscal = {
      taxCertificate: true,
      donorTaxId: ' 12345678z ',
      donorAddress: 'Calle Mayor 1, 2.º B',
      donorPostalCode: '46001',
      donorProvince: 'Valencia',
      donorCountry: 'España',
    };
    const datos = donationSchema.parse({ ...DONANTE, amount: '5', ...fiscal });
    expect(datos.donorTaxId).toBe('12345678Z');
    expect(datos.donorPostalCode).toBe('46001');
    expect(donacion({ amount: '5', ...fiscal, donorTaxId: 'X1234567L' }).success).toBe(true);
    for (const nif of ['12345678A', '1234567Z', 'X1234567A', 'ABC']) {
      expect(donacion({ amount: '5', ...fiscal, donorTaxId: nif }).success, nif).toBe(false);
    }
    for (const cp of ['4600', '99001', '00123', 'abcde']) {
      expect(donacion({ amount: '5', ...fiscal, donorPostalCode: cp }).success, cp).toBe(false);
    }
  });

  it('sin el certificado, los datos fiscales se descartan aunque lleguen', () => {
    const datos = donationSchema.parse({
      ...DONANTE,
      amount: '5',
      taxCertificate: false,
      donorTaxId: 'basura',
      donorAddress: 'Calle',
    });
    expect(datos.donorTaxId).toBeUndefined();
    expect(datos.donorAddress).toBeUndefined();
  });
});
