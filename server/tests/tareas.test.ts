import { describe, expect, it } from 'vitest';
import { instanteEnZonaSantuario } from '../src/dominio/reloj.js';
import {
  asignadaAOtraPersona,
  comprobarResolucion,
  diaDeLaSemana,
  estaAtrasada,
  fechasDeLaPlantilla,
  ocurrencias,
  sumarDias,
  tocaElDia,
  zonaComun,
  type Recurrencia,
} from '../src/dominio/tareas.js';

const diaria: Recurrencia = {
  recurrence: 'daily',
  weekdays: null,
  intervalDays: null,
  startDate: '2026-11-01',
  endDate: null,
};

describe('CU-58 Generar las tareas: fechas y zona horaria', () => {
  it('sumarDias y diaDeLaSemana trabajan con fechas YYYY-MM-DD (1 = lunes, 7 = domingo)', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diaDeLaSemana('2026-11-23')).toBe(1);
    expect(diaDeLaSemana('2026-11-29')).toBe(7);
  });

  it('las horas son de Madrid: en invierno UTC+1 y en verano UTC+2', () => {
    expect(instanteEnZonaSantuario('2026-11-23', '09:00').toISOString()).toBe('2026-11-23T08:00:00.000Z');
    expect(instanteEnZonaSantuario('2026-07-01', '09:00').toISOString()).toBe('2026-07-01T07:00:00.000Z');
  });

  it('cambio de hora de marzo: las 02:30 no existen y pasan a las 03:30 (verano)', () => {
    // El 28 de marzo de 2027 a las 02:00 los relojes pasan a las 03:00.
    expect(instanteEnZonaSantuario('2027-03-28', '02:30').toISOString()).toBe('2027-03-28T01:30:00.000Z');
    expect(instanteEnZonaSantuario('2027-03-28', '09:00').toISOString()).toBe('2027-03-28T07:00:00.000Z');
  });

  it('cambio de hora de octubre: las 02:30 se repiten y se toma la segunda (invierno)', () => {
    // El 25 de octubre de 2026 a las 03:00 los relojes vuelven a las 02:00.
    expect(instanteEnZonaSantuario('2026-10-25', '02:30').toISOString()).toBe('2026-10-25T01:30:00.000Z');
    expect(instanteEnZonaSantuario('2026-10-25', '09:00').toISOString()).toBe('2026-10-25T08:00:00.000Z');
  });
});

describe('CU-54 Plantillas: recurrencias', () => {
  it('diaria: todos los días desde el inicio y hasta el final, ambos incluidos', () => {
    const r: Recurrencia = { ...diaria, startDate: '2026-11-03', endDate: '2026-11-05' };
    expect(fechasDeLaPlantilla(r, '2026-11-01', '2026-11-10')).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
  });

  it('días de la semana: solo los elegidos', () => {
    const r: Recurrencia = { ...diaria, recurrence: 'weekdays', weekdays: [1, 3, 5] };
    // Del lunes 23 al domingo 29 de noviembre de 2026.
    expect(fechasDeLaPlantilla(r, '2026-11-23', '2026-11-29')).toEqual(['2026-11-23', '2026-11-25', '2026-11-27']);
  });

  it('cada N días: cuenta desde la fecha de inicio, aunque el rango empiece después', () => {
    const r: Recurrencia = { ...diaria, recurrence: 'every_n_days', intervalDays: 3, startDate: '2026-11-01' };
    expect(fechasDeLaPlantilla(r, '2026-11-05', '2026-11-12')).toEqual(['2026-11-07', '2026-11-10']);
    expect(tocaElDia(r, '2026-11-01')).toBe(true);
    expect(tocaElDia(r, '2026-10-29')).toBe(false); // antes del inicio
  });

  it('cada N días atraviesa el cambio de hora sin desplazarse', () => {
    const r: Recurrencia = { ...diaria, recurrence: 'every_n_days', intervalDays: 2, startDate: '2026-10-24' };
    expect(fechasDeLaPlantilla(r, '2026-10-24', '2026-10-30')).toEqual([
      '2026-10-24',
      '2026-10-26',
      '2026-10-28',
      '2026-10-30',
    ]);
  });

  it('un rango vacío o al revés no da fechas', () => {
    expect(fechasDeLaPlantilla(diaria, '2026-11-10', '2026-11-09')).toEqual([]);
  });
});

