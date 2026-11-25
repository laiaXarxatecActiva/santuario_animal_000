import type {
  AlertSettingsBody,
  AlertSettingsDto,
  HandoverNoteBody,
  HandoverNoteDto,
  IncidentBody,
  IncidentDto,
  IncidentStatusBody,
  IncidentSummaryDto,
  IncidentsQuery,
  Paginated,
  TodayDto,
  AnimalCareDto,
  DietItemBody,
  DietItemDto,
  IntakeLevel,
  MedicationPlanBody,
  MedicationPlanDto,
  VetRecordBody,
  VetVisitBody,
  VetVisitDto,
  AbsenceBody,
  AbsenceCreatedDto,
  AbsenceDto,
  AdminTasksQuery,
  CopyWeekResultDto,
  ShiftAssignmentBody,
  ShiftAssignmentDto,
  ShiftsCalendarDto,
  MyShiftsDto,
  ShiftTemplateBody,
  ShiftTemplateDto,
  MyDayDto,
  OneOffTaskBody,
  QualificationBody,
  QualificationDto,
  TaskAssigneeBody,
  TaskDto,
  TaskTemplateBody,
  TaskTemplateDto,
  UserQualificationsDto,
  WorkSettingsBody,
  WorkSettingsDto,
  ZoneBody,
  ZoneDto,
} from '@sanctuary/shared';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from './client';

export type AdminTasksParams = Partial<AdminTasksQuery>;
export type IncidentsParams = Partial<IncidentsQuery>;

