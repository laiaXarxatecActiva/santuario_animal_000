import type { ReceiptDto } from '@sanctuary/shared';
import { describe, expect, it } from 'vitest';
import { contenidoCertificado, contenidoRecibo, NOTAS_ACADEMICAS, PREFIJOS } from '../src/dominio/documentos.js';

const recibo: ReceiptDto = {
  kind: 'payment',
  id: 1,
  reference: 'SIM-1',
  amount: '10.00',
  paidAt: '2030-01-05T10:00:00.000Z',
  method: 'simulated',
  refundedAt: null,
  animalName: 'Rufo',
  planName: 'Plata',
  periodStart: '2030-01-05',
  periodEnd: '2030-02-04',
  payer: { fullName: 'Lucía Martínez', email: 'lucia@correo.test' },
} as ReceiptDto;

describe('Fase 3 CU-22 y CU-19 PDF en el idioma del usuario', () => {
  it('certificado en valenciano y en inglés', () => {
    const datos = {
      adopterName: 'Lucía',
      animalName: 'Rufo',
      speciesName: 'Buitre leonado',
      startDate: '2030-01-05',
      arrivalDate: '2027-03-12',
    };
    const ca = contenidoCertificado(datos, 'ca');
    expect(ca.titulo).toBe("Certificat d'adopció");
    expect(ca.fechas).toEqual([
      { etiqueta: 'Adopció des de', valor: '5 de gener del 2030' },
      { etiqueta: 'Al santuari des de', valor: '12 de març del 2027' },
    ]);
    const en = contenidoCertificado(datos, 'en');
    expect(en.titulo).toBe('Adoption certificate');
    expect(en.fechas).toEqual([
      { etiqueta: 'Adopted since', valor: '5 January 2030' },
      { etiqueta: 'At the sanctuary since', valor: '12 March 2027' },
    ]);
  });

  it('recibo en inglés con su formato de importe y la fila del importe marcada', () => {
    const en = contenidoRecibo(recibo, 'en');
    expect(en.titulo).toBe('Receipt');
    expect(en.filas[en.filaImporte]).toEqual(['Amount', '€10.00']);
    expect(en.aviso).toBe('Simulated payment: no real charge has been made.');
    expect(contenidoRecibo(recibo, 'ca').filas[en.filaImporte]![0]).toBe('Import');
  });

  it('nota académica y nombre del archivo en cada idioma', () => {
    expect(new Set(Object.values(NOTAS_ACADEMICAS)).size).toBe(3);
    expect(PREFIJOS.en).toEqual({ certificado: 'certificate', recibo: 'receipt' });
  });
});
