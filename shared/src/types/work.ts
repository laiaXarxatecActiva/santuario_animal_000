import type { TaskBlockReason, TaskRecurrence, TaskStatus, TaskType } from '../constants/work.js';
import type { AdminPersonRef } from './admin.js';

// Trabajo diario del personal (CU-52 a CU-58).

/** Referencia corta a una zona, un animal o una cualificación. */
export interface NamedRef {
  id: number;
  name: string;
}

/** CU-52. */
export interface ZoneDto {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  /** Animales que viven ahora en la zona (sin fallecidos ni trasladados). */
  animalCount: number;
}

/** CU-53. */
export interface QualificationDto {
  id: number;
  name: string;
  description: string | null;
  /** Trabajadores que la tienen. */
  workerCount: number;
}

/** CU-53: cualificaciones de un trabajador. */
export interface UserQualificationsDto {
  userId: number;
  qualifications: NamedRef[];
}

/** CU-54. */
export interface TaskTemplateDto {
  id: number;
  type: TaskType;
  title: string;
  description: string | null;
  zone: NamedRef | null;
  animals: NamedRef[];
  qualification: NamedRef | null;
  /** Horas `HH:MM` de Madrid, ordenadas. */
  times: string[];
  recurrence: TaskRecurrence;
  weekdays: number[] | null;
  intervalDays: number | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  /** Tiene tareas ya resueltas: no se puede borrar, solo desactivar. */
  hasHistory: boolean;
}

/** CU-55 a CU-57: una tarea concreta. */
export interface TaskDto {
  id: number;
  templateId: number | null;
  type: TaskType;
  title: string;
  description: string | null;
  zone: NamedRef | null;
  animals: NamedRef[];
  qualification: NamedRef | null;
  /** Día y hora en Madrid. */
  dueDate: string;
  dueTime: string;
  /** El mismo instante en ISO 8601. */
  dueAt: string;
  status: TaskStatus;
  /** Pendiente y pasada la hora más el margen (CU-73). */
  late: boolean;
  /** Reasignación explícita del administrador. */
  assignedTo: AdminPersonRef | null;
  /** Quién la completó o la marcó como no realizada; `null` si fue el sistema. */
  resolvedBy: AdminPersonRef | null;
  resolvedAt: string | null;
  observations: string | null;
  photoUrl: string | null;
  /** Puntual: creada a mano, sin plantilla. */
  isOneOff: boolean;
}

/** CU-56: una tarea en «Mi día», con lo que puede hacer quien la ve. */
export interface MyDayTaskDto extends TaskDto {
  /** Es suya: asignada a esa persona o de su turno y zona. */
  mine: boolean;
  /** Por qué no la puede resolver; `null` si puede. */
  blockedReason: TaskBlockReason | null;
}

export interface MyDayDto {
  date: string;
  tasks: MyDayTaskDto[];
}

/** CU-73. */
export interface WorkSettingsDto {
  lateMarginMinutes: number;
}
