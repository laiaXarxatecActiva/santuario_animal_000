import type { MyDayTaskDto, QualificationDto, TaskDto, TaskTemplateDto, ZoneDto } from '@sanctuary/shared';

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
