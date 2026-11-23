import { z } from 'zod';
import { MAX_TEMPLATE_TIMES, TASK_RECURRENCES, TASK_STATUSES, TASK_TYPES } from '../constants/work.js';
import { textoObligatorio, textoOpcional } from './fields.js';

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

// CU-57: completar (observaciones y foto opcionales) o marcar como no realizada (motivo obligatorio).
export const taskCompleteBodySchema = z.object({
  observations: textoOpcional(1000),
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
});
export type WorkSettingsBody = z.input<typeof workSettingsBodySchema>;
export type WorkSettingsData = z.output<typeof workSettingsBodySchema>;