// Trabajo diario del personal (CU-52 en adelante), dentro del panel.
export const workApi = {
  // CU-52.
  zones: {
    list: () => apiGet<{ data: ZoneDto[] }>('/api/admin/zones'),
    create: (body: ZoneBody) => apiPost<ZoneDto>('/api/admin/zones', body),
    update: (id: number, body: ZoneBody) => apiPut<ZoneDto>(`/api/admin/zones/${id}`, body),
    remove: (id: number) => apiDelete(`/api/admin/zones/${id}`),
  },

  // CU-53.
  qualifications: {
    list: () => apiGet<{ data: QualificationDto[] }>('/api/admin/qualifications'),
    create: (body: QualificationBody) => apiPost<QualificationDto>('/api/admin/qualifications', body),
    update: (id: number, body: QualificationBody) => apiPut<QualificationDto>(`/api/admin/qualifications/${id}`, body),
    remove: (id: number) => apiDelete(`/api/admin/qualifications/${id}`),
    ofUser: (userId: number) => apiGet<UserQualificationsDto>(`/api/admin/users/${userId}/qualifications`),
    setOfUser: (userId: number, qualificationIds: number[]) =>
      apiPut<UserQualificationsDto>(`/api/admin/users/${userId}/qualifications`, { qualificationIds }),
  },

  // CU-54.
  templates: {
    list: () => apiGet<{ data: TaskTemplateDto[] }>('/api/admin/task-templates'),
    get: (id: number) => apiGet<TaskTemplateDto>(`/api/admin/task-templates/${id}`),
    create: (body: TaskTemplateBody) => apiPost<TaskTemplateDto>('/api/admin/task-templates', body),
    update: (id: number, body: TaskTemplateBody) => apiPut<TaskTemplateDto>(`/api/admin/task-templates/${id}`, body),
    remove: (id: number) => apiDelete(`/api/admin/task-templates/${id}`),
  },

  // CU-55 a CU-57.
  myDay: (date?: string) => apiGet<MyDayDto>('/api/admin/my-day', { date }),
  tasks: {
    list: (params: AdminTasksParams) => apiGet<{ data: TaskDto[] }>('/api/admin/tasks', params),
    create: (body: OneOffTaskBody) => apiPost<TaskDto>('/api/admin/tasks', body),
    setAssignee: (id: number, body: TaskAssigneeBody) => apiPatch<TaskDto>(`/api/admin/tasks/${id}/assignee`, body),
    remove: (id: number) => apiDelete(`/api/admin/tasks/${id}`),
    /** Con un toque o con observaciones. En las comidas, lo que ha comido cada animal (CU-66). */
    complete: (
      id: number,
      datos: { observations?: string; intakes?: { animalId: number; intake: IntakeLevel }[] } = {},
    ) => {
      const intakes = datos.intakes && datos.intakes.length > 0 ? datos.intakes : undefined;
      return apiPost<TaskDto>(`/api/admin/tasks/${id}/complete`, { observations: datos.observations, intakes });
    },
    notDone: (id: number, reason: string) => apiPost<TaskDto>(`/api/admin/tasks/${id}/not-done`, { reason }),
    reopen: (id: number) => apiPost<TaskDto>(`/api/admin/tasks/${id}/reopen`),
  },

  // CU-60.
  shiftTemplates: {
    list: () => apiGet<{ data: ShiftTemplateDto[] }>('/api/admin/shift-templates'),
    create: (body: ShiftTemplateBody) => apiPost<ShiftTemplateDto>('/api/admin/shift-templates', body),
    update: (id: number, body: ShiftTemplateBody) => apiPut<ShiftTemplateDto>(`/api/admin/shift-templates/${id}`, body),
    remove: (id: number) => apiDelete(`/api/admin/shift-templates/${id}`),
  },

  // CU-61 y CU-63. Sin `from`, la semana actual.
  shifts: {
    calendar: (from?: string, to?: string) => apiGet<ShiftsCalendarDto>('/api/admin/shifts', { from, to }),
    /** CU-63: «Mis fichajes». */
    mine: (from?: string, to?: string) => apiGet<MyShiftsDto>('/api/admin/my-shifts', { from, to }),
    assign: (body: ShiftAssignmentBody) => apiPost<ShiftAssignmentDto>('/api/admin/shift-assignments', body),
    unassign: (id: number) => apiDelete(`/api/admin/shift-assignments/${id}`),
    copyWeek: (weekStart: string) =>
      apiPost<CopyWeekResultDto>('/api/admin/shift-assignments/copy-week', { weekStart }),
    checkIn: (id: number) => apiPost<ShiftAssignmentDto>(`/api/admin/shift-assignments/${id}/check-in`),
    checkOut: (id: number) => apiPost<ShiftAssignmentDto>(`/api/admin/shift-assignments/${id}/check-out`),
  },

  // CU-62.
  absences: {
    list: () => apiGet<{ data: AbsenceDto[] }>('/api/admin/absences'),
    create: (body: AbsenceBody) => apiPost<AbsenceCreatedDto>('/api/admin/absences', body),
    remove: (id: number) => apiDelete(`/api/admin/absences/${id}`),
  },

  // CU-65 a CU-69: pestaña «Cuidados» de la ficha del animal.
  care: {
    get: (animalId: number) => apiGet<AnimalCareDto>(`/api/admin/animals/${animalId}/care`),
    createDietItem: (animalId: number, body: DietItemBody) =>
      apiPost<DietItemDto>(`/api/admin/animals/${animalId}/diet-items`, body),
    updateDietItem: (id: number, body: DietItemBody) => apiPut<DietItemDto>(`/api/admin/diet-items/${id}`, body),
    removeDietItem: (id: number) => apiDelete(`/api/admin/diet-items/${id}`),
    createPlan: (animalId: number, body: MedicationPlanBody) =>
      apiPost<MedicationPlanDto>(`/api/admin/animals/${animalId}/medication-plans`, body),
    updatePlan: (id: number, body: MedicationPlanBody) =>
      apiPut<MedicationPlanDto>(`/api/admin/medication-plans/${id}`, body),
    endPlan: (id: number) => apiPost<MedicationPlanDto>(`/api/admin/medication-plans/${id}/end`),
    removePlan: (id: number) => apiDelete(`/api/admin/medication-plans/${id}`),
    createVisit: (animalId: number, body: VetVisitBody) =>
      apiPost<VetVisitDto>(`/api/admin/animals/${animalId}/vet-visits`, body),
    updateVisit: (id: number, body: VetVisitBody) => apiPut<VetVisitDto>(`/api/admin/vet-visits/${id}`, body),
    cancelVisit: (id: number) => apiPost<VetVisitDto>(`/api/admin/vet-visits/${id}/cancel`),
    completeVisit: (id: number, body: VetRecordBody) =>
      apiPost<VetVisitDto>(`/api/admin/vet-visits/${id}/complete`, body),
  },

  // CU-73.
  settings: {
    get: () => apiGet<WorkSettingsDto>('/api/admin/work-settings'),
    update: (body: WorkSettingsBody) => apiPut<WorkSettingsDto>('/api/admin/work-settings', body),
  },

  // CU-70: incidencias.
  incidents: {
    list: (params: IncidentsParams = {}) => apiGet<Paginated<IncidentDto>>('/api/admin/incidents', params),
    summary: () => apiGet<IncidentSummaryDto>('/api/admin/incidents/summary'),
    get: (id: number) => apiGet<IncidentDto>(`/api/admin/incidents/${id}`),
    /** Con foto va en multipart (`files`). */
    create: (body: IncidentBody, photo?: File) => {
      if (!photo) return apiPost<IncidentDto>('/api/admin/incidents', body);
      const form = new FormData();
      for (const [clave, valor] of Object.entries(body)) {
        if (valor !== null && valor !== undefined && valor !== '') form.append(clave, String(valor));
      }
      form.append('files', photo);
      return apiUpload<IncidentDto>('/api/admin/incidents', form);
    },
    setStatus: (id: number, body: IncidentStatusBody) =>
      apiPatch<IncidentDto>(`/api/admin/incidents/${id}/status`, body),
    createTask: (id: number, body: OneOffTaskBody) =>
      apiPost<{ incident: IncidentDto; task: TaskDto }>(`/api/admin/incidents/${id}/task`, body),
  },

  // CU-71: notas de relevo.
  handover: {
    list: () => apiGet<{ data: HandoverNoteDto[] }>('/api/admin/handover-notes'),
    create: (body: HandoverNoteBody) => apiPost<HandoverNoteDto>('/api/admin/handover-notes', body),
    markRead: (id: number) => apiPut<HandoverNoteDto>(`/api/admin/handover-notes/${id}/read`, {}),
  },

  // CU-72: panel «Hoy».
  today: () => apiGet<TodayDto>('/api/admin/today'),

  // CU-73 y CU-74: avisos por email y resumen diario.
  alertSettings: {
    get: () => apiGet<AlertSettingsDto>('/api/admin/alert-settings'),
    update: (body: AlertSettingsBody) => apiPut<AlertSettingsDto>('/api/admin/alert-settings', body),
  },
};
