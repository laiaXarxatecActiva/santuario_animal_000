import type { ActivityAction, ActivityLogDto, ActivityTable } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';

export interface ActivityEntry {
  /** `null` para las tareas automáticas («Sistema»). */
  userId: number | null;
  action: ActivityAction;
  tableName: ActivityTable;
  recordId: number;
  details: Record<string, unknown> | null;
}

/** El registro solo se escribe: nunca se modifica ni se borra (CU-42). */
export async function create(db: Queryable, entrada: ActivityEntry): Promise<void> {
  await db.query(
    `INSERT INTO activity_logs (user_id, action, table_name, record_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [entrada.userId, entrada.action, entrada.tableName, entrada.recordId, entrada.details],
  );
}

export interface ActivityFilters {
  userId?: number | 'system' | undefined;
  tableName?: ActivityTable | undefined;
  action?: ActivityAction | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

const DIA = `(l.created_at AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date`;

function filtro(filtros: ActivityFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const condiciones = ['TRUE'];
  const añadir = (sql: (n: string) => string, valor: unknown) => {
    params.push(valor);
    condiciones.push(sql(`$${params.length}`));
  };
  if (filtros.userId === 'system') condiciones.push('l.user_id IS NULL');
  else if (filtros.userId !== undefined) añadir((n) => `l.user_id = ${n}`, filtros.userId);
  if (filtros.tableName !== undefined) añadir((n) => `l.table_name = ${n}`, filtros.tableName);
  if (filtros.action !== undefined) añadir((n) => `l.action = ${n}`, filtros.action);
  if (filtros.from !== undefined) añadir((n) => `${DIA} >= ${n}::date`, filtros.from);
  if (filtros.to !== undefined) añadir((n) => `${DIA} <= ${n}::date`, filtros.to);
  return { where: condiciones.join(' AND '), params };
}

export async function count(db: Queryable, filtros: ActivityFilters): Promise<number> {
  const { where, params } = filtro(filtros);
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM activity_logs l WHERE ${where}`,
    params,
  );
  return rows[0]?.n ?? 0;
}

interface ActivityRow {
  id: string;
  created_at: Date;
  user_id: number | null;
  user_name: string | null;
  action: ActivityAction;
  table_name: string;
  record_id: number;
  details: Record<string, unknown> | null;
}

function mapRow(row: ActivityRow): ActivityLogDto {
  return {
    id: Number(row.id),
    createdAt: row.created_at.toISOString(),
    user: row.user_id === null ? null : { id: row.user_id, name: row.user_name ?? '' },
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    details: row.details,
  };
}

/** De más reciente a más antiguo (paso 2). */
export async function list(
  db: Queryable,
  filtros: ActivityFilters,
  pagina: { limit: number; offset: number },
): Promise<ActivityLogDto[]> {
  const { where, params } = filtro(filtros);
  params.push(pagina.limit, pagina.offset);
  const { rows } = await db.query<ActivityRow>(
    `SELECT l.id, l.created_at, l.user_id, u.first_name || ' ' || u.last_name AS user_name,
            l.action, l.table_name, l.record_id, l.details
       FROM activity_logs l
       LEFT JOIN users u ON u.id = l.user_id
      WHERE ${where}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(mapRow);
}
