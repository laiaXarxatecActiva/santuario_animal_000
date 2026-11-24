import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { workApi, type AdminTasksParams, type IncidentsParams } from '../api/work';
import { ADMIN_KEY } from './useAdmin';

// Trabajo diario del personal (CU-52 en adelante).
export const WORK_KEY = [...ADMIN_KEY, 'work'] as const;
export const ZONES_KEY = [...WORK_KEY, 'zones'] as const;
export const QUALIFICATIONS_KEY = [...WORK_KEY, 'qualifications'] as const;
export const TEMPLATES_KEY = [...WORK_KEY, 'templates'] as const;
export const TASKS_KEY = [...WORK_KEY, 'tasks'] as const;
export const SHIFTS_KEY = [...WORK_KEY, 'shifts'] as const;
export const CARE_KEY = [...WORK_KEY, 'care'] as const;
export const INCIDENTS_KEY = [...WORK_KEY, 'incidents'] as const;
export const HANDOVER_KEY = [...WORK_KEY, 'handover'] as const;
export const TODAY_KEY = [...WORK_KEY, 'today'] as const;

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

export const animalCareKey = (animalId: number) => [...CARE_KEY, animalId] as const;

/** CU-65 a CU-69: la pestaña «Cuidados» de un animal. */
export const useAnimalCare = (animalId: number) =>
  useQuery({ queryKey: animalCareKey(animalId), queryFn: () => workApi.care.get(animalId) });

/** CU-70: listado de incidencias. */
export const useIncidents = (params: IncidentsParams) =>
  useQuery({
    queryKey: [...INCIDENTS_KEY, 'list', params],
    queryFn: () => workApi.incidents.list(params),
    placeholderData: keepPreviousData,
  });

/** CU-70: pendientes (abiertas y en curso), para el número del menú y del filtro. */
export const useIncidentSummary = (enabled = true) =>
  useQuery({
    queryKey: [...INCIDENTS_KEY, 'summary'],
    queryFn: () => workApi.incidents.summary(),
    enabled,
    refetchInterval: 60_000,
  });

export const useIncident = (id: number) =>
  useQuery({ queryKey: [...INCIDENTS_KEY, id], queryFn: () => workApi.incidents.get(id) });

/** CU-71: notas de relevo de mis zonas. */
export const useHandoverNotes = () =>
  useQuery({ queryKey: HANDOVER_KEY, queryFn: () => workApi.handover.list().then((r) => r.data) });

/** CU-72: panel «Hoy». */
export const useToday = () => useQuery({ queryKey: TODAY_KEY, queryFn: () => workApi.today() });

/** CU-73 y CU-74. */
export const useAlertSettings = () =>
  useQuery({ queryKey: [...WORK_KEY, 'alert-settings'], queryFn: () => workApi.alertSettings.get() });
