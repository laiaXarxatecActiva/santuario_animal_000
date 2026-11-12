import bcrypt from 'bcryptjs';

// Hash de contraseñas con bcryptjs, coste 10 (TECH_SPEC §9.2).
const COSTE = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTE);
}

/** Devuelve `false` también si el hash guardado no es de bcrypt. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
