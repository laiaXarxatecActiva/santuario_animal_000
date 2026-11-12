import { describe, expect, it } from 'vitest';
import { diasEntre, nivelAlertaActualizacion } from '../src/dominio/actualizaciones.js';

describe('diasEntre', () => {
  it('cuenta los días naturales entre dos fechas YYYY-MM-DD', () => {
    expect(diasEntre('2026-11-12', '2026-11-12')).toBe(0);
    expect(diasEntre('2026-10-27', '2026-11-12')).toBe(16);
    expect(diasEntre('2026-12-25', '2027-01-08')).toBe(14);
    // Cambio de hora (25 de octubre de 2026): siguen siendo días enteros.
    expect(diasEntre('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('CU-27 nivelAlertaActualizacion (RN-14)', () => {
  it('sin alerta hasta los 11 días', () => {
    expect(nivelAlertaActualizacion(0)).toBeNull();
    expect(nivelAlertaActualizacion(11)).toBeNull();
  });

  it('aviso en amarillo a los 12 y 13 días (quedan 2 o 1)', () => {
    expect(nivelAlertaActualizacion(12)).toBe('warning');
    expect(nivelAlertaActualizacion(13)).toBe('warning');
  });

  it('alerta en rojo desde los 14 días', () => {
    expect(nivelAlertaActualizacion(14)).toBe('error');
    expect(nivelAlertaActualizacion(40)).toBe('error');
  });
});
