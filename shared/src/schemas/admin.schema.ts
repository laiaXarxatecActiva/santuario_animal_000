import { z } from 'zod';
import { ANIMAL_SEXES } from '../constants/animals.js';
import { ALT_TEXT_MAX_LENGTH, MAX_FILES_PER_UPLOAD } from '../constants/media.js';
import { ANIMAL_STATUSES, VISIBILITIES } from '../constants/status.js';
import { textoObligatorio } from './fields.js';
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
});
export type AnimalStatusBody = z.infer<typeof animalStatusBodySchema>;

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
