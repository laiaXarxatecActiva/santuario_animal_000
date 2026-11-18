import type { ReceiptDto } from '@sanctuary/shared';
import { describe, expect, it } from 'vitest';
import { contenidoCertificado, contenidoRecibo, nombreArchivo } from '../src/dominio/documentos.js';

// Intl separa la cantidad y el euro con un espacio duro.
const plano = (texto: string) => texto.replace(/\u00a0/g, ' ');

const cuota: ReceiptDto = {
  kind: 'payment',
  id: 301,
  reference: 'SIM-A0001-20261105',
  amount: '5.00',
  method: 'simulated',
  status: 'completed',
  paidAt: '2026-11-05T09:15:00.000Z',
  refundedAt: null,
  animalName: 'Rufo',
  planName: 'Usual',
  periodStart: '2026-11-05',
  periodEnd: '2026-12-04',
  payer: { fullName: 'Lucía Martínez Navarro', email: 'lucia.martinez@correo.test' },
};

describe('CU-22 Contenido del certificado de adopción', () => {
  it('2: nombre del adoptante, del animal, especie y fecha de inicio', () => {
    const c = contenidoCertificado({
      adopterName: 'Lucía Martínez Navarro',
      animalName: 'Rufo',
      speciesName: 'Buitre leonado',
      startDate: '2025-09-05',
    });
    expect(c.titulo).toBe('Certificado de adopción');
    expect(c.lineas).toEqual([
      'Santuario de Animales certifica que',
      'Lucía Martínez Navarro',
      'apadrina simbólicamente a',
      'Rufo',
      'Buitre leonado',
      'desde el 5 de septiembre de 2025',
    ]);
    expect(c.nota).toMatch(/simbólic/);
  });
});

describe('CU-19 Contenido del recibo en PDF', () => {
  it('5: datos del santuario, del pagador, concepto, importe, fecha, referencia y «Pago simulado»', () => {
    const r = contenidoRecibo(cuota);
    expect(r.titulo).toBe('Recibo');
    expect(r.filas.map(([k, v]) => [k, plano(v)])).toEqual([
      ['Pagado por', 'Lucía Martínez Navarro\nlucia.martinez@correo.test'],
      ['Concepto', 'Cuota de Rufo · Plan Usual · del 5 nov 2026 al 4 dic 2026'],
      ['Importe', '5,00 €'],
      ['Fecha del pago', '5 de noviembre de 2026'],
      ['Forma de pago', 'Pago simulado'],
      ['Referencia', 'SIM-A0001-20261105'],
      ['Estado', 'Cobrado'],
    ]);
    expect(r.aviso).toBe('Pago simulado: no se ha realizado ningún cargo real.');
  });

  it('4b: un recibo devuelto indica la fecha de la devolución; una donación en efectivo no lleva el aviso', () => {
    const r = contenidoRecibo({
      ...cuota,
      kind: 'donation',
      method: 'cash',
      status: 'refunded',
      refundedAt: '2026-11-06T23:30:00.000Z',
      animalName: null,
      planName: null,
      periodStart: null,
      periodEnd: null,
    });
    expect(r.filas).toContainEqual(['Concepto', 'Donación']);
    expect(r.filas).toContainEqual(['Forma de pago', 'Efectivo']);
    // 23:30 UTC ya es el día 7 en Madrid.
    expect(r.filas).toContainEqual(['Estado', 'Devuelto el 7 de noviembre de 2026']);
    expect(r.aviso).toBeNull();
  });
});

describe('Nombres de los archivos PDF', () => {
  it('sin tildes, espacios ni signos', () => {
    expect(nombreArchivo('certificado', 'Ébano')).toBe('certificado-ebano.pdf');
    expect(nombreArchivo('certificado', 'Señor Pío II')).toBe('certificado-senor-pio-ii.pdf');
    expect(nombreArchivo('recibo', 'SIM-A0001-20261105')).toBe('recibo-sim-a0001-20261105.pdf');
    expect(nombreArchivo('certificado', '¡¿?!')).toBe('certificado.pdf');
  });
});
