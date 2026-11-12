import type { UserTokenType } from '@sanctuary/shared';

const HORA_MS = 60 * 60 * 1000;

// Duración de los tokens de un solo uso (TECH_SPEC §9.2).
export const DURACION_TOKEN_MS: Record<UserTokenType, number> = {
  email_verification: 24 * HORA_MS,
  password_reset: HORA_MS,
};

export function caducidadToken(tipo: UserTokenType, ahora: Date): Date {
  return new Date(ahora.getTime() + DURACION_TOKEN_MS[tipo]);
}

export type EstadoToken = 'valid' | 'expired' | 'used';

/** Un token vale si no se ha usado y todavía no ha llegado su caducidad. */
export function estadoToken(token: { expiresAt: Date; usedAt: Date | null }, ahora: Date): EstadoToken {
  if (token.usedAt !== null) return 'used';
  if (token.expiresAt.getTime() <= ahora.getTime()) return 'expired';
  return 'valid';
}
