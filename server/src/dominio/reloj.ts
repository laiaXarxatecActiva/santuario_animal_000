// El tiempo se inyecta mediante esta interfaz: el dominio nunca llama a `new Date()`.
export interface Reloj {
  /** Instante actual. */
  ahora(): Date;
  /** Fecha de hoy en la zona horaria del santuario, como `YYYY-MM-DD`. */
  hoy(): string;
}

export const ZONA_HORARIA_SANTUARIO = 'Europe/Madrid';

// El formato sueco (sv-SE) produce directamente `YYYY-MM-DD`.
const formatoFecha = new Intl.DateTimeFormat('sv-SE', {
  timeZone: ZONA_HORARIA_SANTUARIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function fechaEnZonaSantuario(instante: Date): string {
  return formatoFecha.format(instante);
}

const formatoHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_HORARIA_SANTUARIO,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
});

/** Hora `HH:MM` de Madrid de un instante (CU-74). */
export function horaEnZonaSantuario(instante: Date): string {
  return formatoHora.format(instante);
}

const formatoPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA_SANTUARIO,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Minutos que Madrid va por delante de UTC en ese instante (60 en invierno, 120 en verano). */
function desfaseMinutos(instante: Date): number {
  const p = Object.fromEntries(formatoPartes.formatToParts(instante).map((x) => [x.type, Number(x.value)]));
  const comoUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return Math.round((comoUtc - instante.getTime()) / 60000);
}

/**
 * CU-58: instante de un día y una hora (`HH:MM`) de Madrid. En el cambio de
 * marzo, una hora que no existe (02:30) pasa a la misma hora de verano (03:30);
 * en el de octubre, una hora que se repite se toma la segunda vez (invierno).
 */
export function instanteEnZonaSantuario(fecha: string, hora: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const [h, m] = hora.split(':').map(Number) as [number, number];
  const local = Date.UTC(anio, mes - 1, dia, h, m);
  let instante = local - desfaseMinutos(new Date(local)) * 60000;
  const corregido = local - desfaseMinutos(new Date(instante)) * 60000;
  if (corregido !== instante) instante = corregido;
  return new Date(instante);
}

/** Reloj real, para producción. */
export const relojSistema: Reloj = {
  ahora: () => new Date(),
  hoy: () => fechaEnZonaSantuario(new Date()),
};

/** Reloj detenido en un instante, para las pruebas y los jobs lanzados a mano. */
export function relojFijo(instante: Date | string): Reloj {
  const fijo = new Date(instante);
  if (Number.isNaN(fijo.getTime())) {
    throw new RangeError(`Instante no válido: ${String(instante)}`);
  }
  return {
    ahora: () => new Date(fijo),
    hoy: () => fechaEnZonaSantuario(fijo),
  };
}
