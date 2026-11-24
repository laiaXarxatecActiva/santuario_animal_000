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

// Turnos y ausencias (CU-60 a CU-64).

export const ABSENCE_TYPES = ['vacation', 'sick_leave', 'personal', 'other'] as const;
export type AbsenceType = (typeof ABSENCE_TYPES)[number];

/** CU-61: el calendario pide como mucho 31 días seguidos. */
export const MAX_SHIFT_RANGE_DAYS = 31;

/** CU-64: días que se revisan por adelantado (hoy incluido). */
export const COVERAGE_CHECK_DAYS = 7;

/** CU-61 «Copiar la semana anterior»: por qué no se copia un turno. */
export const COPY_SKIP_REASONS = [
  'PAST',
  'ABSENT',
  'ALREADY_ASSIGNED',
  'OVERLAP',
  'INACTIVE_USER',
  'INACTIVE_SHIFT',
  'NOT_THAT_WEEKDAY',
] as const;
export type CopySkipReason = (typeof COPY_SKIP_REASONS)[number];

// Alimentación, visitas veterinarias y medicación (CU-65 a CU-69).

/** CU-65: unidades de la cantidad de un alimento de la dieta. */
export const FOOD_UNITS = ['g', 'kg', 'units', 'ml'] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

/** CU-66: lo que ha comido un animal en una toma, de más a menos. */
export const INTAKE_LEVELS = ['all', 'most', 'little', 'none'] as const;
export type IntakeLevel = (typeof INTAKE_LEVELS)[number];

/** CU-67: niveles que cuentan como «come poco». */
export const LOW_INTAKE_LEVELS = ['little', 'none'] as const satisfies readonly IntakeLevel[];

/** CU-67: tomas seguidas comiendo poco para avisar (por defecto y límites de los ajustes). */
export const DEFAULT_LOW_INTAKE_MEALS = 2;
export const MAX_LOW_INTAKE_MEALS = 10;

/** CU-66 y la pestaña «Cuidados»: días de comidas que se muestran. */
export const FEEDING_HISTORY_DAYS = 14;

/** CU-68: estados de una visita veterinaria programada. */
export const VET_VISIT_STATUSES = ['scheduled', 'done', 'cancelled'] as const;
export type VetVisitStatus = (typeof VET_VISIT_STATUSES)[number];

/** CU-69: vía de administración de un medicamento. */
export const MEDICATION_ROUTES = ['oral', 'injection', 'topical', 'eye_drops', 'other'] as const;
export type MedicationRoute = (typeof MEDICATION_ROUTES)[number];
