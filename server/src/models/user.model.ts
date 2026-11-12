import type { EmailFrequency, ProfileDto, Role, UpdateProfileInput } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { EmailAlreadyRegisteredError } from '../errors/app-error.js';

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
