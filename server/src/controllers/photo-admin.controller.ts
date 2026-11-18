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
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { PhotoAdminService } from '../servicios/photo-admin.service.js';

// CU-29: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createPhotoAdminController(service: PhotoAdminService, actividad: ActivityLogService = sinRegistro) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json({ data: await service.list(id(res)) });
  };
  const upload: RequestHandler = async (req, res) => {
    const { meta } = validated(res, 'body', photoUploadBodySchema);
    const resultado = await service.upload(id(res), req.user!.id, archivosSubidos(req), meta);
    for (const foto of resultado.created) {
      await actividad.log(req.user!.id, 'create', 'photos', foto.id, { animalId: id(res) });
    }
    res.status(resultado.created.length > 0 ? 201 : 200).json(resultado);
  };
  const update: RequestHandler = async (req, res) => {
    const datos = validated(res, 'body', photoPatchBodySchema);
    const foto = await service.update(id(res), datos);
    await actividad.log(req.user!.id, 'update', 'photos', foto.id, { ...datos });
    res.json(foto);
  };
  const reorder: RequestHandler = async (req, res) => {
    const { photoIds } = validated(res, 'body', photoOrderBodySchema);
    await service.reorder(id(res), photoIds);
    await actividad.log(req.user!.id, 'update', 'animals', id(res), { photoOrder: photoIds });
    res.status(204).end();
  };
  const setCover: RequestHandler = async (req, res) => {
    const { photoId } = validated(res, 'body', coverBodySchema);
    await service.setCover(id(res), photoId);
    await actividad.log(req.user!.id, 'update', 'animals', id(res), { coverPhotoId: photoId });
    res.status(204).end();
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(id(res));
    await actividad.log(req.user!.id, 'delete', 'photos', id(res));
    res.status(204).end();
  };
  return { list, upload, update, reorder, setCover, remove };
}
