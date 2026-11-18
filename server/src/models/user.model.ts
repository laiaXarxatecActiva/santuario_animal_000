import type {
  AdminUserListItemDto,
  AdminUserSort,
  EmailFrequency,
  ProfileDto,
  Role,
  UpdateProfileInput,
  UserAccountStatus,
} from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { estadoCuenta } from '../dominio/usuarios-admin.js';
import { EmailAlreadyRegisteredError, WorkerEmailTakenError } from '../errors/app-error.js';

interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: Role;
  email_verified: boolean;
  is_active: boolean;
  anonymized_at: Date | null;
}

/** Usuario con los datos que necesita la autenticación. El hash nunca sale de la API. */
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: Role;
  emailVerified: boolean;
  isActive: boolean;
  anonymizedAt: Date | null;
}

const COLUMNAS = 'id, first_name, last_name, email, password_hash, role, email_verified, is_active, anonymized_at';

export function mapRow(row: UserRow): User {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    emailVerified: row.email_verified,
    isActive: row.is_active,
    anonymizedAt: row.anonymized_at,
  };
}

/** Busca sin distinguir mayúsculas (usa el índice único `users_email_lower_key`). */
export async function findByEmail(db: Queryable, email: string): Promise<User | null> {
  const { rows } = await db.query<UserRow>(`SELECT ${COLUMNAS} FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findById(db: Queryable, id: number): Promise<User | null> {
  const { rows } = await db.query<UserRow>(`SELECT ${COLUMNAS} FROM users WHERE id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface NewAdopter {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  privacyAcceptedAt: Date;
}

/** CU-07: el registro público crea siempre adoptantes con el email sin verificar (RN-02). */
export async function create(db: Queryable, datos: NewAdopter): Promise<User> {
  try {
    const { rows } = await db.query<UserRow>(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, email_verified, privacy_accepted_at)
       VALUES ($1, $2, $3, $4, 'adopter', FALSE, $5)
       RETURNING ${COLUMNAS}`,
      [datos.firstName, datos.lastName, datos.email, datos.passwordHash, datos.privacyAcceptedAt],
    );
    return mapRow(rows[0] as UserRow);
  } catch (error) {
    if (esErrorPg(error, PG_UNIQUE_VIOLATION, 'users_email_lower_key')) throw new EmailAlreadyRegisteredError();
    throw error;
  }
}

export async function markEmailVerified(db: Queryable, id: number): Promise<void> {
  await db.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [id]);
}

export async function updatePassword(db: Queryable, id: number, passwordHash: string): Promise<void> {
  await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
}

export async function updateLastLogin(db: Queryable, id: number, instante: Date): Promise<void> {
  await db.query('UPDATE users SET last_login_at = $2 WHERE id = $1', [id, instante]);
}

// ----------------------------------------------------------------------------
// Perfil (CU-23)
// ----------------------------------------------------------------------------

interface ProfileRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: Role;
  email_notifications: boolean;
  email_frequency: EmailFrequency;
  show_public_name: boolean;
}

export function mapProfileRow(row: ProfileRow): ProfileDto {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    emailNotifications: row.email_notifications,
    emailFrequency: row.email_frequency,
    showPublicName: row.show_public_name,
  };
}

export async function findProfile(db: Queryable, id: number): Promise<ProfileDto | null> {
  const { rows } = await db.query<ProfileRow>(
    `SELECT first_name, last_name, email, phone, role, email_notifications, email_frequency, show_public_name
       FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapProfileRow(rows[0]) : null;
}

// Lista blanca: cada campo editable con su columna.
const COLUMNAS_PERFIL: Record<keyof UpdateProfileInput, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone',
  emailNotifications: 'email_notifications',
  emailFrequency: 'email_frequency',
  showPublicName: 'show_public_name',
};

/** Actualiza solo los campos presentes. */
export async function updateProfile(db: Queryable, id: number, cambios: UpdateProfileInput): Promise<void> {
  const params: unknown[] = [id];
  const asignaciones: string[] = [];
  for (const [campo, columna] of Object.entries(COLUMNAS_PERFIL) as [keyof UpdateProfileInput, string][]) {
    if (cambios[campo] === undefined) continue;
    params.push(cambios[campo]);
    asignaciones.push(`${columna} = $${params.length}`);
  }
  if (asignaciones.length === 0) return;
  await db.query(`UPDATE users SET ${asignaciones.join(', ')} WHERE id = $1`, params);
}

// ----------------------------------------------------------------------------
// CU-25 Eliminar la cuenta

/** 4.2: sustituye los datos personales (TECH_SPEC §13) y deja la cuenta inservible. */
export async function anonymize(
  db: Queryable,
  id: number,
  datos: { firstName: string; lastName: string; email: string; passwordHash: string; instante: Date },
): Promise<void> {
  await db.query(
    `UPDATE users
        SET first_name = $2, last_name = $3, email = $4, password_hash = $5, phone = NULL,
            is_active = FALSE, email_verified = FALSE, show_public_name = FALSE,
            email_notifications = FALSE, digest_sent_for = NULL, last_login_at = NULL,
            anonymized_at = $6
      WHERE id = $1`,
    [id, datos.firstName, datos.lastName, datos.email, datos.passwordHash, datos.instante],
  );
}

/** 4.4: notificaciones, lecturas y tokens (las sesiones, en `session.model`). */
export async function deletePersonalRecords(db: Queryable, id: number): Promise<void> {
  await db.query('DELETE FROM notifications WHERE user_id = $1', [id]);
  await db.query('DELETE FROM update_reads WHERE user_id = $1', [id]);
  await db.query('DELETE FROM user_tokens WHERE user_id = $1', [id]);
}

// ----------------------------------------------------------------------------
// Panel: gestión de usuarios (CU-35, CU-36)
// ----------------------------------------------------------------------------

interface AdminUserRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: Role;
  email_verified: boolean;
  is_active: boolean;
  anonymized_at: Date | null;
  created_at: Date;
  last_login_at: Date | null;
}

/** Ficha de un usuario en el panel, sin el hash ni otros datos internos. */
export interface AdminUser extends AdminUserListItemDto {
  phone: string | null;
  emailVerified: boolean;
  isActive: boolean;
  anonymizedAt: Date | null;
  lastLoginDate: Date | null;
}

function mapAdminRow(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    status: estadoCuenta({ isActive: row.is_active, anonymizedAt: row.anonymized_at }),
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    phone: row.phone,
    emailVerified: row.email_verified,
    isActive: row.is_active,
    anonymizedAt: row.anonymized_at,
    lastLoginDate: row.last_login_at,
  };
}

