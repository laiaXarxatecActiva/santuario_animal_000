import { z } from 'zod';
import { ANIMAL_SEXES } from '../constants/animals.js';
import { ALT_TEXT_MAX_LENGTH, MAX_FILES_PER_UPLOAD } from '../constants/media.js';
import { ROLES, WORKER_ROLES } from '../constants/roles.js';
import {
  ADOPTION_ADMIN_ACTIONS,
  ADOPTION_STATUSES,
  ANIMAL_STATUSES,
  MANUAL_PAYMENT_METHODS,
  VISIBILITIES,
} from '../constants/status.js';
import { USER_ACCOUNT_STATUSES } from '../constants/users.js';
import { donationAmount } from './donation.schema.js';
import { emailValido, telefono, textoObligatorio, textoOpcional as textoSinVacio } from './fields.js';
import { paginationQuerySchema } from './pagination.schema.js';

// Esquemas del panel de gestión (TECH_SPEC §10.6).

/** Texto opcional, recortado: vacío se guarda como `null`. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `No puede tener más de ${max} caracteres.` })
    .nullish()
    .transform((texto) => (texto ? texto : null));

const fecha = (obligatoria: string) => z.iso.date({ error: obligatoria });

const booleanoDeQuery = z
  .enum(['true', 'false'])
  .transform((valor) => valor === 'true')
  .optional();

// CU-30.
export const speciesBodySchema = z.object({
  name: textoObligatorio(100, 'Escribe el nombre de la especie.'),
  scientificName: textoOpcional(150),
  description: textoOpcional(2000),
});
export type SpeciesBody = z.input<typeof speciesBodySchema>;

// CU-40: planes de adopción, siempre mensuales (RN-04). El importe es texto de
// principio a fin, como en las donaciones (mayor que 0 y con dos decimales).
export const planCreateBodySchema = z.object({
  name: textoObligatorio(50, 'Escribe el nombre del plan.'),
  monthlyAmount: donationAmount,
  description: textoOpcional(500),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type PlanCreateBody = z.input<typeof planCreateBodySchema>;

/** 3a: `confirmAmountChange` confirma un nuevo importe para un plan con adopciones activas. */
export const planUpdateBodySchema = planCreateBodySchema.extend({
  confirmAmountChange: z.boolean().default(false),
});
export type PlanUpdateBody = z.input<typeof planUpdateBodySchema>;

// CU-35: listado de usuarios. Ordenación con lista blanca.
export const ADMIN_USER_SORTS = ['name', '-name', 'createdAt', '-createdAt', 'lastLoginAt', '-lastLoginAt'] as const;
export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number];

export const adminUsersQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(ADMIN_USER_SORTS).default('name'),
  q: z
    .string()
    .trim()
    .max(100)
    .transform((texto) => (texto === '' ? undefined : texto))
    .optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_ACCOUNT_STATUSES).optional(),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

/** CU-35 4 y A1: o se activa/desactiva la cuenta, o se cambia el rol (solo de trabajador). */
export const adminUserPatchSchema = z
  .strictObject({
    isActive: z.boolean().optional(),
    role: z.enum(WORKER_ROLES).optional(),
  })
  .refine((datos) => (datos.isActive === undefined) !== (datos.role === undefined), {
    error: 'Indica solo uno de los cambios: el estado o el rol.',
  });
export type AdminUserPatchBody = z.infer<typeof adminUserPatchSchema>;

/** CU-36 paso 2: nuevo trabajador. El teléfono es opcional. */
export const workerCreateSchema = z.object({
  firstName: textoObligatorio(100, 'Escribe el nombre.'),
  lastName: textoObligatorio(150, 'Escribe los apellidos.'),
  email: emailValido,
  phone: telefono.optional().transform((valor) => valor ?? null),
  role: z.enum(WORKER_ROLES, { error: 'Elige el rol.' }),
});
export type WorkerCreateBody = z.input<typeof workerCreateSchema>;
export type WorkerCreateInput = z.output<typeof workerCreateSchema>;

// CU-37: listado de adopciones (lista blanca de órdenes).
export const ADMIN_ADOPTION_SORTS = [
  '-createdAt',
  'createdAt',
  '-startDate',
  'startDate',
  'nextBillingDate',
  '-nextBillingDate',
] as const;
export type AdminAdoptionSort = (typeof ADMIN_ADOPTION_SORTS)[number];

const idOpcional = z.coerce.number().int().positive().optional();

