import type { AdminAnimalDto, AdminAnimalsQuery, AnimalData, AnimalStatusData, Paginated } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import {
  motivoDeCierre,
  puedeCambiarDeEstado,
  puedeEstarEnMemoria,
  puedeSerAdoptable,
  requiereMensajeDeDespedida,
  sePuedeBorrar,
  estaArchivado,
} from '../dominio/animal.js';
import { paginar } from '../dominio/paginacion.js';
import type { Reloj } from '../dominio/reloj.js';
import {
  AnimalArchivedError,
  AnimalHasAdoptionsError,
  ArchivedAnimalNotAdoptableError,
  FieldRuleError,
  MemorialOnlyDeceasedError,
  NotFoundError,
} from '../errors/app-error.js';
import * as animalModel from '../models/animal-admin.model.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as updateModel from '../models/animal-update.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as speciesModel from '../models/species.model.js';
import * as userModel from '../models/user.model.js';
import type { EmailService } from '../services/email/email.service.js';
import { adoptionClosedEmail } from '../services/email/templates/adoption-closed.js';

export interface AnimalAdminServiceDeps {
  db: Pool;
  reloj: Reloj;
  email: EmailService;
  clientUrl: string;
  logEmailError?: (error: unknown) => void;
}

export type AnimalAdminService = ReturnType<typeof createAnimalAdminService>;

const noExiste = () => new NotFoundError('Este animal no existe.');

