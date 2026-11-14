import {
  adminAnimalsQuerySchema,
  adminUpdatesQuerySchema,
  animalBodySchema,
  animalStatusBodySchema,
  coverBodySchema,
  idParamsSchema,
  photoOrderBodySchema,
  photoPatchBodySchema,
  photoUploadBodySchema,
  speciesBodySchema,
  updateCreateBodySchema,
  updateEditBodySchema,
  WORKER_ROLES,
} from '@sanctuary/shared';
import { Router } from 'express';
import { createAnimalAdminController } from '../controllers/animal-admin.controller.js';
import { createDashboardController } from '../controllers/dashboard.controller.js';
import { createPhotoAdminController } from '../controllers/photo-admin.controller.js';
import { createSpeciesAdminController } from '../controllers/species-admin.controller.js';
import { createUpdateAdminController } from '../controllers/update-admin.controller.js';
import { requireRole } from '../middlewares/auth.js';
import { uploadFiles } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import type { AnimalAdminService } from '../servicios/animal-admin.service.js';
import type { DashboardService } from '../servicios/dashboard.service.js';
import type { PhotoAdminService } from '../servicios/photo-admin.service.js';
import type { SpeciesAdminService } from '../servicios/species-admin.service.js';
import type { UpdateAdminService } from '../servicios/update-admin.service.js';

export interface AdminRoutesDeps {
  dashboard: DashboardService;
  species: SpeciesAdminService;
  animals: AnimalAdminService;
  photos: PhotoAdminService;
  updates: UpdateAdminService;
}

// Panel del personal (TECH_SPEC §10.6), montado en /api/admin. Todo exige ser
// trabajador; los borrados, además, administrador.
export function createAdminRoutes(deps: AdminRoutesDeps): Router {
  const router = Router();
  router.use(requireRole(...WORKER_ROLES));
  const soloAdmin = requireRole('admin');
  const conId = validate({ params: idParamsSchema });

  router.get('/dashboard', createDashboardController(deps.dashboard).get);

  const especies = createSpeciesAdminController(deps.species);
  router.get('/species', especies.list);
  router.post('/species', validate({ body: speciesBodySchema }), especies.create);
  router.put('/species/:id', validate({ params: idParamsSchema, body: speciesBodySchema }), especies.update);
  router.delete('/species/:id', soloAdmin, conId, especies.remove);

  const animales = createAnimalAdminController(deps.animals);
  router.get('/animals', validate({ query: adminAnimalsQuerySchema }), animales.list);
  router.post('/animals', validate({ body: animalBodySchema }), animales.create);
  router.get('/animals/:id', conId, animales.get);
  router.put('/animals/:id', validate({ params: idParamsSchema, body: animalBodySchema }), animales.update);
  router.patch(
    '/animals/:id/status',
    validate({ params: idParamsSchema, body: animalStatusBodySchema }),
    animales.changeStatus,
  );
  router.delete('/animals/:id', soloAdmin, conId, animales.remove);

  // CU-29: la galería de cada animal.
  const fotos = createPhotoAdminController(deps.photos);
  router.get('/animals/:id/photos', conId, fotos.list);
  router.post(
    '/animals/:id/photos',
    conId,
    uploadFiles(),
    validate({ params: idParamsSchema, body: photoUploadBodySchema }),
    fotos.upload,
  );
  router.put(
    '/animals/:id/photos/order',
    validate({ params: idParamsSchema, body: photoOrderBodySchema }),
    fotos.reorder,
  );
  router.put('/animals/:id/cover', validate({ params: idParamsSchema, body: coverBodySchema }), fotos.setCover);
  router.patch('/photos/:id', validate({ params: idParamsSchema, body: photoPatchBodySchema }), fotos.update);
  router.delete('/photos/:id', conId, fotos.remove);

  // CU-31 y CU-32: actualizaciones (en multipart si llevan archivos). Editar y
  // borrar exige ser el autor o administrador: lo comprueba el caso de uso.
  const actualizaciones = createUpdateAdminController(deps.updates);
  router.get('/updates', validate({ query: adminUpdatesQuerySchema }), actualizaciones.list);
  router.post('/updates', uploadFiles(), validate({ body: updateCreateBodySchema }), actualizaciones.create);
  router.get('/updates/:id', conId, actualizaciones.get);
  router.put(
    '/updates/:id',
    conId,
    uploadFiles(),
    validate({ params: idParamsSchema, body: updateEditBodySchema }),
    actualizaciones.update,
  );
  router.delete('/updates/:id', conId, actualizaciones.remove);

  return router;
}
