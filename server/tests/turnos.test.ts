import { describe, expect, it } from 'vitest';
import {
  comprobarEntrada,
  comprobarSalida,
  esDeMiTurno,
  huecos,
  lunesDe,
  minutosTrabajados,
  planificarCopia,
  rangoDeFichajes,
  seSolapan,
  type TurnoParaCalendario,
} from '../src/dominio/turnos.js';

const MANANA: TurnoParaCalendario = {
  id: 1,
  inicio: '07:00',
  fin: '15:00',
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  isActive: true,
  requisitos: [
    { zoneId: 1, minWorkers: 1 },
    { zoneId: 4, minWorkers: 2 },
  ],
};
const TARDE: TurnoParaCalendario = {
  id: 2,
  inicio: '14:00',
  fin: '22:00',
  weekdays: [1, 2, 3, 4, 5],
  isActive: true,
  requisitos: [{ zoneId: 1, minWorkers: 1 }],
};

describe('CU-61 Franjas de los turnos', () => {
  it('dos franjas se solapan si comparten algún minuto; tocarse no es solaparse', () => {
    expect(seSolapan({ inicio: '07:00', fin: '15:00' }, { inicio: '14:00', fin: '22:00' })).toBe(true);
    expect(seSolapan({ inicio: '07:00', fin: '14:00' }, { inicio: '14:00', fin: '22:00' })).toBe(false);
    expect(seSolapan({ inicio: '08:00', fin: '10:00' }, { inicio: '07:00', fin: '15:00' })).toBe(true);
  });

  it('el lunes de la semana de una fecha', () => {
    expect(lunesDe('2026-11-23')).toBe('2026-11-23'); // lunes
    expect(lunesDe('2026-11-29')).toBe('2026-11-23'); // domingo
    expect(lunesDe('2026-12-02')).toBe('2026-11-30');
  });
});

describe('CU-61, CU-64 Huecos sin cubrir', () => {
  it('cuenta por zona las personas de cada turno y día y devuelve lo que falta', () => {
    const resultado = huecos(
      [MANANA, TARDE],
      [
        { shiftId: 1, date: '2026-11-23', zoneIds: [1, 4] },
        { shiftId: 1, date: '2026-11-23', zoneIds: [4] },
        { shiftId: 2, date: '2026-11-23', zoneIds: [1] },
        { shiftId: 1, date: '2026-11-28', zoneIds: [4] },
      ],
      ['2026-11-23', '2026-11-28'],
    );
    // El lunes está todo cubierto. El sábado falta el gran voladero y una
    // persona en la clínica; la tarde no se hace en fin de semana.
    expect(resultado).toEqual([
      { date: '2026-11-28', shiftId: 1, zoneId: 1, required: 1, assigned: 0 },
      { date: '2026-11-28', shiftId: 1, zoneId: 4, required: 2, assigned: 1 },
    ]);
  });

  it('un turno desactivado no tiene huecos', () => {
    expect(huecos([{ ...TARDE, isActive: false }], [], ['2026-11-23'])).toEqual([]);
  });
});

describe('CU-63 Fichar', () => {
  const hoy = '2026-11-23';
  it('la entrada, solo el día del turno y una vez', () => {
    expect(comprobarEntrada({ date: hoy, checkedInAt: null }, hoy)).toBeNull();
    expect(comprobarEntrada({ date: '2026-11-24', checkedInAt: null }, hoy)).toBe('SHIFT_NOT_TODAY');
    expect(comprobarEntrada({ date: hoy, checkedInAt: '2026-11-23T06:58:00Z' }, hoy)).toBe('ALREADY_CHECKED_IN');
  });

  it('la salida, después de la entrada y una vez', () => {
    expect(comprobarSalida({ date: hoy, checkedInAt: null, checkedOutAt: null }, hoy)).toBe('NOT_CHECKED_IN');
    expect(comprobarSalida({ date: hoy, checkedInAt: '2026-11-23T06:58:00Z', checkedOutAt: null }, hoy)).toBeNull();
    expect(
      comprobarSalida({ date: hoy, checkedInAt: '2026-11-23T06:58:00Z', checkedOutAt: '2026-11-23T15:02:00Z' }, hoy),
    ).toBe('ALREADY_CHECKED_OUT');
    expect(comprobarSalida({ date: '2026-11-22', checkedInAt: 'x', checkedOutAt: null }, hoy)).toBe('SHIFT_NOT_TODAY');
  });
});

