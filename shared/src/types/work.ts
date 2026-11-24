import type {
  AbsenceType,
  CopySkipReason,
  FoodUnit,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  IntakeLevel,
  StaffEmailAlertType,
  MedicationRoute,
  VetVisitStatus,
  TaskBlockReason,
  TaskRecurrence,
  TaskStatus,
  TaskType,
} from '../constants/work.js';
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
  /** Puntual: creada a mano, sin plantilla, pauta ni visita. */
  isOneOff: boolean;
  /** CU-69: la pauta de medicación de la que sale. */
  medicationPlanId?: number | null;
  /** CU-68: la visita veterinaria de la que sale. */
  vetVisitId?: number | null;
  /**
   * CU-66: en las de alimentación, los animales cuya comida se anota (los de la
   * tarea o, si no tiene, los que viven en su zona). Vacío en las demás.
   */
  feedingAnimals?: NamedRef[];
  /** CU-66: lo anotado al completarla. */
  intakes?: { animal: NamedRef; intake: IntakeLevel }[];
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
  /** CU-63: los turnos de quien consulta ese día, para fichar. */
  shifts: ShiftAssignmentDto[];
}

/** CU-73. */
export interface WorkSettingsDto {
  lateMarginMinutes: number;
  /** CU-67: tomas seguidas comiendo poco para avisar. */
  lowIntakeMeals?: number;
}

/** CU-60. */
export interface ShiftTemplateDto {
  id: number;
  name: string;
  /** `HH:MM` de Madrid. */
  startTime: string;
  endTime: string;
  weekdays: number[];
  isActive: boolean;
  requirements: { zone: NamedRef; minWorkers: number }[];
  /** Tiene personas asignadas: no se puede borrar, solo desactivar. */
  hasAssignments: boolean;
}

