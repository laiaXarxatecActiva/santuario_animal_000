import { z } from 'zod';
import {
  ABSENCE_TYPES,
  FOOD_UNITS,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_TITLE_MAX,
  INCIDENT_STATUSES,
  INTAKE_LEVELS,
  MAX_LOW_INTAKE_MEALS,
  MAX_MY_SHIFTS_RANGE_DAYS,
  MAX_SHIFT_RANGE_DAYS,
  MEDICATION_ROUTES,
  MAX_TEMPLATE_TIMES,
  STAFF_EMAIL_ALERT_TYPES,
  TASK_RECURRENCES,
  TASK_STATUSES,
  TASK_TYPES,
} from '../constants/work.js';
import { textoObligatorio, textoOpcional } from './fields.js';
import { paginationQuerySchema } from './pagination.schema.js';

// Trabajo diario del personal (CU-52 a CU-58).

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Hora `HH:MM` de Madrid. */
export const hora = z.string().trim().regex(HORA_RE, { error: 'Escribe la hora como HH:MM.' });

const fecha = (mensaje: string) => z.iso.date({ error: mensaje });

const idOpcional = z
  .union([z.literal('').transform(() => null), z.coerce.number().int().positive(), z.null()])
  .optional()
  .transform((v) => v ?? null);

const idsUnicos = z
  .array(z.coerce.number().int().positive())
  .max(50)
  .default([])
  .transform((ids) => [...new Set(ids)]);

// CU-52: zonas.
export const zoneBodySchema = z.object({
  name: textoObligatorio(100, 'Escribe el nombre de la zona.'),
  description: textoOpcional(2000),
  isActive: z.boolean().default(true),
});
export type ZoneBody = z.input<typeof zoneBodySchema>;
export type ZoneData = z.output<typeof zoneBodySchema>;

// CU-53: cualificaciones y las de cada trabajador.
export const qualificationBodySchema = z.object({
  name: textoObligatorio(100, 'Escribe el nombre de la cualificación.'),
  description: textoOpcional(2000),
});
export type QualificationBody = z.input<typeof qualificationBodySchema>;
export type QualificationData = z.output<typeof qualificationBodySchema>;

export const userQualificationsBodySchema = z.object({ qualificationIds: idsUnicos });
export type UserQualificationsBody = z.input<typeof userQualificationsBodySchema>;

// CU-54: plantillas de tareas recurrentes.
export const taskTemplateBodySchema = z
  .object({
    type: z.enum(TASK_TYPES, { error: 'Elige el tipo de tarea.' }),
    title: textoObligatorio(150, 'Escribe el título.'),
    description: textoOpcional(2000),
    zoneId: idOpcional,
    animalIds: idsUnicos,
    qualificationId: idOpcional,
    times: z
      .array(hora)
      .min(1, { error: 'Añade al menos una hora.' })
      .max(MAX_TEMPLATE_TIMES, { error: `Como máximo ${MAX_TEMPLATE_TIMES} horas al día.` })
      .transform((horas) => [...new Set(horas)].sort()),
    recurrence: z.enum(TASK_RECURRENCES, { error: 'Elige cada cuánto se repite.' }),
    weekdays: z
      .array(z.coerce.number().int().min(1).max(7))
      .nullish()
      .transform((dias) => (dias && dias.length > 0 ? [...new Set(dias)].sort() : null)),
    intervalDays: z
      .union([z.literal('').transform(() => null), z.coerce.number().int(), z.null()])
      .optional()
      .transform((v) => v ?? null),
    startDate: fecha('Elige la fecha de inicio.'),
    endDate: z
      .union([z.literal('').transform(() => null), fecha('La fecha no es válida.'), z.null()])
      .optional()
      .transform((v) => v ?? null),
    isActive: z.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    if (p.zoneId === null && p.animalIds.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['zoneId'], message: 'Elige una zona o al menos un animal.' });
    }
    if (p.recurrence === 'weekdays' && p.weekdays === null) {
      ctx.addIssue({ code: 'custom', path: ['weekdays'], message: 'Elige al menos un día de la semana.' });
    }
    if (p.recurrence === 'every_n_days' && (p.intervalDays === null || p.intervalDays < 2 || p.intervalDays > 365)) {
      ctx.addIssue({ code: 'custom', path: ['intervalDays'], message: 'Indica cada cuántos días (de 2 a 365).' });
    }
    if (p.endDate !== null && p.endDate < p.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'La fecha de fin no puede ser anterior a la de inicio.',
      });
    }
  })
  // Lo que no corresponde a la recurrencia elegida se descarta.
  .transform((p) => ({
    ...p,
    weekdays: p.recurrence === 'weekdays' ? p.weekdays : null,
    intervalDays: p.recurrence === 'every_n_days' ? p.intervalDays : null,
  }));