export const adminAdoptionsQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(ADMIN_ADOPTION_SORTS).default('-createdAt'),
  q: z
    .string()
    .trim()
    .max(100)
    .transform((texto) => (texto === '' ? undefined : texto))
    .optional(),
  status: z.enum(ADOPTION_STATUSES).optional(),
  planId: idOpcional,
  animalId: idOpcional,
  userId: idOpcional,
});
export type AdminAdoptionsQuery = z.infer<typeof adminAdoptionsQuerySchema>;

const idElegido = (mensaje: string) =>
  z.coerce.number({ error: mensaje }).int({ error: mensaje }).positive({ error: mensaje });

/** CU-37 alta manual, paso 2: adoptante, animal, plan, método del primer pago y notas. */
export const adminAdoptionCreateSchema = z.object({
  userId: idElegido('Elige el adoptante.'),
  animalId: idElegido('Elige el animal.'),
  planId: idElegido('Elige el plan.'),
  method: z.enum(MANUAL_PAYMENT_METHODS, { error: 'Elige cómo se ha pagado.' }),
  notes: textoSinVacio(1000),
});
export type AdminAdoptionCreateBody = z.input<typeof adminAdoptionCreateSchema>;
export type AdminAdoptionCreateInput = z.output<typeof adminAdoptionCreateSchema>;

/** CU-37 A1-A3. Pausar y cancelar exigen el motivo, que se guarda en las notas internas. */
export const adminAdoptionStatusSchema = z
  .object({
    action: z.enum(ADOPTION_ADMIN_ACTIONS),
    notes: textoSinVacio(1000),
  })
  .superRefine((datos, ctx) => {
    if (datos.action !== 'resume' && datos.notes === undefined) {
      ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Escribe el motivo.' });
    }
  });
export type AdminAdoptionStatusBody = z.input<typeof adminAdoptionStatusSchema>;
export type AdminAdoptionStatusInput = z.output<typeof adminAdoptionStatusSchema>;

// CU-28: campos ordenables del listado (lista blanca).
export const ADMIN_ANIMAL_SORTS = ['name', '-name', 'arrivalDate', '-arrivalDate'] as const;
export type AdminAnimalSort = (typeof ADMIN_ANIMAL_SORTS)[number];

export const adminAnimalsQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(ADMIN_ANIMAL_SORTS).default('name'),
  q: z
    .string()
    .trim()
    .max(100)
    .transform((texto) => (texto === '' ? undefined : texto))
    .optional(),
  speciesId: z.coerce.number().int().positive().optional(),
  status: z.enum(ANIMAL_STATUSES).optional(),
  published: booleanoDeQuery,
  adoptable: booleanoDeQuery,
});
export type AdminAnimalsQuery = z.infer<typeof adminAnimalsQuerySchema>;

// CU-28 alta y edición. 2a: el nacimiento no puede ser posterior a la llegada.
export const animalBodySchema = z
  .object({
    name: textoObligatorio(100, 'Escribe el nombre del animal.'),
    speciesId: z.coerce.number({ error: 'Elige la especie.' }).int().positive({ error: 'Elige la especie.' }),
    breed: textoOpcional(100),
    sex: z.enum(ANIMAL_SEXES, { error: 'Elige el sexo.' }),
    approxBirthDate: z
      .union([z.literal(''), fecha('La fecha no es válida.')])
      .nullish()
      .transform((valor) => (valor ? valor : null)),
    arrivalDate: fecha('Indica la fecha de llegada.'),
    rescueStory: textoOpcional(5000),
    temperament: textoOpcional(2000),
    specialNeeds: textoOpcional(2000),
    healthSummary: textoOpcional(2000),
    isAdoptable: z.boolean(),
    isPublished: z.boolean(),
  })
  .refine((a) => a.approxBirthDate === null || a.approxBirthDate <= a.arrivalDate, {
    path: ['approxBirthDate'],
    message: 'La fecha de nacimiento no puede ser posterior a la de llegada.',
  });
export type AnimalBody = z.input<typeof animalBodySchema>;
export type AnimalData = z.infer<typeof animalBodySchema>;

// CU-28 A2-A3: cambio de estado. La fecha es la del suceso (por defecto, hoy).
export const animalStatusBodySchema = z.object({
  status: z.enum(ANIMAL_STATUSES, { error: 'Elige un estado.' }),
  date: fecha('La fecha no es válida.').optional(),
  /** CU-33 paso 3: mensaje redactado para los adoptantes (fallecimiento); vacío cuenta como ausente. */
  message: textoSinVacio(10000),
});
export type AnimalStatusBody = z.input<typeof animalStatusBodySchema>;
export type AnimalStatusData = z.infer<typeof animalStatusBodySchema>;

