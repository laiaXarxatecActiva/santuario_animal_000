import { describe, expect, it } from 'vitest';
import { ACTIVITY_ACTIONS } from '../src/constants/activity.js';
import { adminActivityLogsQuerySchema } from '../src/schemas/activity.schema.js';

describe('CU-42 Registro de actividad: constantes y filtros', () => {
  it('las acciones coinciden con el CHECK de activity_logs.action en seedsql.sql', () => {
    expect(ACTIVITY_ACTIONS).toEqual(['create', 'update', 'delete', 'archive']);
  });

  it('2: filtra por usuario, por «Sistema», tabla, acción y fechas', () => {
    expect(adminActivityLogsQuerySchema.parse({ userId: '3', tableName: 'animals', action: 'update' })).toMatchObject({
      userId: 3,
      tableName: 'animals',
      action: 'update',
      page: 1,
      pageSize: 20,
    });
    expect(adminActivityLogsQuerySchema.parse({ userId: 'system' }).userId).toBe('system');
    expect(adminActivityLogsQuerySchema.parse({ userId: '', tableName: '', action: '', from: '' })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it('rechaza tablas y acciones desconocidas y un rango de fechas al revés', () => {
    expect(adminActivityLogsQuerySchema.safeParse({ tableName: 'sessions' }).success).toBe(false);
    expect(adminActivityLogsQuerySchema.safeParse({ action: 'drop' }).success).toBe(false);
    const rango = adminActivityLogsQuerySchema.safeParse({ from: '2026-05-02', to: '2026-05-01' });
    expect(rango.error?.issues[0]?.path).toEqual(['to']);
  });
});
