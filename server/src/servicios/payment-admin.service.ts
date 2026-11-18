import type {
  AdminPaymentListItemDto,
  AdminPaymentsExportQuery,
  AdminPaymentsPage,
  AdminPaymentsQuery,
  ManualPaymentInput,
  PaymentMethod,
  PaymentStatus,
  SessionUser,
} from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import { esAdoptable } from '../dominio/adopcion.js';
import { paginar } from '../dominio/paginacion.js';
import { cuotaPendiente } from '../dominio/pagos-admin.js';
import type { Reloj } from '../dominio/reloj.js';
import {
  AdoptionPaymentExpiredError,
  AnimalNotAdoptableError,
  AnimalNotAvailableError,
  ManualPaymentNotAllowedError,
  NotFoundError,
  PeriodAlreadyPaidError,
} from '../errors/app-error.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as animalModel from '../models/animal.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as paymentModel from '../models/payment.model.js';
import * as userModel from '../models/user.model.js';
import type { EmailService } from '../services/email/email.service.js';
import { adoptionWelcomeEmail } from '../services/email/templates/adoption-welcome.js';
import { paymentCompletedEmail } from '../services/email/templates/payment-completed.js';
import type { PaymentGateway } from '../services/payment/payment.service.js';
import { generarCsv, importeCsv } from '../utils/csv.js';
import { formatFecha } from '../utils/format.js';
import { referenciaManual } from '../utils/referencias.js';
import { devolverPago, emailDevolucion, notificarDevolucion } from './devolucion.js';
import { avisos } from './textos-avisos.js';

export interface PaymentAdminServiceDeps {
  db: Pool;
  reloj: Reloj;
  payments: PaymentGateway;
  email: EmailService;
  /** URL del cliente, para los enlaces de los emails. */
  clientUrl: string;
  /** Registra los fallos de envío de email (nunca deshacen la operación). */
  logEmailError?: (error: unknown) => void;
}

export type PaymentAdminService = ReturnType<typeof createPaymentAdminService>;

const METODO: Record<PaymentMethod, string> = {
  simulated: 'Pago simulado',
  cash: 'Efectivo',
  bank_transfer: 'Transferencia',
  card: 'Tarjeta',
};
const ESTADO: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  completed: 'Cobrado',
  failed: 'Fallido',
  refunded: 'Devuelto',
};
const CABECERAS = [
  'Fecha',
  'Referencia',
  'Adoptante',
  'Email',
  'Animal',
  'Plan',
  'Periodo desde',
  'Periodo hasta',
  'Importe',
  'Forma de pago',
  'Estado',
  'Devuelto el',
  'Registrado por',
] as const;

const filtrosDe = (query: AdminPaymentsExportQuery) => ({
  q: query.q,
  status: query.status,
  method: query.method,
  from: query.from,
  to: query.to,
  adoptionId: query.adoptionId,
});

