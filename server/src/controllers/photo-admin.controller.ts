import {
  coverBodySchema,
  idParamsSchema,
  photoOrderBodySchema,
  photoPatchBodySchema,
  photoUploadBodySchema,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { archivosSubidos } from '../middlewares/upload.js';
import { validated } from '../middlewares/validate.js';
import type { PhotoAdminService } from '../servicios/photo-admin.service.js';

// CU-29: solo llaman al caso de uso.
export function createPhotoAdminController(service: PhotoAdminService) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json({ data: await service.list(id(res)) });
  };
  const upload: RequestHandler = async (req, res) => {
    const { meta } = validated(res, 'body', photoUploadBodySchema);
    const resultado = await service.upload(id(res), req.user!.id, archivosSubidos(req), meta);
    res.status(resultado.created.length > 0 ? 201 : 200).json(resultado);
  };
  const update: RequestHandler = async (_req, res) => {
    res.json(await service.update(id(res), validated(res, 'body', photoPatchBodySchema)));
  };
  const reorder: RequestHandler = async (_req, res) => {
    await service.reorder(id(res), validated(res, 'body', photoOrderBodySchema).photoIds);
    res.status(204).end();
  };
  const setCover: RequestHandler = async (_req, res) => {
    await service.setCover(id(res), validated(res, 'body', coverBodySchema).photoId);
    res.status(204).end();
  };
  const remove: RequestHandler = async (_req, res) => {
    await service.remove(id(res));
    res.status(204).end();
  };
  return { list, upload, update, reorder, setCover, remove };
}