describe('CU-58 Ocurrencias: horas del día y solo desde ahora', () => {
  const plantilla = { ...diaria, times: ['17:00', '09:00'] };

  it('una ocurrencia por día y hora, ordenadas, con el instante en Madrid', () => {
    const lista = ocurrencias(plantilla, '2026-11-23', '2026-11-24', new Date('2026-11-01T00:00:00Z'));
    expect(lista.map((o) => [o.fecha, o.hora, o.instante.toISOString()])).toEqual([
      ['2026-11-23', '09:00', '2026-11-23T08:00:00.000Z'],
      ['2026-11-23', '17:00', '2026-11-23T16:00:00.000Z'],
      ['2026-11-24', '09:00', '2026-11-24T08:00:00.000Z'],
      ['2026-11-24', '17:00', '2026-11-24T16:00:00.000Z'],
    ]);
  });

  it('no genera lo que ya ha pasado: una plantilla creada a mediodía empieza por la tarde', () => {
    const lista = ocurrencias(plantilla, '2026-11-23', '2026-11-23', new Date('2026-11-23T12:00:00Z'));
    expect(lista.map((o) => o.hora)).toEqual(['17:00']);
  });
});

describe('CU-56 Tarea atrasada', () => {
  const tarea = { status: 'pending' as const, dueAt: new Date('2026-11-23T08:00:00Z') };

  it('pendiente y pasada la hora más el margen', () => {
    expect(estaAtrasada(tarea, new Date('2026-11-23T08:30:00Z'), 30)).toBe(false);
    expect(estaAtrasada(tarea, new Date('2026-11-23T08:31:00Z'), 30)).toBe(true);
  });

  it('una tarea resuelta nunca está atrasada', () => {
    expect(estaAtrasada({ ...tarea, status: 'completed' }, new Date('2026-11-24T00:00:00Z'), 0)).toBe(false);
    expect(estaAtrasada({ ...tarea, status: 'not_done' }, new Date('2026-11-24T00:00:00Z'), 0)).toBe(false);
  });
});

describe('RN-40 Cada tarea asignada es de su persona', () => {
  it('una tarea asignada a otra persona no es tuya; la tuya o la que no tiene a nadie, sí', () => {
    expect(asignadaAOtraPersona(4, 3)).toBe(true);
    expect(asignadaAOtraPersona(3, 3)).toBe(false);
    expect(asignadaAOtraPersona(null, 3)).toBe(false);
  });
});

describe('CU-57 Completar una tarea: permisos', () => {
  const pendiente = { status: 'pending' as const, dueDate: '2026-11-23', qualificationId: null };
  const hoy = '2026-11-23';

  it('cualquier trabajador completa una tarea sin cualificación del día', () => {
    expect(comprobarResolucion(pendiente, [], hoy)).toBeNull();
  });

  it('si la tarea exige una cualificación, solo quien la tiene', () => {
    const medicacion = { ...pendiente, qualificationId: 1 };
    expect(comprobarResolucion(medicacion, [2, 3], hoy)).toBe('MISSING_QUALIFICATION');
    expect(comprobarResolucion(medicacion, [1], hoy)).toBeNull();
  });

  it('no se adelantan tareas de días futuros, pero sí se completan las atrasadas de días pasados', () => {
    expect(comprobarResolucion({ ...pendiente, dueDate: '2026-11-24' }, [], hoy)).toBe('FUTURE_DAY');
    expect(comprobarResolucion({ ...pendiente, dueDate: '2026-11-22' }, [], hoy)).toBeNull();
  });

  it('una tarea ya resuelta no se vuelve a resolver', () => {
    expect(comprobarResolucion({ ...pendiente, status: 'completed' }, [], hoy)).toBe('NOT_PENDING');
    expect(comprobarResolucion({ ...pendiente, status: 'not_done' }, [], hoy)).toBe('NOT_PENDING');
  });
});

describe('CU-54 Zona de una plantilla sin zona elegida', () => {
  it('es la de sus animales si todos viven en la misma', () => {
    expect(zonaComun([{ zoneId: 3 }, { zoneId: 3 }])).toBe(3);
  });

  it('no hay zona si viven en zonas distintas, si alguno no tiene o si no hay animales', () => {
    expect(zonaComun([{ zoneId: 1 }, { zoneId: 2 }])).toBeNull();
    expect(zonaComun([{ zoneId: null }])).toBeNull();
    expect(zonaComun([])).toBeNull();
  });
});
