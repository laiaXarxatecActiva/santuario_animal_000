import { idParamsSchema, pdfQuerySchema } from '@sanctuary/shared';
import type { RequestHandler, Response } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import type { DocumentoPdf, DocumentService } from '../servicios/document.service.js';

/** Envía el PDF: en el navegador o, con `?download=1`, como descarga. Nunca se guarda en caché. */
function enviarPdf(res: Response, { filename, pdf }: DocumentoPdf) {
  const modo = validated(res, 'query', pdfQuerySchema).download ? 'attachment' : 'inline';
  res
    .status(200)
    .set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${modo}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    })
    .send(pdf);
}

// CU-22 y CU-19: solo llaman al caso de uso.
export function createDocumentController(service: DocumentService) {
  const userId = (req: Parameters<RequestHandler>[0]) => {
    if (!req.user) throw new UnauthorizedError();
    return req.user.id;
  };
  const id = (res: Response) => validated(res, 'params', idParamsSchema).id;

  const certificate: RequestHandler = async (req, res) => {
    enviarPdf(res, await service.certificate(userId(req), id(res)));
  };
  const paymentReceipt: RequestHandler = async (req, res) => {
    enviarPdf(res, await service.paymentReceipt(userId(req), id(res)));
  };
  const donationReceipt: RequestHandler = async (req, res) => {
    enviarPdf(res, await service.donationReceipt(userId(req), id(res)));
  };
  return { certificate, paymentReceipt, donationReceipt };
}
