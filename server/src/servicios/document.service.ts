import type { ReceiptDto } from '@sanctuary/shared';
import type { Pool } from 'pg';
import { contenidoCertificado, contenidoRecibo, nombreArchivo, PREFIJOS } from '../dominio/documentos.js';
import { CertificateNotAvailableError, NotFoundError } from '../errors/app-error.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as userModel from '../models/user.model.js';
import type { PdfService } from '../services/pdf/pdf.service.js';
import type { StorageService } from '../services/storage/storage.service.js';
import type { ContributionService } from './contribution.service.js';

export interface DocumentoPdf {
  filename: string;
  pdf: Buffer;
}

export interface DocumentServiceDeps {
  db: Pool;
  pdf: PdfService;
  storage: StorageService;
  contributions: ContributionService;
}

export type DocumentService = ReturnType<typeof createDocumentService>;

// CU-22 certificado y CU-19 recibos en PDF. Se generan al momento y no se guardan.
export function createDocumentService({ db, pdf, storage, contributions }: DocumentServiceDeps) {
  /** La portada del animal; si falta el archivo o no se puede leer, sin foto (2a). */
  async function portada(url: string | undefined): Promise<Buffer | null> {
    const ruta = url ? storage.pathFromUrl(url) : null;
    if (!ruta) return null;
    try {
      return await storage.read(ruta);
    } catch {
      return null;
    }
  }

  /** El recibo en el idioma del usuario (Fase 3). */
  async function reciboPdf(userId: number, recibo: ReceiptDto): Promise<DocumentoPdf> {
    const idioma = await userModel.findLanguage(db, userId);
    return {
      filename: nombreArchivo(PREFIJOS[idioma].recibo, recibo.reference),
      pdf: await pdf.receipt(contenidoRecibo(recibo, idioma)),
    };
  }

  return {
    async certificate(userId: number, adoptionId: number): Promise<DocumentoPdf> {
      const adopcion = await adoptionModel.findOwnedById(db, userId, adoptionId);
      if (!adopcion) throw new NotFoundError();
      // 1a: solo con la adopción activa.
      if (adopcion.status !== 'active' || !adopcion.startDate) throw new CertificateNotAvailableError();
      const usuario = await userModel.findById(db, userId);
      if (!usuario) throw new NotFoundError();
      const idioma = usuario.preferredLanguage ?? 'es';
      const contenido = contenidoCertificado(
        {
          adopterName: `${usuario.firstName} ${usuario.lastName}`,
          animalName: adopcion.animal.name,
          speciesName: adopcion.animal.species,
          startDate: adopcion.startDate,
        },
        idioma,
      );
      return {
        filename: nombreArchivo(PREFIJOS[idioma].certificado, adopcion.animal.name),
        pdf: await pdf.certificate(contenido, await portada(adopcion.animal.coverPhoto?.url)),
      };
    },

    paymentReceipt: async (userId: number, paymentId: number) =>
      reciboPdf(userId, await contributions.paymentReceipt(userId, paymentId)),

    donationReceipt: async (userId: number, donationId: number) =>
      reciboPdf(userId, await contributions.donationReceipt(userId, donationId)),
  };
}
