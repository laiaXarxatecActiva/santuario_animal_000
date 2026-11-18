import {
  adminActivityLogsQuerySchema,
  adminDonationMonthlyQuerySchema,
  adminDonationsExportQuerySchema,
  adminDonationsQuerySchema,
  manualDonationSchema,
  adminPaymentsExportQuerySchema,
  adminPaymentsQuerySchema,
  manualPaymentSchema,
  adminAdoptionCreateSchema,
  adminAdoptionsQuerySchema,
  adminAdoptionStatusSchema,
  adminAnimalsQuerySchema,
  adminUpdatesQuerySchema,
  adminUserPatchSchema,
  adminUsersQuerySchema,
  animalBodySchema,
  animalStatusBodySchema,
  coverBodySchema,
  idParamsSchema,
  photoOrderBodySchema,
  photoPatchBodySchema,
  photoUploadBodySchema,
  planCreateBodySchema,
  planUpdateBodySchema,
  speciesBodySchema,
  updateCreateBodySchema,
  updateEditBodySchema,
  WORKER_ROLES,
  workerCreateSchema,
} from '@sanctuary/shared';
import { Router } from 'express';
import { createActivityAdminController } from '../controllers/activity-admin.controller.js';
import { createAdoptionAdminController } from '../controllers/adoption-admin.controller.js';
import { createDonationAdminController } from '../controllers/donation-admin.controller.js';
import { createPaymentAdminController } from '../controllers/payment-admin.controller.js';
import { createAnimalAdminController } from '../controllers/animal-admin.controller.js';
import { createDashboardController } from '../controllers/dashboard.controller.js';
import { createJobController } from '../controllers/job.controller.js';
import { createPhotoAdminController } from '../controllers/photo-admin.controller.js';
import { createPlanAdminController } from '../controllers/plan-admin.controller.js';
import { createSpeciesAdminController } from '../controllers/species-admin.controller.js';
import { createUpdateAdminController } from '../controllers/update-admin.controller.js';
import { createUserAdminController } from '../controllers/user-admin.controller.js';
import { requireRole } from '../middlewares/auth.js';
import { uploadFiles } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import type { JobRunner } from '../jobs/registry.js';
import type { ActivityLogService } from '../services/activity-log.service.js';
import type { ActivityAdminService } from '../servicios/activity-admin.service.js';
import type { AdoptionAdminService } from '../servicios/adoption-admin.service.js';
import type { DonationAdminService } from '../servicios/donation-admin.service.js';
import type { PaymentAdminService } from '../servicios/payment-admin.service.js';
import type { AnimalAdminService } from '../servicios/animal-admin.service.js';
import type { DashboardService } from '../servicios/dashboard.service.js';
import type { PhotoAdminService } from '../servicios/photo-admin.service.js';
import type { PlanAdminService } from '../servicios/plan-admin.service.js';
import type { SpeciesAdminService } from '../servicios/species-admin.service.js';
import type { UpdateAdminService } from '../servicios/update-admin.service.js';
import type { UserAdminService } from '../servicios/user-admin.service.js';

export interface AdminRoutesDeps {
  dashboard: DashboardService;
  species: SpeciesAdminService;
  animals: AnimalAdminService;
  photos: PhotoAdminService;
  updates: UpdateAdminService;
  plans: PlanAdminService;
  users: UserAdminService;
  adoptions: AdoptionAdminService;
  payments: PaymentAdminService;
  donations: DonationAdminService;
  jobs: JobRunner;
  /** Anota las escrituras del panel (CU-42). */
  activity: ActivityLogService;
  activityLogs: ActivityAdminService;
}

