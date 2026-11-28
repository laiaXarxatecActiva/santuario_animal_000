import { describe, expect, it } from 'vitest';
import { adminTasksQuerySchema, oneOffTaskBodySchema } from '../src/schemas/work.schema.js';

describe('CU-55 Nueva tarea: zona, animales y persona son opcionales', () => {
  it('se acepta sin zona, sin animales y sin persona', () => {
    const r = oneOffTaskBodySchema.safeParse({
      type: 'maintenance',
      title: 'Revisar los extintores',
      dueDate: '2026-11-24',
      dueTime: '10:00',
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ zoneId: null, animalIds: [], assignedTo: null });
  });
});

describe('CU-55 Ordenar las tareas', () => {
  it('admite «más recientes primero» (-createdAt) y nada más', () => {
    expect(adminTasksQuerySchema.parse({ sort: '-createdAt' }).sort).toBe('-createdAt');
    expect(adminTasksQuerySchema.parse({}).sort).toBeUndefined();
    expect(adminTasksQuerySchema.safeParse({ sort: 'title' }).success).toBe(false);
  });
});