// CU-28 Gestionar animales y CU-33 Registrar el fallecimiento o traslado.
export function createAnimalAdminService({
  db,
  reloj,
  email,
  clientUrl,
  logEmailError = () => {},
}: AnimalAdminServiceDeps) {
  async function buscar(q: Queryable, id: number, forUpdate = false): Promise<AdminAnimalDto> {
    const animal = await animalModel.findById(q, id, { forUpdate });
    if (!animal) throw noExiste();
    return animal;
  }

  /** Comprobaciones que no puede hacer el esquema: la especie existe y la llegada no es futura. */
  async function validar(q: Queryable, datos: AnimalData): Promise<void> {
    if (datos.arrivalDate > reloj.hoy()) {
      throw new FieldRuleError('ARRIVAL_IN_FUTURE', 'arrivalDate', 'La fecha de llegada no puede ser futura.');
    }
    if (!(await speciesModel.exists(q, datos.speciesId))) {
      throw new FieldRuleError('SPECIES_NOT_FOUND', 'speciesId', 'Esta especie no existe.');
    }
  }

  return {
    async list(query: AdminAnimalsQuery): Promise<Paginated<AdminAnimalDto>> {
      const filtros = {
        q: query.q,
        speciesId: query.speciesId,
        status: query.status,
        published: query.published,
        adoptable: query.adoptable,
      };
      const total = await animalModel.count(db, filtros);
      const pagina = paginar(query, total);
      const data =
        total === 0
          ? []
          : await animalModel.list(db, filtros, { sort: query.sort, limit: pagina.pageSize, offset: pagina.offset });
      return {
        data,
        meta: { page: pagina.page, pageSize: pagina.pageSize, total: pagina.total, totalPages: pagina.totalPages },
      };
    },

    get: (id: number) => buscar(db, id),

    /** Alta (pasos 1-3): empieza en el santuario. */
    async create(datos: AnimalData): Promise<AdminAnimalDto> {
      await validar(db, datos);
      return buscar(db, await animalModel.create(db, datos));
    },

    /** Edición (pasos 2-3), A1 publicar u ocultar y 2b. */
    async update(id: number, datos: AnimalData): Promise<AdminAnimalDto> {
      return withTransaction(db, async (client) => {
        const actual = await buscar(client, id, true);
        await validar(client, datos);
        if (!puedeSerAdoptable(actual.status, datos.isAdoptable)) throw new ArchivedAnimalNotAdoptableError();
        if (datos.showInMemorial !== undefined && !puedeEstarEnMemoria(actual.status, datos.showInMemorial)) {
          throw new MemorialOnlyDeceasedError();
        }
        await animalModel.update(client, id, datos);
        if (datos.showInMemorial !== undefined) await animalModel.setShowInMemorial(client, id, datos.showInMemorial);
        return buscar(client, id);
      });
    },

    /**
     * CU-28 A2 (directo) y CU-33: fallecido o trasladado archiva el animal y
     * cierra sus adopciones abiertas (5.1-5.2); en un fallecimiento publica el
     * mensaje para los adoptantes (5.3). Después avisa a cada afectado (6).
     */
    async changeStatus(id: number, cambio: AnimalStatusData, autorId: number): Promise<AdminAnimalDto> {
      const hoy = reloj.hoy();
      const fecha = cambio.date ?? hoy;
      if (fecha > hoy) throw new FieldRuleError('DATE_IN_FUTURE', 'date', 'La fecha no puede ser futura.');
      if (!puedeEstarEnMemoria(cambio.status, cambio.showInMemorial ?? false)) throw new MemorialOnlyDeceasedError();
      const { animal, afectados, motivo } = await withTransaction(db, async (client) => {
        const actual = await buscar(client, id, true);
        if (!puedeCambiarDeEstado(actual.status)) throw new AnimalArchivedError();
        // 3a: sin mensaje no se continúa.
        if (requiereMensajeDeDespedida(cambio.status, actual.openAdoptions) && !cambio.message) {
          throw new FieldRuleError('FAREWELL_MESSAGE_REQUIRED', 'message', 'Escribe el mensaje para los adoptantes.');
        }
        const archivar = estaArchivado(cambio.status);
        await animalModel.updateStatus(client, id, {
          status: cambio.status,
          statusChangedAt: archivar ? fecha : null,
          archivar,
        });
        if (cambio.showInMemorial) await animalModel.setShowInMemorial(client, id, true);
        const motivo = motivoDeCierre(cambio.status);
        // 2a: sin adopciones abiertas, ni mensaje ni avisos.
        const afectados =
          motivo && actual.openAdoptions > 0
            ? await adoptionModel.closeOpenForAnimal(client, id, { reason: motivo, date: fecha })
            : [];
        if (motivo && afectados.length > 0) {
          if (motivo === 'animal_deceased' && cambio.message) {
            await updateModel.insert(client, {
              animalId: id,
              authorId: autorId,
              title: `Despedimos a ${actual.name}`,
              body: cambio.message,
              visibility: 'adopters',
              publishedAt: reloj.ahora(),
            });
          }
          await notificationModel.createForUsers(client, afectados, {
            type: 'adoption_closed',
            message:
              motivo === 'animal_deceased'
                ? `Lamentamos comunicarte que ${actual.name} ha fallecido. Tu adopción se ha cerrado.`
                : `${actual.name} se ha trasladado a otro centro. Tu adopción se ha cerrado.`,
            link: '/animals',
          });
        }
        return { animal: await buscar(client, id), afectados, motivo };
      });

      // 6: los emails van fuera de la transacción; un fallo no deshace el cambio.
      if (motivo === 'animal_deceased' || motivo === 'animal_transferred') {
        const catalogUrl = new URL('/animals', clientUrl).toString();
        for (const userId of afectados) {
          try {
            const usuario = await userModel.findById(db, userId);
            if (!usuario) continue;
            await email.send({
              to: usuario.email,
              ...adoptionClosedEmail({
                firstName: usuario.firstName,
                animalName: animal.name,
                reason: motivo,
                message: cambio.message ?? null,
                catalogUrl,
              }),
            });
          } catch (error) {
            logEmailError(error);
          }
        }
      }
      return animal;
    },

    /** A4 (solo administrador): sin historial de adopciones (RN-17). */
    async remove(id: number): Promise<void> {
      await withTransaction(db, async (client) => {
        const actual = await buscar(client, id, true);
        if (!sePuedeBorrar(actual.hasAdoptionHistory)) throw new AnimalHasAdoptionsError();
        await animalModel.remove(client, id);
      });
    },
  };
}