// CU-38 Gestionar pagos (solo administradores).
export function createPaymentAdminService({
  db,
  reloj,
  payments,
  email,
  clientUrl,
  logEmailError = () => {},
}: PaymentAdminServiceDeps) {
  /** Un fallo de envío nunca deshace la operación. */
  async function enviar(mensaje: { to: string; subject: string; text: string; html: string } | null): Promise<void> {
    if (!mensaje) return;
    try {
      await email.send(mensaje);
    } catch (error) {
      logEmailError(error);
    }
  }

  async function buscar(id: number): Promise<paymentModel.AdminPayment> {
    const pago = await paymentModel.findForAdmin(db, id);
    if (!pago) throw new NotFoundError('Este pago no existe.');
    return pago;
  }

  return {
    /** Paso 2: filtros, páginas y suma de lo cobrado. */
    async list(query: AdminPaymentsQuery): Promise<AdminPaymentsPage> {
      const filtros = filtrosDe(query);
      const { total, collected } = await paymentModel.summaryForAdmin(db, filtros);
      const pagina = paginar(query, total);
      const pagos =
        total === 0
          ? []
          : await paymentModel.listForAdmin(db, filtros, {
              sort: query.sort,
              limit: pagina.pageSize,
              offset: pagina.offset,
            });
      return {
        data: pagos.map(paymentModel.toAdminListItem),
        meta: { page: pagina.page, pageSize: pagina.pageSize, total: pagina.total, totalPages: pagina.totalPages },
        totalCollected: collected,
      };
    },

    /** Paso 3: todos los pagos filtrados, en CSV. */
    async exportCsv(query: AdminPaymentsExportQuery): Promise<{ filename: string; csv: string }> {
      const pagos = await paymentModel.listForAdmin(db, filtrosDe(query), { sort: query.sort });
      const filas = pagos.map((p) => [
        formatFecha(p.day),
        p.reference,
        `${p.adopter.firstName} ${p.adopter.lastName}`,
        p.adopter.email,
        p.animal.name,
        p.plan.name,
        formatFecha(p.periodStart),
        formatFecha(p.periodEnd),
        importeCsv(p.amount),
        METODO[p.method],
        ESTADO[p.status],
        p.refundDay ? formatFecha(p.refundDay) : '',
        p.recordedBy?.name ?? '',
      ]);
      return { filename: `pagos-${reloj.hoy()}.csv`, csv: generarCsv(CABECERAS, filas) };
    },

    /** A1: devolución. La adopción no cambia; si debe cerrarse, se usa CU-37. */
    async refund(id: number): Promise<AdminPaymentListItemDto> {
      const pago = await withTransaction(db, async (client) => {
        await devolverPago(client, payments, id, reloj.ahora());
        const devuelto = (await paymentModel.findForAdmin(client, id)) as paymentModel.AdminPayment;
        await notificarDevolucion(client, devuelto);
        return devuelto;
      });
      await enviar(emailDevolucion(pago, clientUrl, await userModel.findLanguage(db, pago.adopter.id)));
      return paymentModel.toAdminListItem(pago);
    },

    /**
     * A2: registra la cuota pendiente cobrada fuera de la web. La adopción queda
     * activa y el próximo cobro avanza un mes (una pendiente empieza hoy).
     */
    async registerManual(actor: SessionUser, datos: ManualPaymentInput): Promise<AdminPaymentListItemDto> {
      const hoy = reloj.hoy();
      const ahora = reloj.ahora();
      const reference = referenciaManual(datos.method, hoy);
      const { pagoId, primerPago, cuota } = await withTransaction(db, async (client) => {
        const adopcion = await adoptionModel.findForAdmin(client, datos.adoptionId, true);
        if (!adopcion) throw new NotFoundError('Esta adopción no existe.');
        const cuota = cuotaPendiente({ ...adopcion, createdAt: new Date(adopcion.createdAt) }, ahora, hoy);
        if (!cuota) {
          if (adopcion.status === 'pending') throw new AdoptionPaymentExpiredError();
          throw new ManualPaymentNotAllowedError();
        }
        const primerPago = adopcion.status === 'pending';
        if (primerPago) {
          // RN-06, como en CU-14: el animal debe seguir admitiendo adopciones.
          const animal = await animalModel.findPublicById(client, adopcion.animal.id);
          if (!animal) throw new AnimalNotAvailableError();
          if (!esAdoptable(animal)) throw new AnimalNotAdoptableError();
        }
        if (await paymentModel.existsValidForPeriod(client, adopcion.id, cuota.periodStart)) {
          throw new PeriodAlreadyPaidError();
        }
        // El cambio de plan programado (CU-20) se aplica en esta cuota, como en CU-43.
        if (adopcion.nextPlan) await adoptionModel.applyNextPlan(client, adopcion.id);
        const pagoId = await paymentModel.createManual(client, {
          adoptionId: adopcion.id,
          planId: cuota.plan.id,
          amount: datos.amount,
          periodStart: cuota.periodStart,
          periodEnd: cuota.periodEnd,
          method: datos.method,
          reference,
          paidAt: ahora,
          recordedBy: actor.id,
        });
        await adoptionModel.activate(client, adopcion.id, { startDate: hoy, nextBillingDate: cuota.nextBillingDate });
        await notificationModel.create(client, {
          userId: adopcion.adopter.id,
          type: primerPago ? 'adoption_welcome' : 'payment_completed',
          message: primerPago
            ? avisos.adopcionActiva(adopcion.animal.name)
            : avisos.cuotaRegistrada(adopcion.animal.name),
          link: `/my-animals/${adopcion.animal.id}`,
        });
        return { pagoId, primerPago, cuota };
      });

      const pago = await buscar(pagoId);
      // Los emails de pagos se envían siempre (RN-19), con el recibo.
      if (pago.adopter.email !== '') {
        const recibo = {
          firstName: pago.adopter.firstName,
          animalName: pago.animal.name,
          planName: cuota.plan.name,
          amount: pago.amount,
          periodStart: pago.periodStart,
          periodEnd: pago.periodEnd,
          reference,
          url: new URL('/my-animals', clientUrl).toString(),
          language: await userModel.findLanguage(db, pago.adopter.id),
        };
        await enviar({
          to: pago.adopter.email,
          ...(primerPago ? adoptionWelcomeEmail(recibo) : paymentCompletedEmail(recibo)),
        });
      }
      return paymentModel.toAdminListItem(pago);
    },
  };
}
