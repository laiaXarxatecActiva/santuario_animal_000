import type { HandoverNoteDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-71: notas de relevo de cada zona y quién las ha leído.

interface NoteRow {
  id: number;
  zone_id: number;
  zone_name: string;
  author_id: number;
  author_name: string;
  body: string;
  created_at: Date;
  is_read: boolean;
}

function mapRow(r: NoteRow, userId: number): HandoverNoteDto {
  const mine = r.author_id === userId;
  return {
    id: r.id,
    zone: { id: r.zone_id, name: r.zone_name },
    author: { id: r.author_id, name: r.author_name },
    body: r.body,
    createdAt: r.created_at.toISOString(),
    isRead: mine || r.is_read,
    mine,
  };
}

const SELECT = `
  SELECT n.id, n.zone_id, z.name AS zone_name, n.author_id, u.first_name || ' ' || u.last_name AS author_name,
         n.body, n.created_at,
         EXISTS (SELECT 1 FROM handover_note_reads r WHERE r.note_id = n.id AND r.user_id = $1) AS is_read
    FROM handover_notes n
    JOIN zones z ON z.id = n.zone_id
    JOIN users u ON u.id = n.author_id`;

/** Las notas de esas zonas desde un instante, la más reciente primero. */
export async function listForZones(
  db: Queryable,
  userId: number,
  zoneIds: readonly number[],
  desde: Date,
): Promise<HandoverNoteDto[]> {
  if (zoneIds.length === 0) return [];
  const { rows } = await db.query<NoteRow>(
    `${SELECT} WHERE n.zone_id = ANY($2::int[]) AND n.created_at >= $3 ORDER BY n.created_at DESC, n.id DESC`,
    [userId, zoneIds, desde],
  );
  return rows.map((r) => mapRow(r, userId));
}

export async function findById(db: Queryable, userId: number, id: number): Promise<HandoverNoteDto | null> {
  const { rows } = await db.query<NoteRow>(`${SELECT} WHERE n.id = $2`, [userId, id]);
  return rows[0] ? mapRow(rows[0], userId) : null;
}

export async function create(
  db: Queryable,
  datos: { zoneId: number; authorId: number; body: string; createdAt: Date },
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    'INSERT INTO handover_notes (zone_id, author_id, body, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
    [datos.zoneId, datos.authorId, datos.body, datos.createdAt],
  );
  return rows[0]!.id;
}

export async function markRead(db: Queryable, noteId: number, userId: number, ahora: Date): Promise<void> {
  await db.query(
    `INSERT INTO handover_note_reads (note_id, user_id, read_at) VALUES ($1, $2, $3)
     ON CONFLICT (note_id, user_id) DO NOTHING`,
    [noteId, userId, ahora],
  );
}
