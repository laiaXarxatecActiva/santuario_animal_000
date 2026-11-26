import {
  isWorkerRole,
  type AdminAdoptionCreateInput,
  type AdminAdoptionDetailDto,
  type AdminAdoptionListItemDto,
  type AdminAdoptionsQuery,
  type AdminAdoptionStatusInput,
  type AdoptionAdminAction,
  type Language,
  type NotificationType,
  type Paginated,
  type SessionUser,
} from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { esAdoptable, periodoCuota } from '../dominio/adopcion.js';
import { anotar, cierreAdmin, comprobarAccion } from '../dominio/adopciones-admin.js';
import { cuotaPendiente } from '../dominio/pagos-admin.js';
import { paginar } from '../dominio/paginacion.js';
import type { Reloj } from '../dominio/reloj.js';
import {
  AdopterNotAvailableError,
  AdoptionActionNotAllowedError,
  AdoptionAlreadyOpenError,
  AnimalNotAdoptableError,
  AnimalNotAvailableError,
  NotFoundError,
  PaymentNotRefundableError,
  PlanNotAvailableError,
  WorkerCannotAdoptError,
} from '../errors/app-error.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as planModel from '../models/adoption-plan.model.js';
import * as animalModel from '../models/animal.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as paymentModel from '../models/payment.model.js';
import * as userModel from '../models/user.model.js';
import type { EmailService } from '../services/email/email.service.js';
import { adoptionAdminChangeEmail } from '../services/email/templates/adoption-admin-change.js';
import { adoptionWelcomeEmail } from '../services/email/templates/adoption-welcome.js';
import type { PaymentGateway } from '../services/payment/payment.service.js';
import { referenciaManual } from '../utils/referencias.js';
import { devolverPago, emailDevolucion, notificarDevolucion } from './devolucion.js';
import { avisos, type Textos } from './textos-avisos.js';

export interface AdoptionAdminServiceDeps {
  db: Pool;
  reloj: Reloj;
  /** Pasarela, para devolver la última cuota al cancelar (CU-38). */
  payments: PaymentGateway;
  email: EmailService;
  /** URL del cliente, para los enlaces de los emails. */
  clientUrl: string;
  /** Registra los fallos de envío de email (nunca deshacen la operación). */
  logEmailError?: (error: unknown) => void;
}

export type AdoptionAdminService = ReturnType<typeof createAdoptionAdminService>;

const NO_EXISTE = 'Esta adopción no existe.';

// Cómo aparece cada acción en las notas internas.
const ETIQUETA: Record<AdoptionAdminAction, string> = {
  pause: 'Pausa',
  resume: 'Reanudación',
  cancel: 'Cancelación',
};

// Aviso en la campana. La nota interna del administrador nunca se enseña al adoptante.
const AVISO: Record<AdoptionAdminAction, { type: NotificationType; mensaje: (animal: string) => Textos }> = {
  pause: { type: 'system', mensaje: avisos.pausadaPorAdmin },
  resume: { type: 'system', mensaje: avisos.reanudadaPorAdmin },
  cancel: { type: 'adoption_cancelled', mensaje: avisos.canceladaPorAdmin },
};

const nombreDe = (persona: { firstName: string; lastName: string }) => `${persona.firstName} ${persona.lastName}`;

