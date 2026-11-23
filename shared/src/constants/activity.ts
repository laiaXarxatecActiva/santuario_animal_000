// CU-42: registro de actividad. Las acciones deben coincidir con el CHECK de activity_logs.action.

export const ACTIVITY_ACTIONS = ['create', 'update', 'delete', 'archive'] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** Tablas que se anotan en el registro (filtro «tabla» del listado). */
export const ACTIVITY_TABLES = [
  'animals',
  'species',
  'photos',
  'animal_updates',
  'vet_records',
  'adoption_plans',
  'users',
  'adoptions',
  'payments',
  'donations',
  'zones',
  'qualifications',
  'task_templates',
  'task_instances',
  'work_settings',
  'shift_templates',
  'shift_assignments',
  'absences',
] as const;
export type ActivityTable = (typeof ACTIVITY_TABLES)[number];

/** Valor del filtro de usuario para las acciones de las tareas automáticas (`user_id` vacío). */
export const ACTIVITY_SYSTEM_USER = 'system';
