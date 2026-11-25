import {
  isWorkerRole,
  type AbsenceCreatedDto,
  type AbsenceData,
  type AbsenceDto,
  type AbsencesQuery,
  type CopyWeekResultDto,
  type CoverageGapDto,
  type MyShiftsDto,
  type MyShiftsQuery,
  type SessionUser,
  type ShiftAssignmentData,
  type ShiftAssignmentDto,
  type ShiftsCalendarDto,
  type ShiftsQuery,
  type ShiftTemplateData,
  type ShiftTemplateDto,
} from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import type { Reloj } from '../dominio/reloj.js';
import { diasEntreFechas, sumarDias } from '../dominio/tareas.js';
import {
  comprobarEntrada,
  comprobarSalida,
  huecos,
  lunesDe,
  minutosTrabajados,
  planificarCopia,
  rangoDeFichajes,
  seHaceEl,
  seSolapan,
  type MotivoFichaje,
  type TurnoParaCalendario,
} from '../dominio/turnos.js';
import {
  AlreadyCheckedInError,
  AlreadyCheckedOutError,
  NotCheckedInError,
  NotFoundError,
  ShiftAlreadyStartedError,
  ShiftNotTodayError,
  ValidationError,
} from '../errors/app-error.js';
import * as absenceModel from '../models/absence.model.js';
import * as assignmentModel from '../models/shift-assignment.model.js';
import * as templateModel from '../models/shift-template.model.js';
import * as userModel from '../models/user.model.js';
import * as zoneModel from '../models/zone.model.js';

export interface ShiftServiceDeps {
  db: Pool;
  reloj: Reloj;
}

export type ShiftService = ReturnType<typeof createShiftService>;

const enCampo = (field: string, message: string) => new ValidationError([{ field, message }]);
const turnoNoExiste = () => new NotFoundError('Este turno no existe.');
const ausenciaNoExiste = () => new NotFoundError('Esta ausencia no existe.');

const aCalendario = (t: ShiftTemplateDto): TurnoParaCalendario => ({
  id: t.id,
  inicio: t.startTime,
  fin: t.endTime,
  weekdays: t.weekdays,
  isActive: t.isActive,
  requisitos: t.requirements.map((r) => ({ zoneId: r.zone.id, minWorkers: r.minWorkers })),
});

const fechasEntre = (desde: string, hasta: string) =>
  Array.from({ length: diasEntreFechas(desde, hasta) + 1 }, (_, i) => sumarDias(desde, i));

/** Todas las zonas indicadas existen y están activas. */
async function comprobarZonas(q: Queryable, campo: string, ids: readonly number[]): Promise<void> {
  for (const id of ids) {
    if (!(await zoneModel.isActive(q, id))) throw enCampo(campo, 'Esta zona no existe o está desactivada.');
  }
}

/**
 * CU-61 y CU-64: las zonas sin cubrir de un rango de días, en el orden de los
 * días, de los turnos (por la hora de inicio) y de las zonas (por nombre).
 */
export async function huecosDelRango(
  q: Queryable,
  desde: string,
  hasta: string,
  datos?: { turnos: ShiftTemplateDto[]; asignaciones: ShiftAssignmentDto[] },
): Promise<CoverageGapDto[]> {
  const turnos = datos?.turnos ?? (await templateModel.list(q));
  const asignaciones = datos?.asignaciones ?? (await assignmentModel.listByRange(q, { from: desde, to: hasta }));
  const porId = new Map(turnos.map((t) => [t.id, t]));
  return huecos(
    turnos.map(aCalendario),
    asignaciones.map((a) => ({ shiftId: a.shift.id, date: a.date, zoneIds: a.zones.map((z) => z.id) })),
    fechasEntre(desde, hasta),
  ).map((h) => {
    const turno = porId.get(h.shiftId)!;
    const zona = turno.requirements.find((r) => r.zone.id === h.zoneId)!.zone;
    return {
      date: h.date,
      shift: { id: turno.id, name: turno.name, startTime: turno.startTime, endTime: turno.endTime },
      zone: zona,
      required: h.required,
      assigned: h.assigned,
    };
  });
}

