import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import type { Reloj } from '../dominio/reloj.js';
import { verifyPassword } from '../utils/passwords.js';

// Genera un .txt con los usuarios de la base de datos y, cuando se conoce, su
// contraseña en claro, para iniciar sesión a mano durante las pruebas. Solo
// para desarrollo: el archivo está en el .gitignore.

export interface TestUserInfo {
  password: string;
  /** Notas de la cabecera de TEST_DATA.sql ('' si no tiene). */
  notes: string;
}

interface UserRow {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  password_hash: string;
  email_verified: boolean;
  is_active: boolean;
  anonymized: boolean;
}

// `'email', crypt('contraseña', ...)`: las comillas se escapan duplicándolas.
const CRYPT_RE = /'([^'\s]+@[^'\s]+)',\s*crypt\('((?:[^']|'')*)'/g;
// Fila de la cabecera: `--   6   lucia@…   Lucia.buitres1    notas` (con rol opcional).
const CABECERA_RE = /^--\s+\d+\s+(?:(?:admin|caretaker)\s+)?(\S+@\S+)\s+\S+(?:\s+(.*))?$/;

/** Extrae de TEST_DATA.sql la contraseña en claro (y las notas) de cada email. */
export function parseTestUsers(sql: string): Map<string, TestUserInfo> {
  const notas = new Map<string, string>();
  for (const linea of sql.split('\n')) {
    const m = CABECERA_RE.exec(linea.trimEnd());
    if (m?.[1]) notas.set(m[1].toLowerCase(), (m[2] ?? '').trim());
  }
  const usuarios = new Map<string, TestUserInfo>();
  for (const m of sql.matchAll(CRYPT_RE)) {
    const email = (m[1] ?? '').toLowerCase();
    usuarios.set(email, { password: (m[2] ?? '').replaceAll("''", "'"), notes: notas.get(email) ?? '' });
  }
  return usuarios;
}

const GRUPOS = [
  { role: 'admin', titulo: 'ADMINISTRADORES (admin) — entran al panel /admin' },
  { role: 'caretaker', titulo: 'CUIDADORES (caretaker) — entran al panel /admin' },
  { role: 'adopter', titulo: 'ADOPTANTES (adopter) — entran a /my-animals' },
] as const;

function fechaHora(reloj: Reloj): string {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(reloj.ahora());
  return partes.replace(',', '');
}

function tabla(filas: string[][]): string[] {
  const anchos = filas[0]?.map((_, i) => Math.max(...filas.map((f) => (f[i] ?? '').length))) ?? [];
  return filas.map((f) =>
    f
      .map((celda, i) => (i === f.length - 1 ? celda : celda.padEnd(anchos[i] ?? 0)))
      .join('   ')
      .trimEnd(),
  );
}

/**
 * Lee los usuarios actuales de la base de datos y escribe `outFile`. La
 * contraseña de TEST_DATA.sql solo se muestra si sigue siendo la válida (se
 * comprueba contra el hash guardado). Devuelve cuántos usuarios ha escrito.
 */
export async function writeTestUsersFile(
  connectionString: string,
  testDataSqlPath: string,
  outFile: string,
  reloj: Reloj,
): Promise<number> {
  const conocidos = parseTestUsers(await readFile(testDataSqlPath, 'utf8'));
  const client = new pg.Client({ connectionString });
  await client.connect();
  let usuarios: UserRow[];
  try {
    ({ rows: usuarios } = await client.query<UserRow>(
      `SELECT first_name, last_name, email, role, password_hash, email_verified, is_active,
              anonymized_at IS NOT NULL AS anonymized
         FROM users
        ORDER BY id`,
    ));
  } finally {
    await client.end();
  }

  const nombreBd = decodeURIComponent(new URL(connectionString).pathname.slice(1));
  const lineas = [
    'USUARIOS DE PRUEBA — Santuario de animales',
    `Generado el ${fechaHora(reloj)} desde la base de datos «${nombreBd}» (${usuarios.length} usuarios).`,
    'No lo edites a mano: se regenera con «npm run db:reset», al arrancar «npm run dev»',
    'y con «npm run users:file». Inicia sesión en http://localhost:5173/login',
    '',
    'Las contraseñas se guardan cifradas: solo se conocen las de TEST_DATA.sql que no se',
    'han cambiado. Para recuperar las originales, ejecuta «npm run db:reset».',
  ];

  for (const grupo of GRUPOS) {
    const filas = [['NOMBRE', 'EMAIL', 'CONTRASEÑA', 'ESTADO Y NOTAS']];
    for (const u of usuarios.filter((x) => x.role === grupo.role)) {
      const conocido = conocidos.get(u.email.toLowerCase());
      let password: string;
      if (u.anonymized) password = '—';
      else if (!conocido) password = '(desconocida: no viene de TEST_DATA.sql)';
      else if (await verifyPassword(conocido.password, u.password_hash)) password = conocido.password;
      else password = '(cambiada desde la carga)';

      // Estado según la BD; las notas de la cabecera que lo repiten se omiten.
      const estados: [clave: string, texto: string][] = [];
      if (u.anonymized) estados.push(['anonimizado', 'anonimizado: no puede entrar']);
      else {
        if (!u.is_active) estados.push(['cuenta desactivada', 'cuenta desactivada: no puede entrar']);
        if (!u.email_verified) estados.push(['email sin verificar', 'email sin verificar']);
      }
      const notas = (conocido?.notes ?? '')
        .split(';')
        .map((n) => n.trim())
        .filter((n) => n && !estados.some(([clave]) => n.includes(clave)));
      const estado = [...estados.map(([, texto]) => texto), ...notas].join('; ');
      filas.push([`${u.first_name} ${u.last_name}`, u.email, password, estado]);
    }
    if (filas.length === 1) continue;
    lineas.push('', '', grupo.titulo, '-'.repeat(grupo.titulo.length), ...tabla(filas));
  }

  await writeFile(outFile, `${lineas.join('\n')}\n`, 'utf8');
  return usuarios.length;
}