export type TaskTemplateBody = z.input<typeof taskTemplateBodySchema>;
export type TaskTemplateData = z.output<typeof taskTemplateBodySchema>;

// CU-55: tareas del día (listado del administrador) y tareas puntuales.
export const adminTasksQuerySchema = z.object({
  date: fecha('La fecha no es válida.').optional(),
  zoneId: z.coerce.number().int().positive().optional(),
  status: z.enum(TASK_STATUSES).optional(),
});
export type AdminTasksQuery = z.infer<typeof adminTasksQuerySchema>;

export const oneOffTaskBodySchema = z
  .object({
    type: z.enum(TASK_TYPES, { error: 'Elige el tipo de tarea.' }),
    title: textoObligatorio(150, 'Escribe el título.'),
    description: textoOpcional(2000),
    zoneId: idOpcional,
    animalIds: idsUnicos,
    qualificationId: idOpcional,
    dueDate: fecha('Elige el día.'),
    dueTime: hora,
    assignedTo: idOpcional,
  })
  .refine((t) => t.zoneId !== null || t.assignedTo !== null || t.animalIds.length > 0, {
    path: ['zoneId'],
    message: 'Elige una zona, un animal o una persona.',
  });
export type OneOffTaskBody = z.input<typeof oneOffTaskBodySchema>;
export type OneOffTaskData = z.output<typeof oneOffTaskBodySchema>;

export const taskAssigneeBodySchema = z.object({
  userId: z.number().int().positive().nullable(),
});
export type TaskAssigneeBody = z.infer<typeof taskAssigneeBodySchema>;

/** CU-66: lo que ha comido cada animal en una tarea de alimentación. Los animales que no aparecen, «todo». */
const ingestas = z
  .array(
    z.object({
      animalId: z.coerce.number().int().positive(),
      intake: z.enum(INTAKE_LEVELS, { error: 'Elige cuánto ha comido.' }),
    }),
  )
  .max(100)
  .optional()
  .transform((v) => v ?? []);

// CU-57: completar (observaciones opcionales; sin fotos) o marcar como no realizada (motivo obligatorio).
export const taskCompleteBodySchema = z.object({
  observations: textoOpcional(1000),
  intakes: ingestas,
});
export type TaskCompleteBody = z.input<typeof taskCompleteBodySchema>;

export const taskNotDoneBodySchema = z.object({
  reason: textoObligatorio(1000, 'Explica por qué no se ha podido hacer.'),
});
export type TaskNotDoneBody = z.input<typeof taskNotDoneBodySchema>;

// CU-56: «Mi día»; sin fecha, hoy.
export const myDayQuerySchema = z.object({
  date: fecha('La fecha no es válida.').optional(),
});
export type MyDayQuery = z.infer<typeof myDayQuerySchema>;

// CU-73: ajustes del trabajo diario.
export const workSettingsBodySchema = z.object({
  lateMarginMinutes: z.coerce
    .number({ error: 'Indica los minutos.' })
    .int({ error: 'Indica los minutos.' })
    .min(0, { error: 'Entre 0 y 240 minutos.' })
    .max(240, { error: 'Entre 0 y 240 minutos.' }),
  /** CU-67: tomas seguidas comiendo poco para avisar. Si falta, no cambia. */
  lowIntakeMeals: z.coerce
    .number({ error: `De 1 a ${MAX_LOW_INTAKE_MEALS} tomas.` })
    .int({ error: `De 1 a ${MAX_LOW_INTAKE_MEALS} tomas.` })
    .min(1, { error: `De 1 a ${MAX_LOW_INTAKE_MEALS} tomas.` })
    .max(MAX_LOW_INTAKE_MEALS, { error: `De 1 a ${MAX_LOW_INTAKE_MEALS} tomas.` })
    .optional(),
});
export type WorkSettingsBody = z.input<typeof workSettingsBodySchema>;
export type WorkSettingsData = z.output<typeof workSettingsBodySchema>;

