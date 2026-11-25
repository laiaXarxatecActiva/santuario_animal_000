import { describe, expect, it } from 'vitest';
import type { ContenidoCertificado } from '../src/dominio/documentos.js';
import type { PdfService } from '../src/services/pdf/pdf.service.js';
import type { StorageService } from '../src/services/storage/storage.service.js';
import type { ContributionService } from '../src/servicios/contribution.service.js';
import { createDocumentService } from '../src/servicios/document.service.js';
import type { DonationService } from '../src/servicios/donation.service.js';
import { usarBaseDeDatos } from './helpers/db-fixture.js';

const db = usarBaseDeDatos();

describe('CU-22 Certificado de adopción: las fechas', () => {
  it('lleva el día en que empezó la adopción y el día en que el animal llegó al santuario', async () => {
    // Se guarda lo que se iba a dibujar, en vez de mirar dentro del PDF.
    let dibujado: ContenidoCertificado | null = null;
    const pdf = {
      certificate: (contenido: ContenidoCertificado) => {
        dibujado = contenido;
        return Promise.resolve(Buffer.from('%PDF-'));
      },
    } as unknown as PdfService;
    const storage = { pathFromUrl: () => null } as unknown as StorageService;
    const servicio = createDocumentService({
      db: db.pool,
      pdf,
      storage,
      contributions: {} as ContributionService,
      donations: {} as DonationService,
    });

    // Lucía adopta a Rufo (adopción 1 de TEST_DATA.sql).
    const { rows } = await db.pool.query<{ start: string; arrival: string }>(
      `SELECT to_char(ad.start_date, 'YYYY-MM-DD') AS start, to_char(a.arrival_date, 'YYYY-MM-DD') AS arrival
         FROM adoptions ad JOIN animals a ON a.id = ad.animal_id WHERE ad.id = 1`,
    );
    const esperadas = rows[0]!;
    expect(esperadas.start).not.toBe(esperadas.arrival);
    const { rows: usuario } = await db.pool.query<{ user_id: number }>('SELECT user_id FROM adoptions WHERE id = 1');
    await db.pool.query(`UPDATE users SET preferred_language = 'es' WHERE id = $1`, [usuario[0]!.user_id]);

    await servicio.certificate(usuario[0]!.user_id, 1);

    const formato = new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const largo = (d: string) => formato.format(new Date(`${d}T00:00:00Z`));
    expect(dibujado).not.toBeNull();
    expect(dibujado!.fechas).toEqual([
      { etiqueta: 'Adopción desde', valor: largo(esperadas.start) },
      { etiqueta: 'En el santuario desde', valor: largo(esperadas.arrival) },
    ]);
  });
});
