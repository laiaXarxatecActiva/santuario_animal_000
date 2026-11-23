import type {
  AbsenceBody,
  AbsenceCreatedDto,
  AbsenceDto,
  AdminTasksQuery,
  CopyWeekResultDto,
  ShiftAssignmentBody,
  ShiftAssignmentDto,
  ShiftsCalendarDto,
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
    /** Con un toque (JSON) o con observaciones y foto (multipart). */
    complete: (id: number, datos: { observations?: string; photo?: File } = {}) => {
      if (!datos.photo)
        return apiPost<TaskDto>(`/api/admin/tasks/${id}/complete`, { observations: datos.observations });
      const form = new FormData();
      if (datos.observations) form.append('observations', datos.observations);
      form.append('files', datos.photo);
      return apiUpload<TaskDto>(`/api/admin/tasks/${id}/complete`, form);
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

  // CU-73.
  settings: {
    get: () => apiGet<WorkSettingsDto>('/api/admin/work-settings'),
    update: (body: WorkSettingsBody) => apiPut<WorkSettingsDto>('/api/admin/work-settings', body),
  },
};