// Panel del personal (TECH_SPEC §10.6), montado en /api/admin. Todo exige ser
// trabajador; los borrados y la administración (TECH_SPEC §10.7), además, administrador.
export function createAdminRoutes(deps: AdminRoutesDeps): Router {
  const router = Router();
  router.use(requireRole(...WORKER_ROLES));
  const soloAdmin = requireRole('admin');
  const conId = validate({ params: idParamsSchema });

  router.get('/dashboard', createDashboardController(deps.dashboard).get);

  const especies = createSpeciesAdminController(deps.species, deps.activity);
  router.get('/species', especies.list);
  router.post('/species', validate({ body: speciesBodySchema }), especies.create);
  router.put('/species/:id', validate({ params: idParamsSchema, body: speciesBodySchema }), especies.update);
  router.delete('/species/:id', soloAdmin, conId, especies.remove);

  const animales = createAnimalAdminController(deps.animals, deps.activity);
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
  const fotos = createPhotoAdminController(deps.photos, deps.activity);
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
  const actualizaciones = createUpdateAdminController(deps.updates, deps.activity);
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

  // CU-40: planes de adopción (TECH_SPEC §10.7), solo administradores.
  const planes = createPlanAdminController(deps.plans, deps.activity);
  router.get('/plans', soloAdmin, planes.list);
  router.post('/plans', soloAdmin, validate({ body: planCreateBodySchema }), planes.create);
  router.put('/plans/:id', soloAdmin, validate({ params: idParamsSchema, body: planUpdateBodySchema }), planes.update);

  // CU-35 y CU-36: usuarios y cuentas de trabajador (TECH_SPEC §10.7), solo administradores.
  const usuarios = createUserAdminController(deps.users, deps.activity);
  router.get('/users', soloAdmin, validate({ query: adminUsersQuerySchema }), usuarios.list);
  router.post('/users', soloAdmin, validate({ body: workerCreateSchema }), usuarios.create);
  router.get('/users/:id', soloAdmin, conId, usuarios.get);
  router.patch(
    '/users/:id',
    soloAdmin,
    validate({ params: idParamsSchema, body: adminUserPatchSchema }),
    usuarios.update,
  );
  router.post('/users/:id/invitation', soloAdmin, conId, usuarios.resendInvitation);

  // CU-37: adopciones (TECH_SPEC §10.7), solo administradores.
  const adopciones = createAdoptionAdminController(deps.adoptions, deps.activity);
  router.get('/adoptions', soloAdmin, validate({ query: adminAdoptionsQuerySchema }), adopciones.list);
  router.post('/adoptions', soloAdmin, validate({ body: adminAdoptionCreateSchema }), adopciones.create);
  router.get('/adoptions/:id', soloAdmin, conId, adopciones.get);
  router.patch(
    '/adoptions/:id/status',
    soloAdmin,
    validate({ params: idParamsSchema, body: adminAdoptionStatusSchema }),
    adopciones.changeStatus,
  );

  // CU-38: pagos (TECH_SPEC §10.7), solo administradores. `export.csv` va antes que `/:id`.
  const pagos = createPaymentAdminController(deps.payments, deps.activity);
  router.get('/payments', soloAdmin, validate({ query: adminPaymentsQuerySchema }), pagos.list);
  router.get('/payments/export.csv', soloAdmin, validate({ query: adminPaymentsExportQuerySchema }), pagos.exportCsv);
  router.post('/payments', soloAdmin, validate({ body: manualPaymentSchema }), pagos.create);
  router.post('/payments/:id/refund', soloAdmin, conId, pagos.refund);

  // CU-39: donaciones, solo administradores. `export.csv` y `monthly-totals` van antes que `/:id`.
  const donaciones = createDonationAdminController(deps.donations, deps.activity);
  router.get('/donations', soloAdmin, validate({ query: adminDonationsQuerySchema }), donaciones.list);
  router.get(
    '/donations/export.csv',
    soloAdmin,
    validate({ query: adminDonationsExportQuerySchema }),
    donaciones.exportCsv,
  );
  router.get(
    '/donations/monthly-totals',
    soloAdmin,
    validate({ query: adminDonationMonthlyQuerySchema }),
    donaciones.monthlyTotals,
  );
  router.post('/donations', soloAdmin, validate({ body: manualDonationSchema }), donaciones.create);
  router.post('/donations/:id/refund', soloAdmin, conId, donaciones.refund);

  // CU-42: registro de actividad, solo lectura y solo administradores.
  const actividad = createActivityAdminController(deps.activityLogs);
  router.get('/activity-logs', soloAdmin, validate({ query: adminActivityLogsQuerySchema }), actividad.list);

  // CU-43 a CU-47: tareas programadas lanzadas a mano, solo administradores.
  router.post('/jobs/:jobName/run', soloAdmin, createJobController(deps.jobs).run);

  return router;
}
