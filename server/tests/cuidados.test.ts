import { describe, expect, it } from 'vitest';
import {
  animalesDeLaComida,
  claveAvisoComePoco,
  comprobarRegistroVisita,
  comprobarTerminarPauta,
  completarIngestas,
  destinatariosDelAviso,
  dietaVigente,
  esIngestaBaja,
  ocurrenciasDeLaPauta,
  pautaActiva,
  rachaDeComerPoco,
  tituloDeLaDosis,
} from '../src/dominio/cuidados.js';

describe('CU-65 Dieta de cada animal', () => {
  it('un alimento está vigente desde su inicio hasta su fin, ambos incluidos', () => {
    const item = { startDate: '2026-11-10', endDate: '2026-11-20' };
    expect(dietaVigente(item, '2026-11-09')).toBe(false);
    expect(dietaVigente(item, '2026-11-10')).toBe(true);
    expect(dietaVigente(item, '2026-11-20')).toBe(true);
    expect(dietaVigente(item, '2026-11-21')).toBe(false);
    expect(dietaVigente({ startDate: '2026-11-10', endDate: null }, '2030-01-01')).toBe(true);
  });
});

describe('CU-66 Anotar lo que ha comido cada animal', () => {
  const zona = [
    { id: 4, name: 'Olmo' },
    { id: 10, name: 'Carbón' },
  ];

  it('son los animales de la tarea o, si no tiene, los que viven en su zona', () => {
    expect(animalesDeLaComida([{ id: 14, name: 'Pipa' }], zona)).toEqual([{ id: 14, name: 'Pipa' }]);
    expect(animalesDeLaComida([], zona)).toEqual(zona);
  });

  it('lo que no se anota es «todo»', () => {
    expect(completarIngestas(zona, [{ animalId: 10, intake: 'none' }])).toEqual({
      ok: true,
      ingestas: [
        { animalId: 4, intake: 'all' },
        { animalId: 10, intake: 'none' },
      ],
    });
    expect(completarIngestas(zona, [])).toEqual({
      ok: true,
      ingestas: [
        { animalId: 4, intake: 'all' },
        { animalId: 10, intake: 'all' },
      ],
    });
  });

  it('un animal que no es de esa comida es un error', () => {
    expect(completarIngestas(zona, [{ animalId: 99, intake: 'all' }])).toEqual({ ok: false, animalId: 99 });
  });
});

describe('CU-67 Aviso si un animal come poco', () => {
  it('«menos de la mitad» y «nada» cuentan como comer poco', () => {
    expect(esIngestaBaja('all')).toBe(false);
    expect(esIngestaBaja('most')).toBe(false);
    expect(esIngestaBaja('little')).toBe(true);
    expect(esIngestaBaja('none')).toBe(true);
  });

  it('la racha cuenta las tomas seguidas comiendo poco desde la última', () => {
    // De la más reciente a la más antigua.
    expect(
      rachaDeComerPoco([
        { taskId: 30, intake: 'none' },
        { taskId: 20, intake: 'little' },
        { taskId: 10, intake: 'all' },
        { taskId: 5, intake: 'none' },
      ]),
    ).toEqual({ longitud: 2, primeraTaskId: 20 });
    expect(rachaDeComerPoco([{ taskId: 30, intake: 'most' }])).toEqual({ longitud: 0, primeraTaskId: null });
    expect(rachaDeComerPoco([])).toEqual({ longitud: 0, primeraTaskId: null });
  });

  it('cada racha se avisa una vez: la clave es el animal y la toma con la que empezó', () => {
    expect(claveAvisoComePoco(10, { longitud: 3, primeraTaskId: 20 })).toBe('10:20');
  });
});

describe('CU-67 y CU-69 Destinatarios de los avisos', () => {
  it('los administradores y quien tiene turno en la zona, sin repetir', () => {
    expect(destinatariosDelAviso([1, 2], [3, 1, 5])).toEqual([1, 2, 3, 5]);
  });
});

describe('CU-68 Visitas veterinarias programadas', () => {
  it('solo se registra una visita programada y a partir de su día', () => {
    expect(comprobarRegistroVisita({ status: 'scheduled', date: '2026-11-24' }, '2026-11-24')).toBeNull();
    expect(comprobarRegistroVisita({ status: 'scheduled', date: '2026-11-20' }, '2026-11-24')).toBeNull();
    expect(comprobarRegistroVisita({ status: 'scheduled', date: '2026-11-25' }, '2026-11-24')).toBe('FUTURE_DAY');
    expect(comprobarRegistroVisita({ status: 'done', date: '2026-11-24' }, '2026-11-24')).toBe('NOT_SCHEDULED');
    expect(comprobarRegistroVisita({ status: 'cancelled', date: '2026-11-24' }, '2026-11-24')).toBe('NOT_SCHEDULED');
  });
});

describe('CU-69 Pautas de medicación', () => {
  const pauta = { times: ['21:00', '09:00'], startDate: '2026-11-24', endDate: '2026-11-25' };

  it('una dosis por día y hora entre el inicio y el fin, solo las que no han pasado', () => {
    const ahora = new Date('2026-11-24T10:00:00Z'); // 11:00 en Madrid
    const lista = ocurrenciasDeLaPauta(pauta, '2026-11-24', '2026-11-30', ahora);
    expect(lista.map((o) => `${o.fecha} ${o.hora}`)).toEqual([
      '2026-11-24 21:00',
      '2026-11-25 09:00',
      '2026-11-25 21:00',
    ]);
  });

  it('está activa mientras no ha terminado (también si empieza más adelante)', () => {
    expect(pautaActiva({ endDate: null }, '2026-11-24')).toBe(true);
    expect(pautaActiva({ endDate: '2026-11-24' }, '2026-11-24')).toBe(true);
    expect(pautaActiva({ endDate: '2026-11-23' }, '2026-11-24')).toBe(false);
  });

  it('terminar: no si aún no ha empezado (se borra) ni si ya terminó', () => {
    expect(comprobarTerminarPauta({ startDate: '2026-11-20', endDate: null }, '2026-11-24')).toBeNull();
    expect(comprobarTerminarPauta({ startDate: '2026-11-20', endDate: '2026-11-30' }, '2026-11-24')).toBeNull();
    expect(comprobarTerminarPauta({ startDate: '2026-11-25', endDate: null }, '2026-11-24')).toBe('NOT_STARTED');
    expect(comprobarTerminarPauta({ startDate: '2026-11-01', endDate: '2026-11-23' }, '2026-11-24')).toBe(
      'ALREADY_ENDED',
    );
  });

  it('el título de cada dosis lleva el medicamento y la dosis', () => {
    expect(tituloDeLaDosis('Doxiciclina', '100 mg')).toBe('Doxiciclina · 100 mg');
  });
});
