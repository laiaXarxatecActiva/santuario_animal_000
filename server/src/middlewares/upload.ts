import { MAX_FILES_PER_UPLOAD, VIDEO_MAX_BYTES } from '@sanctuary/shared';
import type { Request, RequestHandler } from 'express';
import multer from 'multer';
import type { ArchivoSubido } from '../dominio/fotos.js';
import { FileTooLargeError, TooManyFilesError, ValidationError } from '../errors/app-error.js';

export const CAMPO_ARCHIVOS = 'files';

function traducir(error: unknown): unknown {
  if (!(error instanceof multer.MulterError)) return error;
  switch (error.code) {
    case 'LIMIT_FILE_COUNT':
      return new TooManyFilesError();
    case 'LIMIT_UNEXPECTED_FILE':
      return error.field === CAMPO_ARCHIVOS
        ? new TooManyFilesError()
        : new ValidationError([{ field: error.field ?? '', message: 'Campo de archivo no esperado.' }]);
    case 'LIMIT_FILE_SIZE':
      return new FileTooLargeError();
    default:
      return new ValidationError([{ field: error.field ?? '', message: 'La subida no es válida.' }]);
  }
}

/**
 * Recibe los archivos de `multipart/form-data` en memoria (TECH_SPEC §13):
 * como máximo 10, de hasta 50 MB (el límite de los vídeos; el de las imágenes
 * se comprueba después, archivo a archivo, para rechazar solo ese archivo).
 */
export function uploadFiles(): RequestHandler {
  const recibir = multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8',
    limits: { files: MAX_FILES_PER_UPLOAD, fileSize: VIDEO_MAX_BYTES, fields: 20, fieldSize: 100 * 1024 },
  }).array(CAMPO_ARCHIVOS, MAX_FILES_PER_UPLOAD);
  return (req, res, next) => {
    recibir(req, res, (error: unknown) => next(error ? traducir(error) : undefined));
  };
}

/** Archivos recibidos por `uploadFiles`, en el orden en que se enviaron. */
export function archivosSubidos(req: Request): ArchivoSubido[] {
  const files = Array.isArray(req.files) ? req.files : [];
  return files.map((f) => ({ nombre: f.originalname, mimeType: f.mimetype, size: f.size, buffer: f.buffer }));
}
