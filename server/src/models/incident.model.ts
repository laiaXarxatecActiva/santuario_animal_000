import type {
  IncidentCategory,
  IncidentDto,
  IncidentSeverity,
  IncidentStatus,
  IncidentsQuery,
} from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import type { Resolucion } from '../dominio/incidencias.js';

// CU-70: incidencias del personal.

interface IncidentRow {
  id: number;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  description: string;
  zone_id: number | null;
  zone_name: string | null;
  animal_id: number | null;
  animal_name: string | null;
  photo_url: string | null;
  status: IncidentStatus;
  reported_by: number;
  reported_name: string;
  created_at: Date;
  resolution: string | null;
  resolved_by: number | null;
  resolved_name: string | null;
  resolved_at: Date | null;
  task_id: number | null;
}

function mapRow(r: IncidentRow): IncidentDto {
  return {
    id: r.id,
    category: r.category,
    severity: r.severity,
    title: r.title,
    description: r.description,
    zone: r.zone_id === null ? null : { id: r.zone_id, name: r.zone_name ?? '' },
    animal: r.animal_id === null ? null : { id: r.animal_id, name: r.animal_name ?? '' },
    photoUrl: r.photo_url,
    status: r.status,
    reportedBy: { id: r.reported_by, name: r.reported_name },
    createdAt: r.created_at.toISOString(),
    resolution: r.resolution,
    resolvedBy: r.resolved_by === null ? null : { id: r.resolved_by, name: r.resolved_name ?? '' },
    resolvedAt: r.resolved_at?.toISOString() ?? null,
    taskId: r.task_id,
  };
}

const SELECT = `
  SELECT i.id, i.category, i.severity, i.title, i.description, i.zone_id, z.name AS zone_name,
         i.animal_id, a.name AS animal_name, i.photo_url, i.status,
         i.reported_by, ur.first_name || ' ' || ur.last_name AS reported_name, i.created_at,
         i.resolution, i.resolved_by, uv.first_name || ' ' || uv.last_name AS resolved_name, i.resolved_at,
         i.task_id
    FROM incidents i
    LEFT JOIN zones z ON z.id = i.zone_id
    LEFT JOIN animals a ON a.id = i.animal_id
    JOIN users ur ON ur.id = i.reported_by
    LEFT JOIN users uv ON uv.id = i.resolved_by`;

/** Filtros del listado; `active` son las abiertas y en curso. */
function filtrar(filtros: Omit<IncidentsQuery, 'page' | 'pageSize'>): { where: string; params: unknown[] } {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtros.status === 'active') condiciones.push("i.status IN ('open', 'in_progress')");
  else if (filtros.status !== 'all') {
    params.push(filtros.status);
    condiciones.push(`i.status = $${params.length}`);
  }
  if (filtros.severity) {
    params.push(filtros.severity);
    condiciones.push(`i.severity = $${params.length}`);
  }
  if (filtros.zoneId) {
    params.push(filtros.zoneId);
    condiciones.push(`i.zone_id = $${params.length}`);
  }
  return { where: condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '', params };
}

export async function count(db: Queryable, filtros: Omit<IncidentsQuery, 'page' | 'pageSize'>): Promise<number> {
  const { where, params } = filtrar(filtros);
  const { rows } = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM incidents i ${where}`, params);
  return rows[0]?.total ?? 0;
}

export async function list(
  db: Queryable,
  filtros: Omit<IncidentsQuery, 'page' | 'pageSize'>,
  pagina: { limit: number; offset: number },
): Promise<IncidentDto[]> {
  const { where, params } = filtrar(filtros);
  const { rows } = await db.query<IncidentRow>(
    `${SELECT} ${where} ORDER BY i.created_at DESC, i.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pagina.limit, pagina.offset],
  );
  return rows.map(mapRow);
}

/** CU-72: las abiertas y en curso, las graves primero. */
export async function listActive(db: Queryable, limite: number): Promise<IncidentDto[]> {
  const { rows } = await db.query<IncidentRow>(
    `${SELECT} WHERE i.status IN ('open', 'in_progress')
      ORDER BY CASE i.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, i.created_at DESC, i.id DESC
      LIMIT $1`,
    [limite],
  );
  return rows.map(mapRow);
}

export async function countByStatus(db: Queryable): Promise<Record<IncidentStatus, number>> {
  const { rows } = await db.query<{ status: IncidentStatus; total: number }>(
    'SELECT status, count(*)::int AS total FROM incidents GROUP BY status',
  );
  const recuento: Record<IncidentStatus, number> = { open: 0, in_progress: 0, resolved: 0 };
  for (const r of rows) recuento[r.status] = r.total;
  return recuento;
}

export async function findById(db: Queryable, id: number, forUpdate = false): Promise<IncidentDto | null> {
  const { rows } = await db.query<IncidentRow>(`${SELECT} WHERE i.id = $1${forUpdate ? ' FOR UPDATE OF i' : ''}`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  db: Queryable,
  datos: {
    category: IncidentCategory;
    severity: IncidentSeverity;
    title: string;
    description: string;
    zoneId: number | null;
    animalId: number | null;
    photoUrl: string | null;
    reportedBy: number;
    createdAt: Date;
  },
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO incidents (category, severity, title, description, zone_id, animal_id, photo_url, reported_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      datos.category,
      datos.severity,
      datos.title,
      datos.description,
      datos.zoneId,
      datos.animalId,
      datos.photoUrl,
      datos.reportedBy,
      datos.createdAt,
    ],
  );
  return rows[0]!.id;
}

export async function setStatus(db: Queryable, id: number, status: IncidentStatus, r: Resolucion): Promise<void> {
  await db.query(
    'UPDATE incidents SET status = $2, resolution = $3, resolved_by = $4, resolved_at = $5 WHERE id = $1',
    [id, status, r.resolution, r.resolvedBy, r.resolvedAt],
  );
}

export async function setTask(db: Queryable, id: number, taskId: number): Promise<void> {
  await db.query('UPDATE incidents SET task_id = $2 WHERE id = $1', [id, taskId]);
}
