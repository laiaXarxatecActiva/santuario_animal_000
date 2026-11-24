import type {
  AbsenceDto,
  HandoverNoteDto,
  IncidentDto,
  MyDayTaskDto,
  QualificationDto,
  ShiftAssignmentDto,
  ShiftsCalendarDto,
  ShiftTemplateDto,
  TaskDto,
  TaskTemplateDto,
  ZoneDto,
} from '@sanctuary/shared';

// Datos del trabajo diario del personal (CU-52 en adelante), como en TEST_DATA.sql.

export const zonas: ZoneDto[] = [
  { id: 4, name: 'Clínica y recuperación', description: null, isActive: true, animalCount: 3 },
  { id: 5, name: 'Cocina y almacén', description: null, isActive: true, animalCount: 0 },
  { id: 1, name: 'Gran voladero', description: 'El voladero principal.', isActive: true, animalCount: 7 },
  { id: 6, name: 'Voladero viejo', description: null, isActive: false, animalCount: 0 },
];

export const cualificaciones: QualificationDto[] = [
  { id: 1, name: 'Administrar medicación', description: null, workerCount: 2 },
  { id: 2, name: 'Manejo de grandes rapaces', description: null, workerCount: 2 },
  { id: 4, name: 'Primeros auxilios', description: null, workerCount: 0 },
];

export function plantilla(overrides: Partial<TaskTemplateDto> = {}): TaskTemplateDto {
  return {
    id: 4,
    type: 'feeding',
    title: 'Comida de la clínica',
    description: null,
    zone: { id: 4, name: 'Clínica y recuperación' },
    animals: [],
    qualification: null,
    times: ['09:00', '17:00'],
    recurrence: 'daily',
    weekdays: null,
    intervalDays: null,
    startDate: '2026-01-01',
    endDate: null,
    isActive: true,
    hasHistory: true,
    ...overrides,
  };
}

export function tarea(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: 101,
    templateId: 4,
    type: 'feeding',
    title: 'Comida de la clínica',
    description: null,
    zone: { id: 4, name: 'Clínica y recuperación' },
    animals: [],
    qualification: null,
    dueDate: '2026-11-23',
    dueTime: '17:00',
    dueAt: '2026-11-23T16:00:00.000Z',
    status: 'pending',
    late: false,
    assignedTo: null,
    resolvedBy: null,
    resolvedAt: null,
    observations: null,
    photoUrl: null,
    isOneOff: false,
    ...overrides,
  };
}

export function tareaDelDia(overrides: Partial<MyDayTaskDto> = {}): MyDayTaskDto {
  return { ...tarea(), mine: false, blockedReason: null, ...overrides };
}

// Turnos (CU-60 a CU-63). La semana del lunes 23 al domingo 29 de noviembre de 2026.

const clinica = { id: 4, name: 'Clínica y recuperación' };
const cocina = { id: 5, name: 'Cocina y almacén' };
const granVoladero = { id: 1, name: 'Gran voladero' };

export const turnoManana: ShiftTemplateDto = {
  id: 1,
  name: 'Mañana',
  startTime: '07:00',
  endTime: '15:00',
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  isActive: true,
  requirements: [
    { zone: clinica, minWorkers: 1 },
    { zone: cocina, minWorkers: 1 },
    { zone: granVoladero, minWorkers: 1 },
  ],
  hasAssignments: true,
};

export const turnoTarde: ShiftTemplateDto = {
  id: 2,
  name: 'Tarde',
  startTime: '14:00',
  endTime: '22:00',
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  isActive: true,
  requirements: [
    { zone: clinica, minWorkers: 1 },
    { zone: granVoladero, minWorkers: 1 },
  ],
  hasAssignments: true,
};

export const turnoMantenimiento: ShiftTemplateDto = {
  id: 3,
  name: 'Mantenimiento',
  startTime: '08:00',
  endTime: '14:00',
  weekdays: [1, 2, 3, 4, 5],
  isActive: true,
  requirements: [],
  hasAssignments: false,
};

const ref = (t: ShiftTemplateDto) => ({ id: t.id, name: t.name, startTime: t.startTime, endTime: t.endTime });

export function asignacion(overrides: Partial<ShiftAssignmentDto> = {}): ShiftAssignmentDto {
  return {
    id: 501,
    shift: ref(turnoManana),
    date: '2026-11-23',
    user: { id: 3, name: 'Nuria Peris Gil' },
    zones: [clinica, { id: 3, name: 'Voladero de alimoches' }],
    checkedInAt: null,
    checkedOutAt: null,
    ...overrides,
  };
}

export function ausencia(overrides: Partial<AbsenceDto> = {}): AbsenceDto {
  return {
    id: 2,
    user: { id: 5, name: 'Carmen Boix Vidal' },
    startDate: '2026-11-26',
    endDate: '2026-11-27',
    type: 'vacation',
    notes: null,
    ...overrides,
  };
}

/** Lunes 23: Nuria y Andrés por la mañana y Carmen por la tarde; el jueves 26, Carmen de vacaciones. */
export function calendarioSemana(overrides: Partial<ShiftsCalendarDto> = {}): ShiftsCalendarDto {
  return {
    from: '2026-11-23',
    to: '2026-11-29',
    shifts: [turnoManana, turnoMantenimiento, turnoTarde],
    assignments: [
      asignacion({ checkedInAt: '2026-11-23T06:58:00.000Z' }),
      asignacion({ id: 502, user: { id: 4, name: 'Andrés Climent Mas' }, zones: [granVoladero, cocina] }),
      asignacion({
        id: 503,
        shift: ref(turnoTarde),
        user: { id: 5, name: 'Carmen Boix Vidal' },
        zones: [clinica, granVoladero],
      }),
    ],
    absences: [ausencia()],
    gaps: [
      { date: '2026-11-26', shift: ref(turnoTarde), zone: clinica, required: 1, assigned: 0 },
      { date: '2026-11-26', shift: ref(turnoTarde), zone: granVoladero, required: 1, assigned: 0 },
    ],
    ...overrides,
  };
}

/** CU-70: una incidencia. */
export function incidencia(overrides: Partial<IncidentDto> = {}): IncidentDto {
  return {
    id: 2,
    category: 'health',
    severity: 'high',
    description: 'Pipa cojea de la pata derecha desde esta mañana.',
    zone: clinica,
    animal: { id: 14, name: 'Pipa' },
    photoUrl: null,
    status: 'open',
    reportedBy: { id: 3, name: 'Nuria Peris Gil' },
    createdAt: '2026-11-23T07:40:00.000Z',
    resolution: null,
    resolvedBy: null,
    resolvedAt: null,
    taskId: null,
    ...overrides,
  };
}

/** CU-71: una nota de relevo. */
export function notaDeRelevo(overrides: Partial<HandoverNoteDto> = {}): HandoverNoteDto {
  return {
    id: 1,
    zone: clinica,
    author: { id: 5, name: 'Carmen Boix Vidal' },
    body: 'Carbón ha estado tranquilo; dejad la luz baja en su jaula.',
    createdAt: '2026-11-22T20:50:00.000Z',
    isRead: false,
    mine: false,
    ...overrides,
  };
}
