import { describe, expect, it } from 'vitest';
import { necesitaRecordatorio } from '../src/dominio/actualizaciones.js';
import { requiereMensajeDeDespedida } from '../src/dominio/animal.js';
import { extracto, mesAnterior, recibeEmailPorActualizacion, recibeResumenMensual } from '../src/dominio/avisos.js';

describe('CU-33 3a mensaje de despedida', () => {
  it('es obligatorio en un fallecimiento con adopciones abiertas', () => {
    expect(requiereMensajeDeDespedida('deceased', 2)).toBe(true);
    expect(requiereMensajeDeDespedida('deceased', 0)).toBe(false);
    expect(requiereMensajeDeDespedida('transferred', 3)).toBe(false);
    expect(requiereMensajeDeDespedida('in_treatment', 3)).toBe(false);
  });
});

describe('CU-47 aviso de animales sin actualización', () => {
  it('RN-14: desde 12 días sin actualización', () => {
    expect(necesitaRecordatorio(11)).toBe(false);
    expect(necesitaRecordatorio(12)).toBe(true);
    expect(necesitaRecordatorio(30)).toBe(true);
  });
});

describe('RN-19 preferencias de email', () => {
  it('CU-31 4.2: email por actualización solo con emails activados y frecuencia «per_update»', () => {
    expect(recibeEmailPorActualizacion({ emailNotifications: true, emailFrequency: 'per_update' })).toBe(true);
    expect(recibeEmailPorActualizacion({ emailNotifications: true, emailFrequency: 'monthly_digest' })).toBe(false);
    expect(recibeEmailPorActualizacion({ emailNotifications: false, emailFrequency: 'per_update' })).toBe(false);
  });

  it('CU-46: resumen solo con emails activados y frecuencia «monthly_digest»', () => {
    expect(recibeResumenMensual({ emailNotifications: true, emailFrequency: 'monthly_digest' })).toBe(true);
    expect(recibeResumenMensual({ emailNotifications: false, emailFrequency: 'monthly_digest' })).toBe(false);
    expect(recibeResumenMensual({ emailNotifications: true, emailFrequency: 'per_update' })).toBe(false);
  });
});

describe('CU-46 resumen mensual', () => {
  it('1: el mes anterior al día de ejecución, como fechas YYYY-MM-DD', () => {
    expect(mesAnterior('2030-02-01')).toEqual({ desde: '2030-01-01', hasta: '2030-01-31' });
    expect(mesAnterior('2030-01-01')).toEqual({ desde: '2029-12-01', hasta: '2029-12-31' });
    expect(mesAnterior('2028-03-15')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });

  it('2: el extracto corta por una palabra y añade puntos suspensivos', () => {
    expect(extracto('Texto corto.', 200)).toBe('Texto corto.');
    expect(extracto('Una frase bastante larga para cortar', 15)).toBe('Una frase…');
    expect(extracto('  Con   espacios\ny saltos  ', 200)).toBe('Con espacios y saltos');
  });
});
