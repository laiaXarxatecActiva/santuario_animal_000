import {
  absenceBodySchema,
  alertSettingsBodySchema,
  handoverNoteBodySchema,
  incidentBodySchema,
  incidentStatusBodySchema,
  incidentsQuerySchema,
  absencesQuerySchema,
  copyWeekBodySchema,
  shiftAssignmentBodySchema,
  shiftsQuerySchema,
  shiftTemplateBodySchema,
  adminActivityLogsQuerySchema,
  adminStatsQuerySchema,
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
  adminUserLogoutAllSchema,
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
  vetRecordBodySchema,
  vetVisitBodySchema,
  dietItemBodySchema,
  medicationPlanBodySchema,
  WORKER_ROLES,
  workerCreateSchema,
  adminTasksQuerySchema,
  myDayQuerySchema,
  oneOffTaskBodySchema,
  qualificationBodySchema,
  taskAssigneeBodySchema,
  taskCompleteBodySchema,
  taskNotDoneBodySchema,
  taskTemplateBodySchema,
  userQualificationsBodySchema,
  workSettingsBodySchema,
  zoneBodySchema,
} from '@sanctuary/shared';
import { Router } from 'express';
import { createActivityAdminController } from '../controllers/activity-admin.controller.js';
import { createAdoptionAdminController } from '../controllers/adoption-admin.controller.js';
import { createDonationAdminController } from '../controllers/donation-admin.controller.js';
import { createPaymentAdminController } from '../controllers/payment-admin.controller.js';
import { createAnimalAdminController } from '../controllers/animal-admin.controller.js';
import { createDashboardController } from '../controllers/dashboard.controller.js';
import { createStatsAdminController } from '../controllers/stats-admin.controller.js';
import { createJobController } from '../controllers/job.controller.js';
import { createPhotoAdminController } from '../controllers/photo-admin.controller.js';
import { createPlanAdminController } from '../controllers/plan-admin.controller.js';
import { createSpeciesAdminController } from '../controllers/species-admin.controller.js';
import { createUpdateAdminController } from '../controllers/update-admin.controller.js';
import { createVetRecordAdminController } from '../controllers/vet-record-admin.controller.js';
import { createUserAdminController } from '../controllers/user-admin.controller.js';
import {
  createShiftController,
  createTaskController,
  createTaskTemplateAdminController,
  createZoneAdminController,
} from '../controllers/work-admin.controller.js';
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
import type { StatsAdminService } from '../servicios/stats-admin.service.js';
import type { PhotoAdminService } from '../servicios/photo-admin.service.js';
import type { PlanAdminService } from '../servicios/plan-admin.service.js';
import type { SpeciesAdminService } from '../servicios/species-admin.service.js';
import type { UpdateAdminService } from '../servicios/update-admin.service.js';
import type { UserAdminService } from '../servicios/user-admin.service.js';
import type { VetRecordAdminService } from '../servicios/vet-record-admin.service.js';
import type { TaskTemplateAdminService } from '../servicios/task-template-admin.service.js';
import type { ShiftService } from '../servicios/shift.service.js';
import type { TaskService } from '../servicios/task.service.js';
import type { CareService } from '../servicios/care.service.js';
import { createCareAdminController } from '../controllers/care-admin.controller.js';
import { createDailyAdminController, type DailyAdminServices } from '../controllers/daily-admin.controller.js';
import type { ZoneAdminService } from '../servicios/zone-admin.service.js';

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
  vetRecords: VetRecordAdminService;
  jobs: JobRunner;
  /** Anota las escrituras del panel (CU-42). */
  activity: ActivityLogService;
  activityLogs: ActivityAdminService;
  stats: StatsAdminService;
  /** Trabajo diario del personal (CU-52 en adelante). */
  zones: ZoneAdminService;
  taskTemplates: TaskTemplateAdminService;
  tasks: TaskService;
  shifts: ShiftService;
  care: CareService;
  /** CU-70 a CU-74: incidencias, relevo, panel «Hoy» y avisos por email. */
  daily: DailyAdminServices;
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

  // CU-34: historial veterinario (interno). Borrar, solo administradores.
  const veterinario = createVetRecordAdminController(deps.vetRecords, deps.activity);
  router.get('/animals/:id/vet-records', conId, veterinario.list);
  router.post(
    '/animals/:id/vet-records',
    validate({ params: idParamsSchema, body: vetRecordBodySchema }),
    veterinario.create,
  );
  router.put('/vet-records/:id', validate({ params: idParamsSchema, body: vetRecordBodySchema }), veterinario.update);
  router.delete('/vet-records/:id', soloAdmin, conId, veterinario.remove);

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
  // CU-51: enlace para que un trabajador cambie su contraseña.
  router.post('/users/:id/password-reset', soloAdmin, conId, usuarios.sendPasswordReset);
  // CU-48: cerrar todas las sesiones de un usuario, solo con motivo.
  router.post(
    '/users/:id/logout-all',
    soloAdmin,
    validate({ params: idParamsSchema, body: adminUserLogoutAllSchema }),
    usuarios.logoutAll,
  );

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

  // CU-41: estadísticas, solo lectura y solo administradores.
  router.get(
    '/stats',
    soloAdmin,
    validate({ query: adminStatsQuerySchema }),
    createStatsAdminController(deps.stats).get,
  );

  // CU-52 y CU-53: zonas y cualificaciones. Las ve todo el personal; las cambia el administrador.
  const zonas = createZoneAdminController(deps.zones, deps.activity);
  router.get('/zones', zonas.listZones);
  router.post('/zones', soloAdmin, validate({ body: zoneBodySchema }), zonas.createZone);
  router.put('/zones/:id', soloAdmin, validate({ params: idParamsSchema, body: zoneBodySchema }), zonas.updateZone);
  router.delete('/zones/:id', soloAdmin, conId, zonas.removeZone);
  router.get('/qualifications', zonas.listQualifications);
  router.post('/qualifications', soloAdmin, validate({ body: qualificationBodySchema }), zonas.createQualification);
  router.put(
    '/qualifications/:id',
    soloAdmin,
    validate({ params: idParamsSchema, body: qualificationBodySchema }),
    zonas.updateQualification,
  );
  router.delete('/qualifications/:id', soloAdmin, conId, zonas.removeQualification);
  router.get('/users/:id/qualifications', soloAdmin, conId, zonas.getUserQualifications);
  router.put(
    '/users/:id/qualifications',
    soloAdmin,
    validate({ params: idParamsSchema, body: userQualificationsBodySchema }),
    zonas.setUserQualifications,
  );

  // CU-54: plantillas de tareas, solo administradores.
  const plantillas = createTaskTemplateAdminController(deps.taskTemplates, deps.activity);
  router.get('/task-templates', soloAdmin, plantillas.list);
  router.post('/task-templates', soloAdmin, validate({ body: taskTemplateBodySchema }), plantillas.create);
  router.get('/task-templates/:id', soloAdmin, conId, plantillas.get);
  router.put(
    '/task-templates/:id',
    soloAdmin,
    validate({ params: idParamsSchema, body: taskTemplateBodySchema }),
    plantillas.update,
  );
  router.delete('/task-templates/:id', soloAdmin, conId, plantillas.remove);

  // CU-55 a CU-57: «Mi día» y las tareas. Completar admite una foto (multipart).
  const tareas = createTaskController(deps.tasks, deps.activity);
  router.get('/my-day', validate({ query: myDayQuerySchema }), tareas.myDay);
  router.get('/tasks', soloAdmin, validate({ query: adminTasksQuerySchema }), tareas.list);
  router.post('/tasks', soloAdmin, validate({ body: oneOffTaskBodySchema }), tareas.create);
  router.patch(
    '/tasks/:id/assignee',
    soloAdmin,
    validate({ params: idParamsSchema, body: taskAssigneeBodySchema }),
    tareas.setAssignee,
  );
  router.delete('/tasks/:id', soloAdmin, conId, tareas.remove);
  router.post(
    '/tasks/:id/complete',
    conId,
    uploadFiles(),
    validate({ params: idParamsSchema, body: taskCompleteBodySchema }),
    tareas.complete,
  );
  router.post('/tasks/:id/not-done', validate({ params: idParamsSchema, body: taskNotDoneBodySchema }), tareas.notDone);
  router.post('/tasks/:id/reopen', conId, tareas.reopen);

  // CU-73: ajustes del trabajo diario, solo administradores.
  router.get('/work-settings', soloAdmin, tareas.settings);
  router.put('/work-settings', soloAdmin, validate({ body: workSettingsBodySchema }), tareas.updateSettings);

  // CU-60 a CU-63: turnos. Los consulta todo el personal; los cambia el administrador.
  // Cada persona ficha sus propios turnos y las ausencias son solo del administrador.
  const turnos = createShiftController(deps.shifts, deps.activity);
  router.get('/shift-templates', turnos.listTemplates);
  router.post('/shift-templates', soloAdmin, validate({ body: shiftTemplateBodySchema }), turnos.createTemplate);
  router.put(
    '/shift-templates/:id',
    soloAdmin,
    validate({ params: idParamsSchema, body: shiftTemplateBodySchema }),
    turnos.updateTemplate,
  );
  router.delete('/shift-templates/:id', soloAdmin, conId, turnos.removeTemplate);
  router.get('/shifts', validate({ query: shiftsQuerySchema }), turnos.calendar);
  router.post('/shift-assignments', soloAdmin, validate({ body: shiftAssignmentBodySchema }), turnos.createAssignment);
  router.post('/shift-assignments/copy-week', soloAdmin, validate({ body: copyWeekBodySchema }), turnos.copyWeek);
  router.delete('/shift-assignments/:id', soloAdmin, conId, turnos.removeAssignment);
  router.post('/shift-assignments/:id/check-in', conId, turnos.checkIn);
  router.post('/shift-assignments/:id/check-out', conId, turnos.checkOut);
  router.get('/absences', soloAdmin, validate({ query: absencesQuerySchema }), turnos.listAbsences);
  router.post('/absences', soloAdmin, validate({ body: absenceBodySchema }), turnos.createAbsence);
  router.delete('/absences/:id', soloAdmin, conId, turnos.removeAbsence);

  // CU-65 a CU-69: pestaña «Cuidados» (dieta, medicación y visitas), de todo el personal.
  const cuidados = createCareAdminController(deps.care, deps.activity);
  router.get('/animals/:id/care', conId, cuidados.get);
  router.post(
    '/animals/:id/diet-items',
    validate({ params: idParamsSchema, body: dietItemBodySchema }),
    cuidados.createDietItem,
  );
  router.put(
    '/diet-items/:id',
    validate({ params: idParamsSchema, body: dietItemBodySchema }),
    cuidados.updateDietItem,
  );
  router.delete('/diet-items/:id', conId, cuidados.removeDietItem);
  router.post(
    '/animals/:id/medication-plans',
    validate({ params: idParamsSchema, body: medicationPlanBodySchema }),
    cuidados.createPlan,
  );
  router.put(
    '/medication-plans/:id',
    validate({ params: idParamsSchema, body: medicationPlanBodySchema }),
    cuidados.updatePlan,
  );
  router.post('/medication-plans/:id/end', conId, cuidados.endPlan);
  router.delete('/medication-plans/:id', conId, cuidados.removePlan);
  router.post(
    '/animals/:id/vet-visits',
    validate({ params: idParamsSchema, body: vetVisitBodySchema }),
    cuidados.createVisit,
  );
  router.put('/vet-visits/:id', validate({ params: idParamsSchema, body: vetVisitBodySchema }), cuidados.updateVisit);
  router.post('/vet-visits/:id/cancel', conId, cuidados.cancelVisit);
  router.post(
    '/vet-visits/:id/complete',
    validate({ params: idParamsSchema, body: vetRecordBodySchema }),
    cuidados.completeVisit,
  );

  // CU-70 a CU-74: incidencias, notas de relevo, panel «Hoy» y avisos por email.
  const diario = createDailyAdminController(deps.daily, deps.activity);
  router.get('/incidents', validate({ query: incidentsQuerySchema }), diario.listIncidents);
  router.post('/incidents', uploadFiles(), validate({ body: incidentBodySchema }), diario.createIncident);
  router.get('/incidents/:id', conId, diario.getIncident);
  router.patch(
    '/incidents/:id/status',
    soloAdmin,
    validate({ params: idParamsSchema, body: incidentStatusBodySchema }),
    diario.setIncidentStatus,
  );
  router.post(
    '/incidents/:id/task',
    soloAdmin,
    validate({ params: idParamsSchema, body: oneOffTaskBodySchema }),
    diario.createIncidentTask,
  );
  router.get('/handover-notes', diario.listNotes);
  router.post('/handover-notes', validate({ body: handoverNoteBodySchema }), diario.createNote);
  router.put('/handover-notes/:id/read', conId, diario.readNote);
  router.get('/today', soloAdmin, diario.today);
  router.get('/alert-settings', soloAdmin, diario.alertSettings);
  router.put('/alert-settings', soloAdmin, validate({ body: alertSettingsBodySchema }), diario.updateAlertSettings);

  // CU-43 a CU-47: tareas programadas lanzadas a mano, solo administradores.
  router.post('/jobs/:jobName/run', soloAdmin, createJobController(deps.jobs).run);

  return router;
}