/** Referencia corta a un turno. */
export interface ShiftRef {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

/** CU-61 y CU-63: una persona en un turno un día. */
export interface ShiftAssignmentDto {
  id: number;
  shift: ShiftRef;
  date: string;
  user: AdminPersonRef;
  zones: NamedRef[];
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

/** CU-62. Al cuidador, de los demás solo le llega que están ausentes (`type` y `notes` a `null`). */
export interface AbsenceDto {
  id: number;
  user: AdminPersonRef;
  startDate: string;
  endDate: string;
  type: AbsenceType | null;
  notes: string | null;
}

/** CU-62: al registrar una ausencia, los turnos que se quitan y los que no (ya fichados). */
export interface AbsenceCreatedDto {
  absence: AbsenceDto;
  removedAssignments: ShiftAssignmentDto[];
  keptAssignments: ShiftAssignmentDto[];
}

/** CU-61 y CU-64: una zona de un turno con menos personas de las necesarias. */
export interface CoverageGapDto {
  date: string;
  shift: ShiftRef;
  zone: NamedRef;
  required: number;
  assigned: number;
}

/** CU-61: el calendario de un rango de días. */
export interface ShiftsCalendarDto {
  from: string;
  to: string;
  /** Los turnos activos y los que tienen personas en el rango. */
  shifts: ShiftTemplateDto[];
  assignments: ShiftAssignmentDto[];
  absences: AbsenceDto[];
  gaps: CoverageGapDto[];
}

/** CU-61 «Copiar la semana anterior». */
export interface CopyWeekResultDto {
  created: number;
  skipped: { date: string; user: AdminPersonRef; shift: ShiftRef; reason: CopySkipReason }[];
}

/** CU-65: un alimento de la dieta. */
export interface DietItemDto {
  id: number;
  animalId: number;
  food: string;
  /** `NUMERIC` como string. */
  quantity: string;
  unit: FoodUnit;
  /** En qué tomas («Lun, Mié y Vie», «Mañana y tarde»). */
  schedule: string | null;
  notes: string | null;
  startDate: string;
  endDate: string | null;
  /** Vigente hoy. */
  isCurrent: boolean;
}

/** CU-66: lo que comió un animal en una toma. */
export interface FeedingLogDto {
  taskId: number;
  date: string;
  time: string;
  intake: IntakeLevel;
  recordedBy: AdminPersonRef | null;
}

/** CU-68. */
export interface VetVisitDto {
  id: number;
  animalId: number;
  date: string;
  time: string;
  reason: string;
  veterinarian: string | null;
  status: VetVisitStatus;
  /** El registro del historial creado al hacerla. */
  vetRecordId: number | null;
  /** La tarea pendiente de «Mi día», si la hay. */
  taskId: number | null;
}

/** CU-69. */
export interface MedicationPlanDto {
  id: number;
  animalId: number;
  medication: string;
  dose: string;
  route: MedicationRoute;
  times: string[];
  startDate: string;
  endDate: string | null;
  qualification: NamedRef | null;
  notes: string | null;
  /** Vigente hoy (o empieza más adelante). */
  isActive: boolean;
  dosesGiven: number;
  /** No dadas: marcadas como no realizadas o cerradas por el sistema. */
  dosesMissed: number;
  /** Tiene dosis resueltas: no se puede borrar, solo terminar. */
  hasHistory: boolean;
}

/** Pestaña «Cuidados» de la ficha del animal (CU-65 a CU-69). */
export interface AnimalCareDto {
  animalId: number;
  diet: DietItemDto[];
  /** Las de los últimos días, de la más reciente a la más antigua. */
  feedings: FeedingLogDto[];
  /** Tomas seguidas comiendo poco (de la última hacia atrás). */
  lowIntakeStreak: number;
  medicationPlans: MedicationPlanDto[];
  /** Programadas (también las pasadas sin registrar) y las últimas hechas o canceladas. */
  vetVisits: VetVisitDto[];
}

/** CU-70: incidencias pendientes (abiertas y en curso), para el número del menú. */
export interface IncidentSummaryDto {
  open: number;
  inProgress: number;
}

/** CU-70: una incidencia comunicada por el personal. */
export interface IncidentDto {
  id: number;
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
  /** La zona elegida o, si se eligió un animal, la suya. */
  zone: NamedRef | null;
  animal: NamedRef | null;
  photoUrl: string | null;
  status: IncidentStatus;
  reportedBy: AdminPersonRef;
  createdAt: string;
  /** Cómo se resolvió (solo si está resuelta). */
  resolution: string | null;
  resolvedBy: AdminPersonRef | null;
  resolvedAt: string | null;
  /** La tarea puntual creada a partir de ella. */
  taskId: number | null;
}

/** CU-71: nota de relevo de una zona. */
export interface HandoverNoteDto {
  id: number;
  zone: NamedRef;
  author: AdminPersonRef;
  body: string;
  createdAt: string;
  /** La ha leído quien consulta (las propias cuentan como leídas). */
  isRead: boolean;
  mine: boolean;
}

/** CU-73 y CU-74: avisos por email y resumen diario. */
export interface AlertSettingsDto {
  emailAlertTypes: StaffEmailAlertType[];
  dailySummaryEnabled: boolean;
  /** `HH:MM` de Madrid. */
  dailySummaryTime: string;
}

/** CU-72: un turno de hoy y si la persona ha fichado. */
export interface TodayShiftDto {
  assignment: ShiftAssignmentDto;
  /** Ya ha empezado y la persona no ha fichado la entrada. */
  missingCheckIn: boolean;
}

/** CU-72: panel «Hoy» del administrador. */
export interface TodayDto {
  date: string;
  /** Recuento de las tareas de hoy. */
  tasks: { total: number; completed: number; notDone: number; pending: number; late: number };
  lateTasks: TaskDto[];
  notDoneTasks: TaskDto[];
  /** Dosis de ayer y de hoy no dadas (CU-69). */
  missedDoses: TaskDto[];
  incidents: { open: number; inProgress: number; latest: IncidentDto[] };
  /** Zonas sin cubrir de los turnos de hoy que no han acabado. */
  gaps: CoverageGapDto[];
  shifts: TodayShiftDto[];
  /** Animales que llevan las tomas del aviso (o más) comiendo poco (CU-67). */
  lowIntake: { animal: NamedRef; streak: number }[];
  /** Visitas veterinarias programadas para hoy (CU-68). */
  vetVisits: (VetVisitDto & { animal: NamedRef })[];
}
