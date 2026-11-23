import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Tokens de un solo uso (TECH_SPEC §9.2): el token viaja en el email y en la
// base de datos solo se guarda su hash SHA-256.

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

// CU-05: enlace al recibo de una donación sin cuenta. En lugar de guardar un
// token, se firma el texto con SESSION_SECRET (HMAC-SHA256): no se puede
// adivinar ni sirve para otra donación.

export function firmar(secreto: string, texto: string): string {
  return createHmac('sha256', secreto).update(texto).digest('base64url');
}

/** Compara en tiempo constante, para no dar pistas de cuántos caracteres coinciden. */
export function firmaValida(secreto: string, texto: string, firma: string): boolean {
  const esperada = Buffer.from(firmar(secreto, texto));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