// CU-60: plantillas de turno con las personas que necesita cada zona.
const diasSemana = z
  .array(z.coerce.number().int().min(1).max(7))
  .min(1, { error: 'Elige al menos un día de la semana.' })
  .transform((dias) => [...new Set(dias)].sort());

export const shiftTemplateBodySchema = z
  .object({
    name: textoObligatorio(100, 'Escribe el nombre del turno.'),
    startTime: hora,
    endTime: hora,
    weekdays: diasSemana,
    requirements: z
      .array(
        z.object({
          zoneId: z.coerce.number().int().positive(),
          minWorkers: z.coerce
            .number({ error: 'De 1 a 20 personas.' })
            .int({ error: 'De 1 a 20 personas.' })
            .min(1, { error: 'De 1 a 20 personas.' })
            .max(20, { error: 'De 1 a 20 personas.' }),
        }),
      )
      .max(50)
      .default([]),
    isActive: z.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    if (p.endTime <= p.startTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'La hora de fin debe ser posterior a la de inicio.' });
    }
    const zonas = p.requirements.map((r) => r.zoneId);
    if (new Set(zonas).size !== zonas.length) {
      ctx.addIssue({ code: 'custom', path: ['requirements'], message: 'Cada zona solo puede aparecer una vez.' });
    }
  });
export type ShiftTemplateBody = z.input<typeof shiftTemplateBodySchema>;
export type ShiftTemplateData = z.output<typeof shiftTemplateBodySchema>;

/** Diferencia en días entre dos fechas `YYYY-MM-DD`. */
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

// CU-61: calendario de un rango de días (como mucho 31). Sin fechas, la semana
// actual; con solo `from`, los 7 días que empiezan ese día (los pone el servidor).
export const shiftsQuerySchema = z
  .object({
    from: fecha('La fecha no es válida.').optional(),
    to: fecha('La fecha no es válida.').optional(),
  })
  .superRefine((q, ctx) => {
    if (q.to !== undefined && q.from === undefined) {
      ctx.addIssue({ code: 'custom', path: ['from'], message: 'Elige la fecha de inicio.' });
      return;
    }
    if (q.from === undefined || q.to === undefined) return;
    const dias = diasEntre(q.from, q.to);
    if (dias < 0) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'La fecha de fin no puede ser anterior a la de inicio.' });
    } else if (dias >= MAX_SHIFT_RANGE_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: `Como máximo ${MAX_SHIFT_RANGE_DAYS} días.` });
    }
  });
export type ShiftsQuery = z.infer<typeof shiftsQuerySchema>;

// CU-63: «Mis fichajes». Sin fechas, las últimas 4 semanas hasta hoy.
export const myShiftsQuerySchema = z
  .object({
    from: fecha('La fecha no es válida.').optional(),
    to: fecha('La fecha no es válida.').optional(),
  })
  .superRefine((q, ctx) => {
    if (q.from === undefined || q.to === undefined) return;
    const dias = diasEntre(q.from, q.to);
    if (dias < 0) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'La fecha de fin no puede ser anterior a la de inicio.' });
    } else if (dias >= MAX_MY_SHIFTS_RANGE_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: `Como máximo ${MAX_MY_SHIFTS_RANGE_DAYS} días.` });
    }
  });
export type MyShiftsQuery = z.infer<typeof myShiftsQuerySchema>;

export const shiftAssignmentBodySchema = z.object({
  shiftTemplateId: z.coerce.number({ error: 'Elige el turno.' }).int().positive({ error: 'Elige el turno.' }),
  date: fecha('Elige el día.'),
  userId: z.coerce.number({ error: 'Elige a una persona.' }).int().positive({ error: 'Elige a una persona.' }),
  /** Sin zonas, las que necesita el turno. */
  zoneIds: idsUnicos,
});
export type ShiftAssignmentBody = z.input<typeof shiftAssignmentBodySchema>;
export type ShiftAssignmentData = z.output<typeof shiftAssignmentBodySchema>;

