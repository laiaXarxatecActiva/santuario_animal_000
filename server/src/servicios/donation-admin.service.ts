import type {
  AdminDonationListItemDto,
  AdminDonationMonthlyQuery,
  AdminDonationMonthlyTotalsDto,
  AdminDonationsExportQuery,
  AdminDonationsPage,
  AdminDonationsQuery,
  ManualDonationInput,
  PaymentMethod,
  PaymentStatus,
  SessionUser,
} from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import { comprobarFechaDonacion, rangoMeses } from '../dominio/donaciones-admin.js';
import { paginar } from '../dominio/paginacion.js';
import { pasaPorPasarela, puedeDevolverse } from '../dominio/pagos-admin.js';
import type { Reloj } from '../dominio/reloj.js';
import { DonationNotRefundableError, NotFoundError, RefundFailedError, ValidationError } from '../errors/app-error.js';
import * as donationModel from '../models/donation.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as userModel from '../models/user.model.js';
import type { EmailService } from '../services/email/email.service.js';
import { donationRefundedEmail } from '../services/email/templates/donation-refunded.js';
import { donationThanksEmail } from '../services/email/templates/donation-thanks.js';
import type { PaymentGateway } from '../services/payment/payment.service.js';
import { generarCsv, importeCsv } from '../utils/csv.js';
import { formatFecha } from '../utils/format.js';
import { referenciaManual } from '../utils/referencias.js';
import { avisos } from './textos-avisos.js';

export interface DonationAdminServiceDeps {
  db: Pool;
  reloj: Reloj;
  payments: PaymentGateway;
  email: EmailService;
  /** Registra los fallos de envío de email (nunca deshacen la operación). */
  logEmailError?: (error: unknown) => void;
}

export type DonationAdminService = ReturnType<typeof createDonationAdminService>;

const METODO: Record<PaymentMethod, string> = {
  simulated: 'Pago simulado',
  cash: 'Efectivo',
  bank_transfer: 'Transferencia',
  card: 'Tarjeta',
};
const ESTADO: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  completed: 'Cobrada',
  failed: 'Fallida',
  refunded: 'Devuelta',
};
const CABECERAS = [
  'Fecha',
  'Referencia',
  'Donante',
  'Email',
  'Anónima',
  'Importe',
  'Forma de pago',
  'Estado',
  'Mensaje',
  'Devuelto el',
  'Registrado por',
] as const;
const MENSAJE_FECHA = {
  INVALID_DATE: 'Esta fecha no existe.',
  DATE_IN_FUTURE: 'La fecha no puede ser posterior a hoy.',
} as const;

const filtrosDe = (query: AdminDonationsExportQuery) => ({
  q: query.q,
  status: query.status,
  method: query.method,
  from: query.from,
  to: query.to,
});

