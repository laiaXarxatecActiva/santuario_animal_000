// Trabajo diario del personal (CU-52 en adelante). Deben coincidir con los CHECK de seedsql.sql.

// Tipos de tarea. Una tarea puntual no es un tipo: es una tarea sin plantilla.
export const TASK_TYPES = ['feeding', 'cleaning', 'medication', 'enrichment', 'health_check', 'maintenance'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

// «Atrasada» no es un estado guardado: se calcula (pendiente, pasada la hora y el margen).
export const TASK_STATUSES = ['pending', 'completed', 'not_done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_RECURRENCES = ['daily', 'weekdays', 'every_n_days'] as const;
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number];

/** Días de la semana ISO: 1 = lunes … 7 = domingo. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** CU-58: días que se generan por adelantado (hoy incluido). */
export const TASK_GENERATION_DAYS = 7;

/** Máximo de horas al día de una plantilla (CHECK task_templates_times_count). */
export const MAX_TEMPLATE_TIMES = 12;

/** CU-57: por qué un trabajador no puede resolver una tarea. */
export const TASK_BLOCK_REASONS = ['NOT_PENDING', 'FUTURE_DAY', 'MISSING_QUALIFICATION'] as const;
export type TaskBlockReason = (typeof TASK_BLOCK_REASONS)[number];
