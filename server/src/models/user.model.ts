import type { Role } from '@sanctuary/shared';
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
