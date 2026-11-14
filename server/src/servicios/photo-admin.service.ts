import type { AdminPhotoDto, PhotoMeta, PhotoPatchBody, PhotoUploadResultDto } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { ordenValido, puedeCambiarVisibilidad, puedeSerPortada, type ArchivoSubido } from '../dominio/fotos.js';
import {
  CoverMustBePublicError,
  InvalidCoverError,
  InvalidPhotoOrderError,
  NoFilesError,
  NotFoundError,
  PhotoBelongsToUpdateError,
  ValidationError,
} from '../errors/app-error.js';
import * as animalModel from '../models/animal-admin.model.js';
import * as photoModel from '../models/photo.model.js';
import type { MediaUploader } from './media-upload.service.js';
import { urlsDe } from './media-upload.service.js';

export interface PhotoAdminServiceDeps {
  db: Pool;
  media: MediaUploader;
}

export type PhotoAdminService = ReturnType<typeof createPhotoAdminService>;

const animalNoExiste = () => new NotFoundError('Este animal no existe.');
const fotoNoExiste = () => new NotFoundError('Esta foto no existe.');

// CU-29 Gestionar fotos y vídeos de un animal (su galería). Las fotos de las
// actualizaciones se gestionan desde la actualización (CU-31, CU-32).
export function createPhotoAdminService({ db, media }: PhotoAdminServiceDeps) {
  async function comprobarAnimal(q: Queryable, id: number, forUpdate = false): Promise<void> {
    if (!(await animalModel.exists(q, id, { forUpdate }))) throw animalNoExiste();
  }

  async function fotoDeGaleria(q: Queryable, id: number, forUpdate = false): Promise<photoModel.AdminPhoto> {
    const foto = await photoModel.findAdminById(q, id, { forUpdate });
    if (!foto) throw fotoNoExiste();
    if (foto.updateId !== null) throw new PhotoBelongsToUpdateError();
    return foto;
  }

  return {
    /** Paso 1: la galería en su orden. */
    async list(animalId: number): Promise<AdminPhotoDto[]> {
      await comprobarAnimal(db, animalId);
      return (await photoModel.listGalleryAdmin(db, animalId)).map(photoModel.toAdminDto);
    },

    /** Pasos 2-4 y 2a: guarda los archivos válidos al final de la galería y rechaza los demás. */
    async upload(
      animalId: number,
      userId: number,
      archivos: ArchivoSubido[],
      metas: PhotoMeta[],
    ): Promise<PhotoUploadResultDto> {
      await comprobarAnimal(db, animalId);
      if (archivos.length === 0) throw new NoFilesError();
      if (metas.length !== archivos.length) {
        throw new ValidationError([{ field: 'meta', message: 'Indica el texto alternativo de cada archivo.' }]);
      }
      const { guardados, rechazados } = await media.guardar(animalId, archivos);
      if (guardados.length === 0) return { created: [], rejected: rechazados };

      let ids: number[];
      try {
        ids = await withTransaction(db, async (client) => {
          await comprobarAnimal(client, animalId, true);
          return photoModel.insertMany(
            client,
            guardados.map((g) => ({
              animalId,
              updateId: null,
              mediaType: g.mediaType,
              url: g.url,
              thumbnailUrl: g.thumbnailUrl,
              altText: metas[g.indice]!.altText,
              visibility: metas[g.indice]!.visibility,
              uploadedBy: userId,
            })),
          );
        });
      } catch (error) {
        await media.borrar(urlsDe(guardados));
        throw error;
      }
      const galeria = await photoModel.listGalleryAdmin(db, animalId);
      const created = ids.flatMap((id) => galeria.filter((f) => f.id === id)).map(photoModel.toAdminDto);
      return { created, rejected: rechazados };
    },

    /** A1: texto alternativo y visibilidad. La portada no puede pasar a «solo adoptantes». */
    async update(photoId: number, datos: PhotoPatchBody): Promise<AdminPhotoDto> {
      return withTransaction(db, async (client) => {
        const { animalId } = await fotoDeGaleria(client, photoId);
        // Se bloquea el animal para que la portada no cambie mientras tanto.
        await comprobarAnimal(client, animalId, true);
        const foto = await fotoDeGaleria(client, photoId, true);
        if (!puedeCambiarVisibilidad(foto.isCover, datos.visibility)) throw new CoverMustBePublicError();
        await photoModel.updateMeta(client, photoId, datos);
        return photoModel.toAdminDto((await photoModel.findAdminById(client, photoId))!);
      });
    },

    /** Pasos 5-6: el nuevo orden de toda la galería. */
    async reorder(animalId: number, photoIds: number[]): Promise<void> {
      await withTransaction(db, async (client) => {
        await comprobarAnimal(client, animalId, true);
        const galeria = await photoModel.listGalleryAdmin(client, animalId);
        if (
          !ordenValido(
            galeria.map((f) => f.id),
            photoIds,
          )
        ) {
          throw new InvalidPhotoOrderError();
        }
        await photoModel.setGalleryOrder(client, animalId, photoIds);
      });
    },

    /** Pasos 5-6 y 5a: la portada es una imagen pública de la galería. */
    async setCover(animalId: number, photoId: number): Promise<void> {
      await withTransaction(db, async (client) => {
        await comprobarAnimal(client, animalId, true);
        const foto = await photoModel.findAdminById(client, photoId);
        if (!foto) throw fotoNoExiste();
        if (!puedeSerPortada(foto, animalId)) throw new InvalidCoverError();
        await animalModel.setCover(client, animalId, photoId);
      });
    },

    /** A2: borra el registro y, después, los archivos. Si era la portada, el animal queda sin portada. */
    async remove(photoId: number): Promise<void> {
      const urls = await withTransaction(db, async (client) => {
        await fotoDeGaleria(client, photoId, true);
        return photoModel.removeMany(client, [photoId]);
      });
      await media.borrar(urls);
    },
  };
}
