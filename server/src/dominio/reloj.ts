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
