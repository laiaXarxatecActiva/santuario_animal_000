import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import type { Language } from '@sanctuary/shared';
import {
  NOMBRE_SANTUARIO,
  NOTAS_ACADEMICAS,
  type ContenidoCertificado,
  type ContenidoRecibo,
} from '../../dominio/documentos.js';

// PdfService (TECH_SPEC §11): dibuja con pdfkit el certificado (CU-22) y los
// recibos (CU-19). Los textos llegan ya escritos desde el dominio. Colores del
// sistema de diseño (DESIGN_SYSTEM §2, tema claro, porque se imprime).
const COLOR = {
  texto: '#3B2F26',
  secundario: '#6B5A4B',
  primario: '#A9532F',
  borde: '#DCCDB8',
  fondoSuave: '#F6E3D8',
};
const MARGEN = 56;

export interface PdfService {
  /** `foto`: la portada del animal en cualquier formato que lea sharp; sin ella, el PDF va sin foto (2a). */
  certificate(contenido: ContenidoCertificado, foto: Buffer | null): Promise<Buffer>;
  receipt(contenido: ContenidoRecibo): Promise<Buffer>;
}

/** Recoge el documento en un Buffer cuando pdfkit termina de escribirlo. */
const IDIOMAS_PDF: Record<Language, string> = { es: 'es-ES', ca: 'ca-ES', en: 'en-GB' };

function generar(titulo: string, idioma: Language, dibujar: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGEN,
      info: { Title: titulo, Author: NOMBRE_SANTUARIO },
      lang: IDIOMAS_PDF[idioma],
    });
    const trozos: Buffer[] = [];
    doc.on('data', (trozo: Buffer) => trozos.push(trozo));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);
    try {
      dibujar(doc);
      doc.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** pdfkit solo admite JPEG y PNG: las fotos (WebP) se convierten. Si falla, sin foto. */
async function aPng(foto: Buffer | null): Promise<Buffer | null> {
  if (!foto) return null;
  try {
    return await sharp(foto).resize({ width: 800, height: 600, fit: 'inside' }).png().toBuffer();
  } catch {
    return null;
  }
}

function pie(doc: PDFKit.PDFDocument, idioma: Language) {
  const ancho = doc.page.width - MARGEN * 2;
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLOR.secundario)
    .text(NOTAS_ACADEMICAS[idioma], MARGEN, doc.page.height - MARGEN - 10, {
      width: ancho,
      align: 'center',
      lineBreak: false,
    });
}

export function createPdfService(): PdfService {
  return {
    async certificate(contenido, foto) {
      const png = await aPng(foto);
      return generar(contenido.titulo, contenido.idioma, (doc) => {
        const { width, height } = doc.page;
        const ancho = width - MARGEN * 2;
        // Marco doble en terracota.
        doc
          .lineWidth(3)
          .strokeColor(COLOR.primario)
          .rect(28, 28, width - 56, height - 56)
          .stroke();
        doc
          .lineWidth(0.75)
          .strokeColor(COLOR.borde)
          .rect(36, 36, width - 72, height - 72)
          .stroke();

        doc.font('Helvetica').fontSize(11).fillColor(COLOR.secundario);
        doc.text(NOMBRE_SANTUARIO.toUpperCase(), MARGEN, MARGEN + 16, {
          width: ancho,
          align: 'center',
          characterSpacing: 2,
        });
        doc.moveDown(0.8);
        doc
          .font('Helvetica-Bold')
          .fontSize(28)
          .fillColor(COLOR.primario)
          .text(contenido.titulo, { width: ancho, align: 'center' });
        doc.moveDown(1);

        if (png) {
          const caja = { ancho: 300, alto: 225 };
          const x = (width - caja.ancho) / 2;
          doc.image(png, x, doc.y, { fit: [caja.ancho, caja.alto], align: 'center', valign: 'center' });
          doc.y += caja.alto + 24;
        } else {
          doc.moveDown(2);
        }

        contenido.lineas.forEach((linea, i) => {
          const dato = i % 2 === 1;
          doc
            .font(dato ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(dato ? 22 : 13)
            .fillColor(dato ? COLOR.texto : COLOR.secundario)
            .text(linea, MARGEN, doc.y, { width: ancho, align: 'center' });
          doc.moveDown(dato ? 0.6 : 0.3);
        });

        doc.moveDown(1.5);
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLOR.secundario);
        doc.text(contenido.nota, MARGEN + 40, doc.y, { width: ancho - 80, align: 'center' });
        pie(doc, contenido.idioma);
      });
    },

    receipt(contenido) {
      return generar(contenido.titulo, contenido.idioma, (doc) => {
        const ancho = doc.page.width - MARGEN * 2;
        const etiqueta = 140;

        // Cabecera: santuario a la izquierda y «Recibo» a la derecha.
        const arriba = doc.y;
        doc.font('Helvetica-Bold').fontSize(16).fillColor(COLOR.texto).text(NOMBRE_SANTUARIO, MARGEN, arriba);
        doc.font('Helvetica').fontSize(9).fillColor(COLOR.secundario).text(NOTAS_ACADEMICAS[contenido.idioma]);
        doc
          .font('Helvetica-Bold')
          .fontSize(24)
          .fillColor(COLOR.primario)
          .text(contenido.titulo, MARGEN, arriba, { width: ancho, align: 'right' });
        doc.y = Math.max(doc.y, arriba + 48);
        doc
          .moveTo(MARGEN, doc.y)
          .lineTo(MARGEN + ancho, doc.y)
          .lineWidth(1)
          .strokeColor(COLOR.borde)
          .stroke();
        doc.moveDown(1.2);

        for (const [i, [nombre, valor]] of contenido.filas.entries()) {
          const y = doc.y;
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(COLOR.secundario)
            .text(nombre, MARGEN, y, { width: etiqueta - 12 });
          const finEtiqueta = doc.y;
          const importe = i === contenido.filaImporte;
          doc
            .font(importe ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(importe ? 16 : 11)
            .fillColor(COLOR.texto)
            .text(valor, MARGEN + etiqueta, y, { width: ancho - etiqueta });
          doc.y = Math.max(doc.y, finEtiqueta) + 10;
        }

        if (contenido.aviso) {
          doc.moveDown(0.8);
          const y = doc.y;
          const alto = 30;
          doc.rect(MARGEN, y, ancho, alto).fill(COLOR.fondoSuave);
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(COLOR.texto)
            .text(contenido.aviso, MARGEN + 12, y + 10, { width: ancho - 24 });
        }
        pie(doc, contenido.idioma);
      });
    },
  };
}