describe('CU-56 Las tareas de mi turno', () => {
  const turnos = [{ inicio: '07:00', fin: '15:00', zoneIds: [4, 3] }];
  it('una tarea sin asignar es mía si es de una zona de mi turno y cae dentro de su horario', () => {
    expect(esDeMiTurno({ zoneId: 4, dueTime: '08:30' }, turnos)).toBe(true);
    expect(esDeMiTurno({ zoneId: 4, dueTime: '15:00' }, turnos)).toBe(false);
    expect(esDeMiTurno({ zoneId: 1, dueTime: '09:00' }, turnos)).toBe(false);
    expect(esDeMiTurno({ zoneId: null, dueTime: '09:00' }, turnos)).toBe(false);
    expect(esDeMiTurno({ zoneId: 4, dueTime: '09:00' }, [])).toBe(false);
  });
});

describe('CU-61 Copiar la semana anterior', () => {
  const turnos = new Map([
    [1, MANANA],
    [2, TARDE],
    [3, { ...TARDE, id: 3, inicio: '08:00', fin: '12:00', isActive: false }],
  ]);
  const base = {
    hoy: '2026-11-24',
    turnos,
    usuariosActivos: new Set([3, 4, 5]),
    ausencias: [{ userId: 5, startDate: '2026-11-26', endDate: '2026-11-27' }],
    existentes: [{ shiftId: 1, date: '2026-11-25', userId: 4 }],
  };

  it('copia cada turno siete días después y explica los que se salta', () => {
    const origen = [
      { shiftId: 1, date: '2026-11-16', userId: 3, zoneIds: [4] }, // → lunes 23: ya ha pasado
      { shiftId: 1, date: '2026-11-17', userId: 3, zoneIds: [4, 3] }, // → hoy: se copia
      { shiftId: 1, date: '2026-11-18', userId: 4, zoneIds: [1] }, // → ya lo tiene
      { shiftId: 2, date: '2026-11-18', userId: 4, zoneIds: [1] }, // → se solapa con su mañana
      { shiftId: 2, date: '2026-11-19', userId: 5, zoneIds: [1] }, // → ausente
      { shiftId: 2, date: '2026-11-20', userId: 9, zoneIds: [1] }, // → cuenta desactivada
      { shiftId: 3, date: '2026-11-20', userId: 3, zoneIds: [] }, // → turno desactivado
      { shiftId: 1, date: '2026-11-22', userId: 3, zoneIds: [4] }, // → domingo 29: se copia
    ];
    const plan = planificarCopia(origen, base);
    expect(plan.crear).toEqual([
      { shiftId: 1, date: '2026-11-24', userId: 3, zoneIds: [4, 3] },
      { shiftId: 1, date: '2026-11-29', userId: 3, zoneIds: [4] },
    ]);
    expect(plan.saltar.map((s) => [s.date, s.userId, s.shiftId, s.reason])).toEqual([
      ['2026-11-23', 3, 1, 'PAST'],
      ['2026-11-25', 4, 1, 'ALREADY_ASSIGNED'],
      ['2026-11-25', 4, 2, 'OVERLAP'],
      ['2026-11-26', 5, 2, 'ABSENT'],
      ['2026-11-27', 9, 2, 'INACTIVE_USER'],
      ['2026-11-27', 3, 3, 'INACTIVE_SHIFT'],
    ]);
  });

  it('un turno que no se hace ese día de la semana no se copia', () => {
    const plan = planificarCopia([{ shiftId: 2, date: '2026-11-22', userId: 3, zoneIds: [1] }], {
      ...base,
      turnos: new Map([[2, { ...TARDE, weekdays: [1, 2, 3, 4, 5] }]]),
    });
    expect(plan.saltar.map((s) => s.reason)).toEqual(['NOT_THAT_WEEKDAY']);
  });
});

describe('CU-63 Mis fichajes', () => {
  it('minutos trabajados: de la entrada a la salida, en minutos enteros', () => {
    expect(
      minutosTrabajados({ checkedInAt: '2026-11-23T05:58:00.000Z', checkedOutAt: '2026-11-23T14:05:30.000Z' }),
    ).toBe(487);
  });

  it('sin entrada o sin salida, no hay minutos', () => {
    expect(minutosTrabajados({ checkedInAt: null, checkedOutAt: null })).toBeNull();
    expect(minutosTrabajados({ checkedInAt: '2026-11-23T05:58:00.000Z', checkedOutAt: null })).toBeNull();
  });

  it('rango: por defecto, las últimas 4 semanas hasta hoy', () => {
    expect(rangoDeFichajes({}, '2026-11-24')).toEqual({ from: '2026-10-28', to: '2026-11-24' });
    expect(rangoDeFichajes({ to: '2026-11-10' }, '2026-11-24')).toEqual({ from: '2026-10-14', to: '2026-11-10' });
    expect(rangoDeFichajes({ from: '2026-11-01' }, '2026-11-24')).toEqual({ from: '2026-11-01', to: '2026-11-24' });
    expect(rangoDeFichajes({ from: '2026-11-01', to: '2026-11-03' }, '2026-11-24')).toEqual({
      from: '2026-11-01',
      to: '2026-11-03',
    });
  });
});