export const copyWeekBodySchema = z.object({
  weekStart: fecha('Elige la semana.').refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1, {
    error: 'La semana empieza en lunes.',
  }),
});
export type CopyWeekBody = z.infer<typeof copyWeekBodySchema>;

// CU-62: ausencias.
export const absenceBodySchema = z
  .object({
    userId: z.coerce.number({ error: 'Elige a una persona.' }).int().positive({ error: 'Elige a una persona.' }),
    startDate: fecha('Elige el primer día.'),
    endDate: fecha('Elige el último día.'),
    type: z.enum(ABSENCE_TYPES, { error: 'Elige el motivo.' }),
    notes: textoOpcional(500),
  })
  .refine((a) => a.endDate >= a.startDate, {
    path: ['endDate'],
    message: 'El último día no puede ser anterior al primero.',
  });
export type AbsenceBody = z.input<typeof absenceBodySchema>;
export type AbsenceData = z.output<typeof absenceBodySchema>;

export const absencesQuerySchema = z.object({
  from: fecha('La fecha no es válida.').optional(),
  to: fecha('La fecha no es válida.').optional(),
});
export type AbsencesQuery = z.infer<typeof absencesQuerySchema>;

// CU-65 a CU-69: alimentación, visitas veterinarias y medicación.

const fechaFinOpcional = z
  .union([z.literal('').transform(() => null), fecha('La fecha no es válida.'), z.null()])
  .optional()
  .transform((v) => v ?? null);

/** Texto opcional que se guarda como `null` si falta. */
const textoONulo = (max: number) => textoOpcional(max).transform((v) => v ?? null);

const finNoAnterior = <T extends { startDate: string; endDate: string | null }>(p: T, ctx: z.RefinementCtx) => {
  if (p.endDate !== null && p.endDate < p.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'La fecha de fin no puede ser anterior a la de inicio.',
    });
  }
};

/** Cantidad con coma o punto y dos decimales como máximo (NUMERIC(8,2)), mayor que 0. */
const CANTIDAD_RE = /^(\d{1,6})(?:[.,](\d{1,2}))?$/;
const cantidad = z.union([z.number().transform(String), z.string()]).pipe(
  z
    .string()
    .trim()
    .regex(CANTIDAD_RE, { error: 'Escribe la cantidad con dos decimales como máximo.' })
    .refine((v) => /[1-9]/.test(v), { error: 'La cantidad debe ser mayor que 0.' })
    .transform((v) => {
      const [, enteros = '0', decimales = ''] = CANTIDAD_RE.exec(v) ?? [];
      return `${enteros.replace(/^0+(?=\d)/, '')}.${decimales.padEnd(2, '0')}`;
    }),
);

// CU-65: un alimento de la dieta de un animal.
export const dietItemBodySchema = z
  .object({
    food: textoObligatorio(150, 'Escribe el alimento.'),
    quantity: cantidad,
    unit: z.enum(FOOD_UNITS, { error: 'Elige la unidad.' }),
    schedule: textoONulo(100),
    notes: textoONulo(1000),
    startDate: fecha('Elige la fecha de inicio.'),
    endDate: fechaFinOpcional,
  })
  .superRefine(finNoAnterior);
export type DietItemBody = z.input<typeof dietItemBodySchema>;
export type DietItemData = z.output<typeof dietItemBodySchema>;

// CU-68: programar (o cambiar) una visita veterinaria.
export const vetVisitBodySchema = z.object({
  date: fecha('Elige el día.'),
  time: hora,
  reason: textoObligatorio(500, 'Escribe el motivo de la visita.'),
  veterinarian: textoONulo(150),
});
export type VetVisitBody = z.input<typeof vetVisitBodySchema>;
export type VetVisitData = z.output<typeof vetVisitBodySchema>;

