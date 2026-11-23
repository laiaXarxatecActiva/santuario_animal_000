import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { workApi, type AdminTasksParams } from '../api/work';
import { ADMIN_KEY } from './useAdmin';

// Trabajo diario del personal (CU-52 en adelante).
export const WORK_KEY = [...ADMIN_KEY, 'work'] as const;
export const ZONES_KEY = [...WORK_KEY, 'zones'] as const;
export const QUALIFICATIONS_KEY = [...WORK_KEY, 'qualifications'] as const;
export const TEMPLATES_KEY = [...WORK_KEY, 'templates'] as const;
export const TASKS_KEY = [...WORK_KEY, 'tasks'] as const;
export const SHIFTS_KEY = [...WORK_KEY, 'shifts'] as const;

/** CU-52: zonas (también para los formularios). */
export const useZones = () =>
  useQuery({ queryKey: ZONES_KEY, queryFn: () => workApi.zones.list().then((r) => r.data) });

/** CU-53. */
export const useQualifications = () =>
  useQuery({ queryKey: QUALIFICATIONS_KEY, queryFn: () => workApi.qualifications.list().then((r) => r.data) });

export const userQualificationsKey = (userId: number) => [...QUALIFICATIONS_KEY, 'user', userId] as const;

/** CU-53 paso 3: cualificaciones de un trabajador. */
export const useUserQualifications = (userId: number | undefined, enabled = true) =>
  useQuery({
    queryKey: userQualificationsKey(userId ?? 0),
    queryFn: () => workApi.qualifications.ofUser(userId ?? 0),
    enabled: enabled && userId !== undefined,
  });

/** CU-54. */
export const useTaskTemplates = () =>
  useQuery({ queryKey: TEMPLATES_KEY, queryFn: () => workApi.templates.list().then((r) => r.data) });

export const useTaskTemplate = (id: number | undefined) =>
  useQuery({
    queryKey: [...TEMPLATES_KEY, 'detail', id ?? 0],
    queryFn: () => workApi.templates.get(id ?? 0),
    enabled: id !== undefined,
  });

/** CU-56: «Mi día»; sin fecha, hoy. */
export const useMyDay = (date?: string) =>
  useQuery({
    queryKey: [...TASKS_KEY, 'my-day', date ?? 'today'],
    queryFn: () => workApi.myDay(date),
    placeholderData: keepPreviousData,
  });

/** CU-55: tareas del día para el administrador. */
export const useAdminTasks = (params: AdminTasksParams) =>
  useQuery({
    queryKey: [...TASKS_KEY, 'list', params],
    queryFn: () => workApi.tasks.list(params).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

/** CU-73. */
export const useWorkSettings = () =>
  useQuery({ queryKey: [...WORK_KEY, 'settings'], queryFn: () => workApi.settings.get() });

/** CU-60: plantillas de turno. */
export const useShiftTemplates = () =>
  useQuery({
    queryKey: [...SHIFTS_KEY, 'templates'],
    queryFn: () => workApi.shiftTemplates.list().then((r) => r.data),
  });

/** CU-61: calendario de una semana; sin `from`, la actual. */
export const useShiftCalendar = (from?: string, to?: string) =>
  useQuery({
    queryKey: [...SHIFTS_KEY, 'calendar', from ?? 'current', to ?? ''],
    queryFn: () => workApi.shifts.calendar(from, to),
    placeholderData: keepPreviousData,
  });

/** CU-62: ausencias de hoy en adelante. */
export const useAbsences = () =>
  useQuery({ queryKey: [...SHIFTS_KEY, 'absences'], queryFn: () => workApi.absences.list().then((r) => r.data) });