/** CU-63: cada motivo con su error. */
function lanzarSiNoSePuedeFichar(motivo: MotivoFichaje | null): void {
  if (motivo === 'SHIFT_NOT_TODAY') throw new ShiftNotTodayError();
  if (motivo === 'ALREADY_CHECKED_IN') throw new AlreadyCheckedInError();
  if (motivo === 'NOT_CHECKED_IN') throw new NotCheckedInError();
  if (motivo === 'ALREADY_CHECKED_OUT') throw new AlreadyCheckedOutError();
}

// CU-60 a CU-63: turnos, calendario, ausencias y fichajes.
export function createShiftService({ db, reloj }: ShiftServiceDeps) {
  async function plantilla(q: Queryable, id: number): Promise<ShiftTemplateDto> {
    const turno = await templateModel.findById(q, id);
    if (!turno) throw turnoNoExiste();
    return turno;
  }

  async function asignacion(q: Queryable, id: number): Promise<ShiftAssignmentDto> {
    const a = await assignmentModel.findById(q, id);
    if (!a) throw new NotFoundError('Esta asignación no existe.');
    return a;
  }

  /** Trabajador (activo, si se pide) o error en el campo. */
  async function trabajador(q: Queryable, campo: string, userId: number, mensaje: string, activo: boolean) {
    const user = await userModel.findById(q, userId);
    if (!user || !isWorkerRole(user.role) || (activo && !user.isActive)) throw enCampo(campo, mensaje);
    return user;
  }

  /** CU-63: fichar la entrada o la salida de un turno propio (uno ajeno es 404). */
  async function fichar(user: SessionUser, id: number, tipo: 'entrada' | 'salida'): Promise<ShiftAssignmentDto> {
    await withTransaction(db, async (client) => {
      if (!(await assignmentModel.lock(client, id))) throw new NotFoundError('Esta asignación no existe.');
      const a = await asignacion(client, id);
      if (a.user.id !== user.id) throw new NotFoundError('Esta asignación no existe.');
      if (tipo === 'entrada') {
        lanzarSiNoSePuedeFichar(comprobarEntrada(a, reloj.hoy()));
        await assignmentModel.checkIn(client, id, reloj.ahora());
      } else {
        lanzarSiNoSePuedeFichar(comprobarSalida(a, reloj.hoy()));
        await assignmentModel.checkOut(client, id, reloj.ahora());
      }
    });
    return asignacion(db, id);
  }

  async function guardarPlantilla(id: number | null, datos: ShiftTemplateData): Promise<ShiftTemplateDto> {
    await comprobarZonas(
      db,
      'requirements',
      datos.requirements.map((r) => r.zoneId),
    );
    const nuevoId = await withTransaction(db, async (client) => {
      const turnoId = id ?? (await templateModel.create(client, datos));
      if (id !== null && !(await templateModel.update(client, id, datos))) throw turnoNoExiste();
      await templateModel.setRequirements(client, turnoId, datos.requirements);
      return turnoId;
    });
    return plantilla(db, nuevoId);
  }

  return {
    // CU-60.
    listTemplates: async () => ({ data: await templateModel.list(db) }),
    getTemplate: (id: number) => plantilla(db, id),
    createTemplate: (datos: ShiftTemplateData) => guardarPlantilla(null, datos),
    updateTemplate: (id: number, datos: ShiftTemplateData) => guardarPlantilla(id, datos),
    /** A1: con personas asignadas no se borra (la BD lo impide y se traduce a 409). */
    async removeTemplate(id: number): Promise<ShiftTemplateDto> {
      const turno = await plantilla(db, id);
      await templateModel.remove(db, id);
      return turno;
    },

    /** CU-61: el calendario. Al cuidador, de las ausencias ajenas solo le llega que lo están. */
    async calendar(user: SessionUser, query: ShiftsQuery): Promise<ShiftsCalendarDto> {
      const from = query.from ?? lunesDe(reloj.hoy());
      const to = query.to ?? sumarDias(from, 6);
      const asignaciones = await assignmentModel.listByRange(db, { from, to });
      const turnos = await templateModel.list(db, { activasYEstas: [...new Set(asignaciones.map((a) => a.shift.id))] });
      const ausencias = (await absenceModel.list(db, { from, to })).map((a) =>
        user.role === 'admin' || a.user.id === user.id ? a : { ...a, type: null, notes: null },
      );
      const gaps = await huecosDelRango(db, from, to, { turnos, asignaciones });
      return { from, to, shifts: turnos, assignments: asignaciones, absences: ausencias, gaps };
    },

    /** CU-61 paso 3: asignar a una persona; sin zonas, las que necesita el turno. */
    async createAssignment(datos: ShiftAssignmentData, autorId: number): Promise<ShiftAssignmentDto> {
      const turno = await templateModel.findById(db, datos.shiftTemplateId);
      if (!turno || !turno.isActive) throw enCampo('shiftTemplateId', 'Este turno no existe o está desactivado.');
      if (datos.date < reloj.hoy()) throw enCampo('date', 'No se pueden asignar turnos de días pasados.');
      if (!seHaceEl(turno.weekdays, datos.date)) throw enCampo('date', 'Este turno no se hace ese día de la semana.');
      await trabajador(db, 'userId', datos.userId, 'Elige a un trabajador en activo.', true);
      if (await absenceModel.overlaps(db, datos.userId, datos.date, datos.date)) {
        throw enCampo('userId', 'Esta persona está ausente ese día.');
      }
      const zonas = datos.zoneIds.length > 0 ? datos.zoneIds : turno.requirements.map((r) => r.zone.id);
      await comprobarZonas(db, 'zoneIds', zonas);
      const id = await withTransaction(db, async (client) => {
        const suyos = await assignmentModel.listByRange(client, {
          from: datos.date,
          to: datos.date,
          userId: datos.userId,
        });
        const franja = { inicio: turno.startTime, fin: turno.endTime };
        if (suyos.some((a) => seSolapan({ inicio: a.shift.startTime, fin: a.shift.endTime }, franja))) {
          throw enCampo('userId', 'Esta persona ya tiene un turno a esa hora ese día.');
        }
        return assignmentModel.create(client, {
          shiftId: turno.id,
          date: datos.date,
          userId: datos.userId,
          zoneIds: zonas,
          createdBy: autorId,
        });
      });
      return asignacion(db, id);
    },

    /** CU-61 paso 4: solo si no se ha fichado y no es de un día pasado. */
    async removeAssignment(id: number): Promise<ShiftAssignmentDto> {
      return withTransaction(db, async (client) => {
        if (!(await assignmentModel.lock(client, id))) throw new NotFoundError('Esta asignación no existe.');
        const a = await asignacion(client, id);
        if (a.checkedInAt !== null || a.date < reloj.hoy()) throw new ShiftAlreadyStartedError();
        await assignmentModel.remove(client, [id]);
        return a;
      });
    },

    /** CU-61 paso 5: copia la semana anterior a la que empieza en `weekStart` (lunes). */
    async copyWeek(weekStart: string, autorId: number): Promise<CopyWeekResultDto & { createdIds: number[] }> {
      const finSemana = sumarDias(weekStart, 6);
      return withTransaction(db, async (client) => {
        const origen = await assignmentModel.listByRange(client, {
          from: sumarDias(weekStart, -7),
          to: sumarDias(weekStart, -1),
        });
        const destino = await assignmentModel.listByRange(client, { from: weekStart, to: finSemana });
        const turnos = await templateModel.list(client);
        const activos = await userModel.listActiveWorkerIds(client);
        const ausencias = await absenceModel.list(client, { from: weekStart, to: finSemana });
        const plan = planificarCopia(
          origen.map((a) => ({
            shiftId: a.shift.id,
            date: a.date,
            userId: a.user.id,
            zoneIds: a.zones.map((z) => z.id),
          })),
          {
            hoy: reloj.hoy(),
            turnos: new Map(turnos.map((t) => [t.id, aCalendario(t)])),
            usuariosActivos: new Set(activos),
            ausencias: ausencias.map((a) => ({ userId: a.user.id, startDate: a.startDate, endDate: a.endDate })),
            existentes: destino.map((a) => ({ shiftId: a.shift.id, date: a.date, userId: a.user.id })),
          },
        );
        const createdIds: number[] = [];
        for (const a of plan.crear) {
          createdIds.push(await assignmentModel.create(client, { ...a, createdBy: autorId }));
        }
        const original = (s: { shiftId: number; date: string; userId: number }) =>
          origen.find((a) => a.shift.id === s.shiftId && a.user.id === s.userId && a.date === sumarDias(s.date, -7))!;
        return {
          createdIds,
          created: plan.crear.length,
          skipped: plan.saltar.map((s) => {
            const a = original(s);
            return { date: s.date, user: a.user, shift: a.shift, reason: s.reason };
          }),
        };
      });
    },

    // CU-63.
    /** CU-63: los turnos propios de un rango, del más reciente al más antiguo, con lo trabajado. */
    async mine(user: SessionUser, query: MyShiftsQuery): Promise<MyShiftsDto> {
      const { from, to } = rangoDeFichajes(query, reloj.hoy());
      const turnos = await assignmentModel.listByRange(db, { from, to, userId: user.id });
      const data = turnos.reverse().map((a) => ({ ...a, workedMinutes: minutosTrabajados(a) }));
      return { from, to, data, totalWorkedMinutes: data.reduce((suma, a) => suma + (a.workedMinutes ?? 0), 0) };
    },
    checkIn: (user: SessionUser, id: number) => fichar(user, id, 'entrada'),
    checkOut: (user: SessionUser, id: number) => fichar(user, id, 'salida'),
    /** CU-56: los turnos de una persona un día. */
    ofUserOn: (userId: number, fecha: string) => assignmentModel.listByRange(db, { from: fecha, to: fecha, userId }),

    // CU-62.
    async listAbsences(query: AbsencesQuery): Promise<{ data: AbsenceDto[] }> {
      return { data: await absenceModel.list(db, { from: query.from ?? reloj.hoy(), to: query.to ?? null }) };
    },

    /** Pasos 2-3: quita los turnos de esos días que no se han fichado y dice cuáles. */
    async createAbsence(datos: AbsenceData, autorId: number): Promise<AbsenceCreatedDto> {
      await trabajador(db, 'userId', datos.userId, 'Elige a un trabajador.', false);
      return withTransaction(db, async (client) => {
        if (await absenceModel.overlaps(client, datos.userId, datos.startDate, datos.endDate)) {
          throw enCampo('startDate', 'Ya tiene una ausencia en esas fechas.');
        }
        const id = await absenceModel.create(client, datos, autorId);
        const turnos = await assignmentModel.listOfUser(client, datos.userId, datos.startDate, datos.endDate);
        const quitados = turnos.filter((a) => a.checkedInAt === null);
        await assignmentModel.remove(
          client,
          quitados.map((a) => a.id),
        );
        return {
          absence: (await absenceModel.findById(client, id))!,
          removedAssignments: quitados,
          keptAssignments: turnos.filter((a) => a.checkedInAt !== null),
        };
      });
    },

    async getAbsence(id: number): Promise<AbsenceDto> {
      const ausencia = await absenceModel.findById(db, id);
      if (!ausencia) throw ausenciaNoExiste();
      return ausencia;
    },

    /** A1: los turnos que se quitaron no vuelven. */
    async removeAbsence(id: number): Promise<AbsenceDto> {
      const ausencia = await absenceModel.findById(db, id);
      if (!ausencia) throw ausenciaNoExiste();
      await absenceModel.remove(db, id);
      return ausencia;
    },
  };
}
