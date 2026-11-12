import { createHash, randomBytes } from 'node:crypto';

// Tokens de un solo uso (TECH_SPEC §9.2): el token viaja en el email y en la
// base de datos solo se guarda su hash SHA-256.

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