/** Solo los campos del listado. */
export function toListItem(user: AdminUser): AdminUserListItemDto {
  const { id, firstName, lastName, email, role, status, createdAt, lastLoginAt } = user;
  return { id, firstName, lastName, email, role, status, createdAt, lastLoginAt };
}

const SELECT_ADMIN = `
  SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.email_verified,
         u.is_active, u.anonymized_at, u.created_at, u.last_login_at
    FROM users u`;

export interface AdminUserFilters {
  q?: string;
  role?: Role;
  status?: UserAccountStatus;
}

// Quita mayúsculas y tildes para buscar «lucia» y encontrar «Lucía».
const sinTildes = (expr: string) => `translate(lower(${expr}), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc')`;

const CONDICION_ESTADO: Record<UserAccountStatus, string> = {
  active: 'u.is_active AND u.anonymized_at IS NULL',
  inactive: 'NOT u.is_active AND u.anonymized_at IS NULL',
  anonymized: 'u.anonymized_at IS NOT NULL',
};

function construirFiltro(filtros: AdminUserFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const condiciones = ['TRUE'];
  const añadir = (sql: (n: string) => string, valor: unknown) => {
    params.push(valor);
    condiciones.push(sql(`$${params.length}`));
  };
  if (filtros.role !== undefined) añadir((n) => `u.role = ${n}`, filtros.role);
  if (filtros.status !== undefined) condiciones.push(CONDICION_ESTADO[filtros.status]);
  if (filtros.q !== undefined) {
    const patron = filtros.q.replace(/[\\%_]/g, '\\$&');
    añadir(
      (n) =>
        `(${sinTildes("u.first_name || ' ' || u.last_name")} LIKE '%' || ${sinTildes(n)} || '%'
          OR lower(u.email) LIKE '%' || lower(${n}) || '%')`,
      patron,
    );
  }
  return { where: condiciones.join(' AND '), params };
}