// CU-37 Gestionar adopciones (solo administradores).
export function createAdoptionAdminService({
  db,
  reloj,
  payments,
  email,
  clientUrl,
  logEmailError = () => {},
}: AdoptionAdminServiceDeps) {
  const urlMisAnimales = () => new URL('/my-animals', clientUrl).toString();

  async function detalle(q: Queryable, id: number): Promise<AdminAdoptionDetailDto> {
    const adopcion = await adoptionModel.findForAdmin(q, id);
    if (!adopcion) throw new NotFoundError(NO_EXISTE);
    const cuota = cuotaPendiente({ ...adopcion, createdAt: new Date(adopcion.createdAt) }, reloj.ahora(), reloj.hoy());
    return {
      ...adopcion,
      payments: await paymentModel.listByAdoptionForAdmin(q, id),
      pendingFee: cuota && {
        periodStart: cuota.periodStart,
        periodEnd: cuota.periodEnd,
        amount: cuota.plan.monthlyAmount,
      },
      lastRefundablePayment: await paymentModel.findLastCompletedForAdoption(q, id),
    };
  }

  /** Envía un email al adoptante; un fallo nunca deshace la operación. */
  async function enviar(
    userId: number,
    plantilla: (firstName: string, language: Language | undefined) => ReturnType<typeof adoptionWelcomeEmail>,
  ) {
    try {
      const user = await userModel.findById(db, userId);
      if (user) await email.send({ to: user.email, ...plantilla(user.firstName, user.preferredLanguage) });
    } catch (error) {
      logEmailError(error);
    }
  }

  /** 2a: la cuenta debe ser de un adoptante activo (RN-03). */
  async function adoptanteDisponible(userId: number): Promise<void> {
    const user = await userModel.findForAdmin(db, userId);
    if (user && isWorkerRole(user.role)) throw new WorkerCannotAdoptError();
    if (!user || !user.isActive || user.anonymizedAt !== null) throw new AdopterNotAvailableError();
  }

  return {
    /** Paso 2: búsqueda, filtros y páginas. */
    async list(query: AdminAdoptionsQuery): Promise<Paginated<AdminAdoptionListItemDto>> {
      const filtros = {
        q: query.q,
        status: query.status,
        planId: query.planId,
        animalId: query.animalId,
        userId: query.userId,
      };
      const total = await adoptionModel.countForAdmin(db, filtros);
      const pagina = paginar(query, total);
      const adopciones =
        total === 0
          ? []
          : await adoptionModel.listForAdmin(db, filtros, {
              sort: query.sort,
              limit: pagina.pageSize,
              offset: pagina.offset,
            });
      return {
        data: adopciones.map(adoptionModel.toAdminListItem),
        meta: { page: pagina.page, pageSize: pagina.pageSize, total: pagina.total, totalPages: pagina.totalPages },
      };
    },

    /** Paso 3: datos, pagos y notas internas. */
    get: (id: number) => detalle(db, id),

    /**
     * Alta manual, pasos 2-4: la adopción nace activa con su primer pago cobrado
     * (transferencia) y se avisa al adoptante como en CU-13.
     */
    async create(actor: SessionUser, datos: AdminAdoptionCreateInput): Promise<AdminAdoptionDetailDto> {
      await adoptanteDisponible(datos.userId);
      const animal = await animalModel.findPublicById(db, datos.animalId);
      if (!animal) throw new AnimalNotAvailableError();
      if (!esAdoptable(animal)) throw new AnimalNotAdoptableError();
      const plan = await planModel.findActiveById(db, datos.planId);
      if (!plan) throw new PlanNotAvailableError();
      if (await adoptionModel.findOpenByUserAndAnimal(db, datos.userId, datos.animalId)) {
        throw new AdoptionAlreadyOpenError(animal.name);
      }

      const hoy = reloj.hoy();
      const periodo = periodoCuota(hoy);
      const reference = referenciaManual(datos.method, hoy);
      const notes = datos.notes
        ? anotar(null, { fecha: hoy, accion: 'Alta manual', autor: nombreDe(actor), texto: datos.notes })
        : null;

      const id = await withTransaction(db, async (client) => {
        const nuevaId = await adoptionModel.createManual(client, {
          userId: datos.userId,
          animalId: animal.id,
          planId: plan.id,
          startDate: hoy,
          nextBillingDate: periodo.nextBillingDate,
          createdBy: actor.id,
          notes,
        });
        await paymentModel.createManual(client, {
          adoptionId: nuevaId,
          planId: plan.id,
          amount: plan.monthlyAmount,
          periodStart: periodo.periodStart,
          periodEnd: periodo.periodEnd,
          method: datos.method,
          reference,
          paidAt: reloj.ahora(),
          recordedBy: actor.id,
        });
        await notificationModel.create(client, {
          userId: datos.userId,
          type: 'adoption_welcome',
          message: avisos.adopcionActiva(animal.name),
          link: `/my-animals/${animal.id}`,
        });
        return nuevaId;
      });

      // Los emails de pagos se envían siempre, sin mirar las preferencias (RN-19).
      await enviar(datos.userId, (firstName, language) =>
        adoptionWelcomeEmail({
          firstName,
          language,
          animalName: animal.name,
          planName: plan.name,
          amount: plan.monthlyAmount,
          periodStart: periodo.periodStart,
          periodEnd: periodo.periodEnd,
          reference,
          url: urlMisAnimales(),
        }),
      );
      return detalle(db, id);
    },

    /** A1 pausar, A2 reanudar y A3 cancelar. El motivo se añade a las notas internas. */
    async changeStatus(
      actor: SessionUser,
      id: number,
      cambio: AdminAdoptionStatusInput,
    ): Promise<AdminAdoptionDetailDto> {
      const hoy = reloj.hoy();
      const { adopcion, devuelto } = await withTransaction(db, async (client) => {
        const actual = await adoptionModel.findForAdmin(client, id, true);
        if (!actual) throw new NotFoundError(NO_EXISTE);
        if (comprobarAccion(actual, cambio.action)) throw new AdoptionActionNotAllowedError();

        if (cambio.action === 'pause') await adoptionModel.pause(client, id);
        else if (cambio.action === 'resume') await adoptionModel.resume(client, id);
        else await adoptionModel.closeByAdmin(client, id, cierreAdmin(actual, hoy));

        if (cambio.notes) {
          const entrada = { fecha: hoy, accion: ETIQUETA[cambio.action], autor: nombreDe(actor), texto: cambio.notes };
          await adoptionModel.setNotes(client, id, anotar(actual.notes, entrada));
        }
        const aviso = AVISO[cambio.action];
        await notificationModel.create(client, {
          userId: actual.adopter.id,
          type: aviso.type,
          message: aviso.mensaje(actual.animal.name),
          link: `/my-animals/${actual.animal.id}`,
        });
        // CU-38: al cancelar, la última cuota cobrada se puede devolver en la misma operación.
        let devuelto: paymentModel.AdminPayment | null = null;
        if (cambio.action === 'cancel' && cambio.refundLastPayment) {
          const ultimo = await paymentModel.findLastCompletedForAdoption(client, id);
          if (!ultimo) throw new PaymentNotRefundableError();
          await devolverPago(client, payments, ultimo.id, reloj.ahora());
          devuelto = await paymentModel.findForAdmin(client, ultimo.id);
          if (devuelto) await notificarDevolucion(client, devuelto);
        }
        return { adopcion: actual, devuelto };
      });

      await enviar(adopcion.adopter.id, (firstName, language) =>
        adoptionAdminChangeEmail({
          firstName,
          language,
          animalName: adopcion.animal.name,
          action: cambio.action,
          date: cambio.action === 'resume' ? adopcion.nextBillingDate : null,
          url: urlMisAnimales(),
        }),
      );
      const avisoDevolucion =
        devuelto && emailDevolucion(devuelto, clientUrl, await userModel.findLanguage(db, devuelto.adopter.id));
      if (avisoDevolucion) {
        try {
          await email.send(avisoDevolucion);
        } catch (error) {
          logEmailError(error);
        }
      }
      return detalle(db, id);
    },
  };
}
