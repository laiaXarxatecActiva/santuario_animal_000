import { MAILPIT_URL } from './entorno.js';

// Lectura de los correos que recibe Mailpit, mediante su API
// (https://mailpit.axllent.org/docs/api-v1/).

interface Resumen {
  ID: string;
}

interface Mensaje {
  Subject: string;
  Text: string;
}

async function pedir<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`${MAILPIT_URL}/api/v1/${ruta}`);
  if (!respuesta.ok) throw new Error(`Mailpit respondió ${respuesta.status} a ${ruta}`);
  return (await respuesta.json()) as T;
}

/** Lanza un error claro si Mailpit no está arrancado. */
export async function comprobarMailpit(): Promise<void> {
  try {
    await pedir<unknown>('info');
  } catch {
    throw new Error(
      `No se puede conectar con Mailpit en ${MAILPIT_URL}. Arráncalo antes de las pruebas ` +
        '(con Docker: `docker compose up -d mailpit`) y comprueba que abre en el navegador.',
    );
  }
}

/** Correos enviados a `email` (del más reciente al más antiguo), con su texto. */
export async function correosPara(email: string): Promise<Mensaje[]> {
  const { messages } = await pedir<{ messages: Resumen[] }>(`search?query=${encodeURIComponent(`to:"${email}"`)}`);
  return Promise.all(messages.map((m) => pedir<Mensaje>(`message/${m.ID}`)));
}

/**
 * Espera (hasta `limiteMs`) a un correo enviado a `email` y lo devuelve: el más
 * reciente o, con `contiene`, el más reciente cuyo texto lo incluye.
 */
export async function esperarCorreo(
  email: string,
  { contiene, limiteMs = 15_000 }: { contiene?: string; limiteMs?: number } = {},
): Promise<Mensaje> {
  const hasta = Date.now() + limiteMs;
  while (Date.now() < hasta) {
    const encontrado = (await correosPara(email)).find((m) => contiene === undefined || m.Text.includes(contiene));
    if (encontrado) return encontrado;
    await new Promise((resolver) => setTimeout(resolver, 250));
  }
  const que = contiene === undefined ? 'ningún correo' : `ningún correo con «${contiene}»`;
  throw new Error(`No ha llegado ${que} a ${email} en ${limiteMs / 1000} s`);
}

/** Primer enlace del texto del correo que contiene `ruta` (p. ej., «/verify-email»). */
export function enlaceDelCorreo(mensaje: Mensaje, ruta: string): string {
  const enlace = mensaje.Text.match(/https?:\/\/\S+/g)?.find((url) => url.includes(ruta));
  if (!enlace) throw new Error(`El correo «${mensaje.Subject}» no tiene ningún enlace a ${ruta}`);
  return enlace;
}
