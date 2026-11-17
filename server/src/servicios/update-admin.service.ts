import type {
  AdminUpdateCreatedDto,
  AdminUpdateDto,
  AdminUpdateListItemDto,
  AdminUpdatesQuery,
  Paginated,
  Role,
  UpdateCreateData,
  UpdateEditData,
} from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import {
  fotosQuitadasValidas,
  puedeModificarActualizacion,
  puedePublicarActualizacion,
} from '../dominio/actualizaciones.js';
import { extracto, recibeEmailPorActualizacion } from '../dominio/avisos.js';
import type { ArchivoSubido } from '../dominio/fotos.js';
import { paginar } from '../dominio/paginacion.js';
import type { Reloj } from '../dominio/reloj.js';
import {
  FieldRuleError,
  FilesRejectedError,
  NotFoundError,
  NotUpdateAuthorError,
  UpdateAnimalArchivedError,
  ValidationError,
} from '../errors/app-error.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as animalModel from '../models/animal-admin.model.js';
import * as updateModel from '../models/animal-update.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as photoModel from '../models/photo.model.js';
import type { EmailService } from '../services/email/email.service.js';
import { newUpdateEmail } from '../services/email/templates/new-update.js';
import { urlsDe, type MediaUploader, type MedioGuardado } from './media-upload.service.js';

export interface UpdateAdminServiceDeps {
  db: Pool;
  reloj: Reloj;
  media: MediaUploader;
  email: EmailService;
  clientUrl: string;
  logEmailError?: (error: unknown) => void;
}

/** Quien hace la petición (autor o administrador). */
export interface Trabajador {
  id: number;
  role: Role;
}

export type UpdateAdminService = ReturnType<typeof createUpdateAdminService>;

const noExiste = () => new NotFoundError('Esta actualización no existe.');

// CU-31 Publicar una actualización y CU-32 Editar o borrar una actualización.
const LARGO_EXTRACTO = 300;