// CU-69: pauta de medicación (todos los días, a las horas indicadas).
export const medicationPlanBodySchema = z
  .object({
    medication: textoObligatorio(150, 'Escribe el medicamento.'),
    dose: textoObligatorio(100, 'Escribe la dosis.'),
    route: z.enum(MEDICATION_ROUTES, { error: 'Elige la vía.' }),
    times: z
      .array(hora)
      .min(1, { error: 'Añade al menos una hora.' })
      .max(MAX_TEMPLATE_TIMES, { error: `Como máximo ${MAX_TEMPLATE_TIMES} horas al día.` })
      .transform((horas) => [...new Set(horas)].sort()),
    startDate: fecha('Elige la fecha de inicio.'),
    endDate: fechaFinOpcional,
    qualificationId: idOpcional,
    notes: textoONulo(1000),
  })
  .superRefine(finNoAnterior);
export type MedicationPlanBody = z.input<typeof medicationPlanBodySchema>;
export type MedicationPlanData = z.output<typeof medicationPlanBodySchema>;

// CU-70: comunicar una incidencia (JSON o multipart con hasta 5 fotos en `files`).
// La zona y el animal son opcionales: puede no tener ninguno.
export const incidentBodySchema = z.object({
  category: z.enum(INCIDENT_CATEGORIES, { error: 'Elige el tipo de incidencia.' }),
  severity: z.enum(INCIDENT_SEVERITIES, { error: 'Elige la gravedad.' }),
  // Resumen corto que se ve en el listado, en «Hoy» y en los avisos.
  title: z
    .string({ error: 'Escribe un título corto.' })
    .trim()
    .min(3, { error: 'Escribe un título corto.' })
    .max(INCIDENT_TITLE_MAX, { error: `El título no puede pasar de ${INCIDENT_TITLE_MAX} caracteres.` }),
  description: textoObligatorio(2000, 'Describe lo que pasa.'),
  zoneId: idOpcional,
  animalId: idOpcional,
});
export type IncidentBody = z.input<typeof incidentBodySchema>;
export type IncidentData = z.output<typeof incidentBodySchema>;

// CU-70: listado; sin estado, las abiertas y en curso.
export const incidentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum([...INCIDENT_STATUSES, 'active', 'all']).default('active'),
  severity: z.enum(INCIDENT_SEVERITIES).optional(),
  zoneId: z.coerce.number().int().positive().optional(),
});
export type IncidentsQuery = z.infer<typeof incidentsQuerySchema>;

// CU-70: el personal la resuelve (con cómo se resolvió) o la reabre. «En curso» no
// se pone a mano: lo pone su tarea.
export const incidentStatusBodySchema = z
  .object({
    status: z.enum(['open', 'resolved'], { error: 'Elige el estado.' }),
    note: textoONulo(2000),
  })
  .refine((b) => b.status !== 'resolved' || b.note !== null, {
    path: ['note'],
    message: 'Explica cómo se ha resuelto.',
  });
export type IncidentStatusBody = z.input<typeof incidentStatusBodySchema>;
export type IncidentStatusData = z.output<typeof incidentStatusBodySchema>;

// CU-71: nota de relevo para quien venga después a una zona.
export const handoverNoteBodySchema = z.object({
  zoneId: z.coerce.number({ error: 'Elige la zona.' }).int().positive({ error: 'Elige la zona.' }),
  body: textoObligatorio(1000, 'Escribe la nota.'),
});
export type HandoverNoteBody = z.input<typeof handoverNoteBodySchema>;
export type HandoverNoteData = z.output<typeof handoverNoteBodySchema>;

// CU-73 y CU-74: avisos por email y resumen diario.
export const alertSettingsBodySchema = z.object({
  emailAlertTypes: z
    .array(z.enum(STAFF_EMAIL_ALERT_TYPES, { error: 'Este aviso no existe.' }))
    .transform((tipos) => STAFF_EMAIL_ALERT_TYPES.filter((t) => tipos.includes(t))),
  dailySummaryEnabled: z.boolean(),
  dailySummaryTime: hora,
});
export type AlertSettingsBody = z.input<typeof alertSettingsBodySchema>;
export type AlertSettingsData = z.output<typeof alertSettingsBodySchema>;