// CU-29: fotos y vídeos de la galería de un animal.
const FALTAN_DATOS_ARCHIVOS = 'Faltan los datos de los archivos.';

/** Campo de texto de un formulario multipart que contiene JSON. */
const jsonDeTexto = z.string({ error: FALTAN_DATOS_ARCHIVOS }).transform((texto, ctx) => {
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    ctx.addIssue({ code: 'custom', message: FALTAN_DATOS_ARCHIVOS });
    return z.NEVER;
  }
});

const altText = textoObligatorio(ALT_TEXT_MAX_LENGTH, 'Escribe el texto alternativo.');
const visibilidad = z.enum(VISIBILITIES, { error: 'Elige la visibilidad.' });

/** Datos de un archivo subido (paso 3): texto alternativo y visibilidad. */
export const photoMetaSchema = z.object({ altText, visibility: visibilidad.default('public') });
export type PhotoMeta = z.infer<typeof photoMetaSchema>;

/**
 * Campos de texto de la subida (`multipart/form-data`): `meta` es un JSON con
 * los datos de cada archivo, en el mismo orden que los archivos.
 */
export const photoUploadBodySchema = z.object({
  meta: jsonDeTexto.pipe(z.array(photoMetaSchema, { error: FALTAN_DATOS_ARCHIVOS }).max(MAX_FILES_PER_UPLOAD)),
});

// A1: edición.
export const photoPatchBodySchema = z.object({ altText, visibility: visibilidad });
export type PhotoPatchBody = z.infer<typeof photoPatchBodySchema>;

// Pasos 5-6: orden y portada.
const idPositivo = z.number().int().positive();
export const photoOrderBodySchema = z.object({ photoIds: z.array(idPositivo).min(1).max(500) });
export type PhotoOrderBody = z.infer<typeof photoOrderBodySchema>;

export const coverBodySchema = z.object({ photoId: idPositivo });
export type CoverBody = z.infer<typeof coverBodySchema>;

// CU-31 y CU-32: actualizaciones. Llegan en multipart (todo como texto, y las
// listas como JSON) o en JSON si no llevan archivos.

/** Lista que puede llegar como JSON dentro de un campo de texto; vacía si no se envía. */
const listaJson = <T extends z.ZodType>(item: T, mensaje: string) =>
  z.preprocess(
    (valor) => {
      if (valor === undefined || valor === '') return [];
      if (typeof valor !== 'string') return valor;
      try {
        return JSON.parse(valor) as unknown;
      } catch {
        return valor;
      }
    },
    z.array(item, { error: mensaje }),
  );

/** Archivo adjunto a una actualización: su visibilidad es la de la actualización. */
export const updateMediaMetaSchema = z.object({ altText });

const camposActualizacion = {
  title: textoObligatorio(200, 'Escribe el título.'),
  body: textoObligatorio(10000, 'Escribe el texto.'),
  visibility: visibilidad.default('adopters'),
  meta: listaJson(updateMediaMetaSchema, FALTAN_DATOS_ARCHIVOS).pipe(
    z.array(updateMediaMetaSchema).max(MAX_FILES_PER_UPLOAD),
  ),
};

// CU-31 paso 2.
export const updateCreateBodySchema = z.object({
  animalId: z.coerce.number({ error: 'Elige el animal.' }).int().positive({ error: 'Elige el animal.' }),
  ...camposActualizacion,
});
export type UpdateCreateBody = z.input<typeof updateCreateBodySchema>;
export type UpdateCreateData = z.infer<typeof updateCreateBodySchema>;

// CU-32 paso 2: el animal no cambia; se pueden añadir y quitar fotos.
export const updateEditBodySchema = z.object({
  ...camposActualizacion,
  removePhotoIds: listaJson(idPositivo, 'La lista de fotos no es válida.'),
});
export type UpdateEditData = z.infer<typeof updateEditBodySchema>;

// CU-31: listado del panel.
export const adminUpdatesQuerySchema = paginationQuerySchema.extend({
  animalId: z.coerce.number().int().positive().optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  authorId: z.coerce.number().int().positive().optional(),
});
export type AdminUpdatesQuery = z.infer<typeof adminUpdatesQuerySchema>;