export function createUpdateAdminService({
  db,
  reloj,
  media,
  email,
  clientUrl,
  logEmailError = () => {},
}: UpdateAdminServiceDeps) {
  const fila = (r: updateModel.AdminUpdateRecord, usuario: Trabajador): AdminUpdateListItemDto => ({
    id: r.id,
    animal: r.animal,
    author: r.author,
    title: r.title,
    visibility: r.visibility,
    publishedAt: r.publishedAt,
    photoCount: r.photoCount,
    canEdit: puedeModificarActualizacion(usuario, r.author.id),
  });

  async function detalle(q: Queryable, id: number, usuario: Trabajador): Promise<AdminUpdateDto> {
    const r = await updateModel.findAdminById(q, id);
    if (!r) throw noExiste();
    const fotos = await photoModel.listByUpdateAdmin(q, id);
    return { ...fila(r, usuario), body: r.body, updatedAt: r.updatedAt, photos: fotos.map(photoModel.toAdminDto) };
  }

  /** Precondición de CU-31: el animal existe y no está archivado. */
  async function comprobarAnimal(q: Queryable, animalId: number): Promise<void> {
    const status = await animalModel.findStatus(q, animalId);
    if (status === null) throw new FieldRuleError('ANIMAL_NOT_FOUND', 'animalId', 'Este animal no existe.');
    if (!puedePublicarActualizacion(status)) throw new UpdateAnimalArchivedError();
  }

  /** CU-32: existe y quien la modifica es su autor o un administrador. */
  async function modificable(q: Queryable, id: number, usuario: Trabajador, forUpdate = false) {
    const r = await updateModel.findAdminById(q, id, { forUpdate });
    if (!r) throw noExiste();
    if (!puedeModificarActualizacion(usuario, r.author.id)) throw new NotUpdateAuthorError();
    return r;
  }

  /** Guarda los adjuntos: se publican todos o ninguno. */
  async function guardarAdjuntos(
    animalId: number,
    archivos: ArchivoSubido[],
    metas: readonly unknown[],
  ): Promise<MedioGuardado[]> {
    if (metas.length !== archivos.length) {
      throw new ValidationError([{ field: 'meta', message: 'Indica el texto alternativo de cada archivo.' }]);
    }
    if (archivos.length === 0) return [];
    const { guardados, rechazados, indicesRechazados } = await media.guardar(animalId, archivos);
    if (rechazados.length > 0) {
      await media.borrar(urlsDe(guardados));
      throw new FilesRejectedError(
        rechazados.map((r, i) => ({ field: `files.${indicesRechazados[i]}`, message: `${r.fileName}: ${r.message}` })),
      );
    }
    return guardados;
  }

  const nuevasFotos = (
    guardados: MedioGuardado[],
    datos: { meta: { altText: string }[]; visibility: UpdateCreateData['visibility'] },
    ids: { animalId: number; updateId: number; uploadedBy: number },
  ): photoModel.NewPhoto[] =>
    guardados.map((g) => ({
      ...ids,
      mediaType: g.mediaType,
      url: g.url,
      thumbnailUrl: g.thumbnailUrl,
      altText: datos.meta[g.indice]!.altText,
      // Las fotos de una actualización tienen su visibilidad.
      visibility: datos.visibility,
    }));

  return {
    async list(query: AdminUpdatesQuery, usuario: Trabajador): Promise<Paginated<AdminUpdateListItemDto>> {
      const filtros = { animalId: query.animalId, visibility: query.visibility, authorId: query.authorId };
      const total = await updateModel.countAdmin(db, filtros);
      const pagina = paginar(query, total);
      const registros =
        total === 0 ? [] : await updateModel.listAdmin(db, filtros, { limit: pagina.pageSize, offset: pagina.offset });
      return {
        data: registros.map((r) => fila(r, usuario)),
        meta: { page: pagina.page, pageSize: pagina.pageSize, total: pagina.total, totalPages: pagina.totalPages },
      };
    },

    get: (id: number, usuario: Trabajador) => detalle(db, id, usuario),

    /**
     * CU-31 pasos 2-5: crea la actualización, sus fotos y las notificaciones de
     * los adoptantes activos en una transacción; después, los emails (4b: un
     * fallo de envío no deshace nada).
     */
    async create(
      datos: UpdateCreateData,
      archivos: ArchivoSubido[],
      usuario: Trabajador,
    ): Promise<AdminUpdateCreatedDto> {
      await comprobarAnimal(db, datos.animalId);
      const guardados = await guardarAdjuntos(datos.animalId, archivos, datos.meta);
      try {
        const { id, avisados, animalName } = await withTransaction(db, async (client) => {
          await comprobarAnimal(client, datos.animalId);
          const nuevo = await updateModel.insert(client, {
            animalId: datos.animalId,
            authorId: usuario.id,
            title: datos.title,
            body: datos.body,
            visibility: datos.visibility,
            publishedAt: reloj.ahora(),
          });
          await photoModel.insertMany(
            client,
            nuevasFotos(guardados, datos, { animalId: datos.animalId, updateId: nuevo, uploadedBy: usuario.id }),
          );
          // 4.1 (y 4a: sin adoptantes activos no hay a quién avisar).
          const adoptantes = await adoptionModel.listActiveAdopters(client, datos.animalId);
          const nombre = (await animalModel.findName(client, datos.animalId)) ?? '';
          await notificationModel.createForUsers(
            client,
            adoptantes.map((a) => a.userId),
            {
              type: 'new_update',
              message: `Nueva actualización de ${nombre}: «${datos.title}».`,
              link: `/my-animals/${datos.animalId}`,
            },
          );
          return { id: nuevo, avisados: adoptantes, animalName: nombre };
        });
        // 4.2: email solo a quien lo quiere por actualización (RN-19).
        const url = new URL(`/my-animals/${datos.animalId}`, clientUrl).toString();
        for (const adoptante of avisados.filter(recibeEmailPorActualizacion)) {
          try {
            await email.send({
              to: adoptante.email,
              ...newUpdateEmail({
                firstName: adoptante.firstName,
                animalName,
                title: datos.title,
                excerpt: extracto(datos.body, LARGO_EXTRACTO),
                url,
              }),
            });
          } catch (error) {
            logEmailError(error);
          }
        }
        return { ...(await detalle(db, id, usuario)), notifiedAdopters: avisados.length };
      } catch (error) {
        await media.borrar(urlsDe(guardados));
        throw error;
      }
    },

    /** CU-32 edición: texto, visibilidad y fotos, sin volver a notificar. */
    async update(
      id: number,
      datos: UpdateEditData,
      archivos: ArchivoSubido[],
      usuario: Trabajador,
    ): Promise<AdminUpdateDto> {
      const actual = await modificable(db, id, usuario);
      const guardados = await guardarAdjuntos(actual.animal.id, archivos, datos.meta);
      let quitadas: string[];
      try {
        quitadas = await withTransaction(db, async (client) => {
          await modificable(client, id, usuario, true);
          const fotos = await photoModel.listByUpdateAdmin(client, id);
          if (
            !fotosQuitadasValidas(
              fotos.map((f) => f.id),
              datos.removePhotoIds,
            )
          ) {
            throw new ValidationError([
              { field: 'removePhotoIds', message: 'Alguna de las fotos no es de esta actualización.' },
            ]);
          }
          await updateModel.updateContent(client, id, datos);
          const urls = await photoModel.removeMany(client, datos.removePhotoIds);
          await photoModel.setVisibilityForUpdate(client, id, datos.visibility);
          await photoModel.insertMany(
            client,
            nuevasFotos(guardados, datos, { animalId: actual.animal.id, updateId: id, uploadedBy: usuario.id }),
          );
          return urls;
        });
      } catch (error) {
        await media.borrar(urlsDe(guardados));
        throw error;
      }
      await media.borrar(quitadas);
      return detalle(db, id, usuario);
    },

    /** CU-32 borrado: la actualización, sus fotos (y archivos) y sus marcas de lectura. */
    async remove(id: number, usuario: Trabajador): Promise<void> {
      const urls = await withTransaction(db, async (client) => {
        await modificable(client, id, usuario, true);
        const fotos = await photoModel.listByUpdateAdmin(client, id);
        await updateModel.remove(client, id);
        return fotos.flatMap((f) => (f.thumbnailUrl ? [f.url, f.thumbnailUrl] : [f.url]));
      });
      await media.borrar(urls);
    },
  };
}
