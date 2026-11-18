// CU-42: reglas del registro de actividad. Sin dependencias externas.

/** Claves que nunca se guardan en los detalles (TECH_SPEC §11.5). */
const CLAVE_SECRETA = /password|contrase|token|secret|hash/i;

export type DetallesActividad = Record<string, unknown>;

/**
 * Quita de los detalles, a cualquier profundidad, las claves que puedan
 * contener contraseñas o tokens. Devuelve `null` si no queda nada.
 */
export function limpiarDetalles(detalles: DetallesActividad | null | undefined): DetallesActividad | null {
  if (!detalles) return null;
  const limpiar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) return valor.map(limpiar);
    if (valor !== null && typeof valor === 'object') {
      const salida: Record<string, unknown> = {};
      for (const [clave, interior] of Object.entries(valor)) {
        if (!CLAVE_SECRETA.test(clave) && interior !== undefined) salida[clave] = limpiar(interior);
      }
      return salida;
    }
    return valor;
  };
  const limpio = limpiar(detalles) as DetallesActividad;
  return Object.keys(limpio).length > 0 ? limpio : null;
}

/** Cambio de un valor como `[antes, después]`, o nada si no ha cambiado. */
export function cambio<T>(antes: T, despues: T): [T, T] | undefined {
  return antes === despues ? undefined : [antes, despues];
}

type Primitivo = string | number | boolean | null;
const esPrimitivo = (v: unknown): v is Primitivo =>
  v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

/**
 * Campos simples (texto, número, sí/no) que cambian entre dos versiones de un
 * registro, como `{ campo: [antes, después] }`. Ignora las fechas de control.
 */
export function diferencias(antes: object, despues: object): DetallesActividad {
  const ignorar = new Set(['updatedAt', 'createdAt']);
  const previo = antes as Record<string, unknown>;
  const salida: DetallesActividad = {};
  for (const [clave, valor] of Object.entries(despues)) {
    if (ignorar.has(clave) || !(clave in previo)) continue;
    const anterior = previo[clave];
    if (esPrimitivo(valor) && esPrimitivo(anterior) && valor !== anterior) salida[clave] = [anterior, valor];
  }
  return salida;
}
