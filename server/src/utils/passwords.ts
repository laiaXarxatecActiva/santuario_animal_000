import { argon2, randomBytes, timingSafeEqual, type Argon2Parameters } from 'node:crypto';

// Hash de contraseñas con Argon2id (TECH_SPEC §9.2), con el `crypto.argon2` nativo
// de Node (24.7 o superior), sin dependencias. Parámetros mínimos recomendados por
// OWASP: 19 MiB de memoria, 2 pasadas y paralelismo 1. Se guarda en formato PHC:
// $argon2id$v=19$m=19456,t=2,p=1$<sal>$<hash> (base64 sin relleno).
const MEMORIA_KIB = 19456;
const PASADAS = 2;
const PARALELISMO = 1;
const BYTES_SAL = 16;
const BYTES_HASH = 32;

// Límites al comprobar un hash guardado, para que uno manipulado no agote la memoria.
const MAX_MEMORIA_KIB = 65536;
const MAX_PASADAS = 10;
const MAX_PARALELISMO = 4;

const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

interface Coste {
  memory: number;
  passes: number;
  parallelism: number;
}

function derivar(password: string, nonce: Buffer, coste: Coste, tagLength: number): Promise<Buffer> {
  const parametros: Argon2Parameters = { message: password, nonce, tagLength, ...coste };
  return new Promise((resolve, reject) => {
    argon2('argon2id', parametros, (error, clave) => (error ? reject(error) : resolve(clave)));
  });
}

const base64SinRelleno = (buffer: Buffer) => buffer.toString('base64').replace(/=+$/, '');

export async function hashPassword(password: string): Promise<string> {
  const sal = randomBytes(BYTES_SAL);
  const coste = { memory: MEMORIA_KIB, passes: PASADAS, parallelism: PARALELISMO };
  const hash = await derivar(password, sal, coste, BYTES_HASH);
  return `$argon2id$v=19$m=${MEMORIA_KIB},t=${PASADAS},p=${PARALELISMO}$${base64SinRelleno(sal)}$${base64SinRelleno(hash)}`;
}

/** Devuelve `false` también si el hash guardado no es un Argon2id válido. */
export async function verifyPassword(password: string, hashGuardado: string): Promise<boolean> {
  const partes = PHC.exec(hashGuardado);
  if (!partes) return false;
  const [, m = '', t = '', p = '', salBase64 = '', hashBase64 = ''] = partes;
  const coste = { memory: Number(m), passes: Number(t), parallelism: Number(p) };
  if (coste.memory > MAX_MEMORIA_KIB || coste.passes > MAX_PASADAS || coste.parallelism > MAX_PARALELISMO) {
    return false;
  }
  const sal = Buffer.from(salBase64, 'base64');
  const esperado = Buffer.from(hashBase64, 'base64');
  if (sal.length < 8 || esperado.length < 16) return false;
  try {
    return timingSafeEqual(await derivar(password, sal, coste, esperado.length), esperado);
  } catch {
    return false;
  }
}