// CU-39 Gestionar donaciones (solo administradores).
export function createDonationAdminService({
  db,
  reloj,
  payments,
  email,
  logEmailError = () => {},
}: DonationAdminServiceDeps) {
  /** Un fallo de envío nunca deshace la operación. */
  async function enviar(mensaje: { to: string; subject: string; text: string; html: string }): Promise<void> {
    try {
      await email.send(mensaje);
    } catch (error) {
      logEmailError(error);
    }
  }

  async function buscar(id: number): Promise<donationModel.AdminDonation> {
    const donacion = await donationModel.findForAdmin(db, id);
    if (!donacion) throw new NotFoundError('Esta donación no existe.');
    return donacion;
  }

  return {
    /** Paso 2: filtros, páginas y suma de lo cobrado. */
    async list(query: AdminDonationsQuery): Promise<AdminDonationsPage> {
      const filtros = filtrosDe(query);
      const { total, collected } = await donationModel.summaryForAdmin(db, filtros);
      const pagina = paginar(query, total);
      const donaciones =
        total === 0
          ? []
          : await donationModel.listForAdmin(db, filtros, {
              sort: query.sort,
              limit: pagina.pageSize,
              offset: pagina.offset,
            });
      return {
        data: donaciones.map(donationModel.toAdminListItem),
        meta: { page: pagina.page, pageSize: pagina.pageSize, total: pagina.total, totalPages: pagina.totalPages },
        totalCollected: collected,
      };
    },

    /** Paso 3: lo cobrado cada mes, también los meses sin donaciones. */
    async monthlyTotals(query: AdminDonationMonthlyQuery): Promise<AdminDonationMonthlyTotalsDto> {
      const rango = rangoMeses({ from: query.from, to: query.to }, reloj.hoy());
      const filtros = { q: query.q, method: query.method, from: query.from, to: query.to };
      return { data: await donationModel.monthlyTotalsForAdmin(db, filtros, rango) };
    },

    /** Paso 4: todas las donaciones filtradas, en CSV. */
    async exportCsv(query: AdminDonationsExportQuery): Promise<{ filename: string; csv: string }> {
      const donaciones = await donationModel.listForAdmin(db, filtrosDe(query), { sort: query.sort });
      const filas = donaciones.map((d) => [
        formatFecha(d.day),
        d.reference,
        d.donorName,
        d.donorEmail,
        d.isAnonymous ? 'Sí' : 'No',
        importeCsv(d.amount),
        METODO[d.method],
        ESTADO[d.status],
        d.message,
        d.refundDay ? formatFecha(d.refundDay) : '',
        d.recordedBy?.name ?? '',
      ]);
      return { filename: `donaciones-${reloj.hoy()}.csv`, csv: generarCsv(CABECERAS, filas) };
    },

    /** A1: donación recibida fuera de la web, ya cobrada. */
    async registerManual(actor: SessionUser, datos: ManualDonationInput): Promise<AdminDonationListItemDto> {
      const hoy = reloj.hoy();
      const problema = comprobarFechaDonacion(datos.date, hoy);
      if (problema) throw new ValidationError([{ field: 'date', message: MENSAJE_FECHA[problema] }]);

      const reference = referenciaManual(datos.method, datos.date);
      const id = await donationModel.createManual(db, {
        donorName: datos.donorName ?? null,
        donorEmail: datos.donorEmail ?? null,
        amount: datos.amount,
        isAnonymous: datos.isAnonymous,
        message: datos.message ?? null,
        method: datos.method,
        reference,
        day: datos.date,
        ahora: reloj.ahora(),
        hoy,
        recordedBy: actor.id,
      });
      const donacion = await buscar(id);
      // Como en CU-05: el agradecimiento con el recibo, si hay email (RN-19).
      if (donacion.donorEmail) {
        await enviar({
          to: donacion.donorEmail,
          ...donationThanksEmail({
            donorName: donacion.donorName,
            amount: donacion.amount,
            paidAt: new Date(donacion.date),
            reference,
            simulated: false,
            language: donacion.userId === null ? undefined : await userModel.findLanguage(db, donacion.userId),
          }),
        });
      }
      return donationModel.toAdminListItem(donacion);
    },

    /**
     * A2: devolución. Las de la web pasan por la pasarela; las de efectivo o
     * transferencia se devuelven a mano y solo se marcan. Se avisa al donante
     * en la campana (si tiene cuenta) y por email (si lo dio).
     */
    async refund(id: number): Promise<AdminDonationListItemDto> {
      const donacion = await withTransaction(db, async (client) => {
        const actual = await donationModel.findForRefund(client, id);
        if (!actual) throw new NotFoundError('Esta donación no existe.');
        if (!puedeDevolverse(actual.status)) throw new DonationNotRefundableError();
        if (pasaPorPasarela(actual.method) && !(await payments.refund(actual.reference)).success) {
          throw new RefundFailedError();
        }
        await donationModel.markRefunded(client, id, reloj.ahora());
        const devuelta = (await donationModel.findForAdmin(client, id)) as donationModel.AdminDonation;
        if (devuelta.userId !== null && !devuelta.accountDeleted) {
          await notificationModel.create(client, {
            userId: devuelta.userId,
            type: 'system',
            message: avisos.donacionDevuelta(devuelta.amount),
            link: '/my-contributions',
          });
        }
        return devuelta;
      });
      if (donacion.donorEmail) {
        await enviar({
          to: donacion.donorEmail,
          ...donationRefundedEmail({
            donorName: donacion.donorName,
            amount: donacion.amount,
            reference: donacion.reference,
            online: pasaPorPasarela(donacion.method),
            language: donacion.userId === null ? undefined : await userModel.findLanguage(db, donacion.userId),
          }),
        });
      }
      return donationModel.toAdminListItem(donacion);
    },
  };
}