// Lista blanca de órdenes.
const ORDEN: Record<AdminUserSort, string> = {
  name: 'u.first_name ASC, u.last_name ASC, u.id ASC',
  '-name': 'u.first_name DESC, u.last_name DESC, u.id DESC',
  createdAt: 'u.created_at ASC, u.id ASC',
  '-createdAt': 'u.created_at DESC, u.id DESC',
  lastLoginAt: 'u.last_login_at ASC NULLS LAST, u.id ASC',
  '-lastLoginAt': 'u.last_login_at DESC NULLS LAST, u.id DESC',
};

export async function countForAdmin(db: Queryable, filtros: AdminUserFilters): Promise<number> {
  const { where, params } = construirFiltro(filtros);
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM users u WHERE ${where}`,
    params,
  );
  return rows[0]?.total ?? 0;
}

export async function listForAdmin(
  db: Queryable,
  filtros: AdminUserFilters,
  opciones: { sort: AdminUserSort; limit: number; offset: number },
): Promise<AdminUser[]> {
  const { where, params } = construirFiltro(filtros);
  params.push(opciones.limit, opciones.offset);
  const { rows } = await db.query<AdminUserRow>(
    `${SELECT_ADMIN} WHERE ${where} ORDER BY ${ORDEN[opciones.sort]}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(mapAdminRow);
}

/** Con `forUpdate`, bloquea la fila hasta el final de la transacción. */
export async function findForAdmin(db: Queryable, id: number, forUpdate = false): Promise<AdminUser | null> {
  const { rows } = await db.query<AdminUserRow>(`${SELECT_ADMIN} WHERE u.id = $1${forUpdate ? ' FOR UPDATE' : ''}`, [
    id,
  ]);
  return rows[0] ? mapAdminRow(rows[0]) : null;
}

/** A1: administradores activos, bloqueados para que dos cambios a la vez no dejen ninguno. */
export async function countActiveAdminsForUpdate(db: Queryable): Promise<number> {
  const { rows } = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_active FOR UPDATE");
  return rows.length;
}

export async function setActive(db: Queryable, id: number, isActive: boolean): Promise<void> {
  await db.query('UPDATE users SET is_active = $2 WHERE id = $1', [id, isActive]);
}

export async function setRole(db: Queryable, id: number, role: Role): Promise<void> {
  await db.query('UPDATE users SET role = $2 WHERE id = $1', [id, role]);
}

export interface NewWorker {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  /** Hash de una contraseña aleatoria que nadie conoce: el trabajador elige la suya con la invitación. */
  passwordHash: string;
}

/** CU-36 paso 3: la cuenta del trabajador nace con el email verificado (RN-02). */
export async function createWorker(db: Queryable, datos: NewWorker): Promise<number> {
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO users (first_name, last_name, email, phone, role, password_hash, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id`,
      [datos.firstName, datos.lastName, datos.email, datos.phone, datos.role, datos.passwordHash],
    );
    return rows[0]!.id;
  } catch (error) {
    if (esErrorPg(error, PG_UNIQUE_VIOLATION, 'users_email_lower_key')) throw new WorkerEmailTakenError();
    throw error;
  }
}
