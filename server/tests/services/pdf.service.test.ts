import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { contenidoCertificado, contenidoRecibo } from '../../src/dominio/documentos.js';
import { createPdfService } from '../../src/services/pdf/pdf.service.js';

const pdf = createPdfService();
const certificado = contenidoCertificado({
  adopterName: 'Lucía Martínez Navarro',
  animalName: 'Rufo',
  speciesName: 'Buitre leonado',
  startDate: '2025-09-05',
});
const esPdf = (b: Buffer) => b.subarray(0, 5).toString() === '%PDF-';

describe('PdfService (CU-22, CU-19)', () => {
  it('CU-22: genera el certificado con la foto de portada (WebP)', async () => {
    const webp = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#b5653a' } })
      .webp()
      .toBuffer();
    const conFoto = await pdf.certificate(certificado, webp);
    const sinFoto = await pdf.certificate(certificado, null);
    expect(esPdf(conFoto)).toBe(true);
    expect(esPdf(sinFoto)).toBe(true);
    // La foto va incrustada.
    expect(conFoto.length).toBeGreaterThan(sinFoto.length);
  });

  it('CU-22 2a: una foto que no se puede leer no impide generar el PDF', async () => {
    expect(esPdf(await pdf.certificate(certificado, Buffer.from('no es una imagen')))).toBe(true);
  });

  it('CU-19: genera el recibo', async () => {
    const recibo = await pdf.receipt(
      contenidoRecibo({
        kind: 'donation',
        id: 1,
        reference: 'SIM-D0001',
        amount: '20.00',
        method: 'simulated',
        status: 'completed',
        paidAt: '2026-11-05T09:15:00.000Z',
        refundedAt: null,
        animalName: null,
        planName: null,
        periodStart: null,
        periodEnd: null,
        payer: { fullName: 'Lucía Martínez Navarro', email: 'lucia.martinez@correo.test' },
      }),
    );
    expect(esPdf(recibo)).toBe(true);
  });
});
