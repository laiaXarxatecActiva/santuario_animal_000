import { describe, expect, it } from 'vitest';
import { tarjetaSimuladaSchema } from '../src/schemas/simulated-card.schema.js';

// Pago simulado (TECH_SPEC §11.1): la tarjeta solo se comprueba por su formato
// y nunca sale del navegador.
const HOY = new Date(2026, 10, 23); // 23 de noviembre de 2026
const esquema = tarjetaSimuladaSchema(HOY);
const valida = { holder: 'Ana Pérez', number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' };
const con = (cambios: Partial<typeof valida>) => esquema.safeParse({ ...valida, ...cambios });

describe('CU-05, CU-13, CU-14 Tarjeta del pago simulado', () => {
  it('acepta una tarjeta con buen formato y deja el número solo con dígitos', () => {
    expect(esquema.parse(valida)).toEqual({ ...valida, number: '4242424242424242' });
    expect(con({ number: '4000-0566-5566-5556' }).success).toBe(true);
    expect(con({ number: '378282246310005' }).success).toBe(true); // 15 dígitos
  });

  it('rechaza el número si no pasa la comprobación de Luhn o no tiene entre 13 y 19 dígitos', () => {
    for (const numero of ['4242 4242 4242 4241', '1234', '4242 4242 4242 4242 4242', 'abcd efgh ijkl mnop', '']) {
      expect(con({ number: numero }).success, numero).toBe(false);
    }
  });

  it('la caducidad es MM/AA y no puede haber pasado (el mes en curso aún vale)', () => {
    expect(con({ expiry: '11/26' }).success).toBe(true);
    expect(con({ expiry: '1126' }).success).toBe(true);
    for (const caducidad of ['10/26', '12/25', '13/27', '00/27', '1/27', '']) {
      expect(con({ expiry: caducidad }).success, caducidad).toBe(false);
    }
  });

  it('el CVC tiene 3 o 4 dígitos y el titular es obligatorio', () => {
    expect(con({ cvc: '1234' }).success).toBe(true);
    for (const cvc of ['12', '12345', 'abc', '']) expect(con({ cvc }).success, cvc).toBe(false);
    expect(con({ holder: '   ' }).success).toBe(false);
  });
});
