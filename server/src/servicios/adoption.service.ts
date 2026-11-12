import {
  isWorkerRole,
  type AdoptionDto,
  type CreateAdoptionInput,
  type PayAdoptionResponse,
  type SessionUser,
  type SimulatedOutcome,
} from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import { esAdoptable, periodoCuota, proximaActualizacionPrevista, puedePagar } from '../dominio/adopcion.js';
import type { Reloj } from '../dominio/reloj.js';
import {
  AdoptionAlreadyOpenError,
  AdoptionClosedError,
  AdoptionNotPayableError,
  AdoptionPaymentExpiredError,
  AnimalNotAdoptableError,
  AnimalNotAvailableError,
  NotFoundError,
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
import { adoptionWelcomeEmail } from '../services/email/templates/adoption-welcome.js';
import { paymentCompletedEmail } from '../services/email/templates/payment-completed.js';
import type { PaymentGateway } from '../services/payment/payment.service.js';

export interface AdoptionServiceDeps {
  db: Pool;
  reloj: Reloj;
  payments: PaymentGateway;
  email: EmailService;
  clientUrl: string;
  logEmailError?: (error: unknown) => void;
}

// Casos de uso de la adopción: CU-13, CU-14 y CU-15.
export function createAdoptionService({
  db,
  reloj,
  payments,
  email,
  clientUrl,
  logEmailError = () => {},
}: AdoptionServiceDeps) {
  const toDto = (adopcion: adoptionModel.Adoption): AdoptionDto => ({
    id: adopcion.id,
    status: adopcion.status,
    animal: adopcion.animal,
    plan: adopcion.plan,
    nextPlan: adopcion.nextPlan,
    startDate: adopcion.startDate,
    endDate: adopcion.endDate,
    nextBillingDate: adopcion.nextBillingDate,
    cancelRequested: adopcion.cancelRequestedAt !== null,
    endReason: adopcion.endReason,
    nextUpdateExpected: proximaActualizacionPrevista(adopcion, adopcion.lastUpdateDate),
    createdAt: adopcion.createdAt.toISOString(),
    canPay: puedePagar(adopcion, reloj.ahora()),
  });

  async function animalAdoptable(animalId: number): Promise<animalModel.PublicAnimal> {
    const animal = await animalModel.findPublicById(db, animalId);
    if (!animal) throw new AnimalNotAvailableError();
    if (!esAdoptable(animal)) throw new AnimalNotAdoptableError();
    return animal;
  }

  /** CU-13 pasos 2-5: comprueba las reglas y crea la adopción pendiente. */
  async function create(user: SessionUser, { animalId, planId }: CreateAdoptionInput): Promise<AdoptionDto> {
    if (isWorkerRole(user.role)) throw new WorkerCannotAdoptError();
    const animal = await animalAdoptable(animalId);
    if (!(await planModel.findActiveById(db, planId))) throw new PlanNotAvailableError();
    if (await adoptionModel.findOpenByUserAndAnimal(db, user.id, animalId)) {
      throw new AdoptionAlreadyOpenError(animal.name);
    }
    return toDto(await adoptionModel.create(db, { userId: user.id, animalId, planId }));
  }

  /** CU-15: mis adopciones, las más recientes primero. */
  async function listMine(userId: number, filtro: { animalId?: number }): Promise<AdoptionDto[]> {
    return (await adoptionModel.listByUser(db, userId, filtro)).map(toDto);
  }

  /** CU-15: detalle de una adopción propia; una ajena no existe (404). */
  async function getMine(userId: number, adoptionId: number): Promise<AdoptionDto> {
    const adopcion = await adoptionModel.findOwnedById(db, userId, adoptionId);
    if (!adopcion) throw new NotFoundError();
    return toDto(adopcion);
  }

  /** Comprueba que la adopción tiene una cuota pendiente que se pueda pagar ahora. */
  function comprobarPagable(adopcion: adoptionModel.Adoption): void {
    if (puedePagar(adopcion, reloj.ahora())) return;
    if (adopcion.status === 'pending') throw new AdoptionPaymentExpiredError();
    if (adopcion.status === 'active') throw new AdoptionNotPayableError();
    throw new AdoptionClosedError();
  }

  async function enviarRecibo(
    userId: number,
    adopcion: adoptionModel.Adoption,
    pago: { periodStart: string; periodEnd: string; reference: string },
    bienvenida: boolean,
  ): Promise<void> {
    try {
      const user = await userModel.findById(db, userId);
      if (!user) return;
      const datos = {
        firstName: user.firstName,
        animalName: adopcion.animal.name,
        planName: adopcion.plan.name,
        amount: adopcion.plan.monthlyAmount,
        ...pago,
        url: new URL('/my-animals', clientUrl).toString(),
      };
      // Los emails de pagos se envían siempre, sin mirar las preferencias (RN-19).
      await email.send({
        to: user.email,
        ...(bienvenida ? adoptionWelcomeEmail(datos) : paymentCompletedEmail(datos)),
      });
    } catch (error) {
      logEmailError(error);
    }
  }

  /**
   * CU-13 pasos 6-8 y CU-14. Pendiente: cobra el mes que empieza hoy y la
   * activa. Pausada: cobra el mes que empieza en `next_billing_date` y avanza
   * el siguiente cobro. Un pago fallido se guarda y no cambia el estado.
   */
  async function pay(
    userId: number,
    adoptionId: number,
    simulatedOutcome?: SimulatedOutcome,
  ): Promise<PayAdoptionResponse> {
    const adopcion = await adoptionModel.findOwnedById(db, userId, adoptionId);
    if (!adopcion) throw new NotFoundError();
    comprobarPagable(adopcion);
    const primerPago = adopcion.status === 'pending';
    if (primerPago) await animalAdoptable(adopcion.animal.id);

    const hoy = reloj.hoy();
    const periodo = periodoCuota(primerPago ? hoy : (adopcion.nextBillingDate ?? hoy));
    const resultado = await payments.charge({
      amount: adopcion.plan.monthlyAmount,
      description: `Cuota ${adopcion.plan.name} - ${adopcion.animal.name} - ${periodo.periodStart.slice(0, 7)}`,
      simulatedOutcome,
    });

    const payment = await withTransaction(db, async (client) => {
      const pago = await paymentModel.create(client, {
        adoptionId,
        amount: adopcion.plan.monthlyAmount,
        periodStart: periodo.periodStart,
        periodEnd: periodo.periodEnd,
        status: resultado.success ? 'completed' : 'failed',
        reference: resultado.reference,
        failureReason: resultado.success ? null : (resultado.failureReason ?? null),
        paidAt: resultado.success ? reloj.ahora() : null,
      });
      if (resultado.success) {
        await adoptionModel.activate(client, adoptionId, { startDate: hoy, nextBillingDate: periodo.nextBillingDate });
        await notificationModel.create(client, {
          userId,
          type: primerPago ? 'adoption_welcome' : 'payment_completed',
          message: primerPago
            ? `¡Ya adoptas a ${adopcion.animal.name}! Gracias por tu apoyo.`
            : `Hemos cobrado la cuota de ${adopcion.animal.name}. ¡Gracias!`,
          link: `/my-animals/${adopcion.animal.id}`,
        });
      }
      return pago;
    });

    if (resultado.success) {
      await enviarRecibo(userId, adopcion, { ...periodo, reference: resultado.reference }, primerPago);
    }
    const actualizada = (await adoptionModel.findOwnedById(db, userId, adoptionId)) ?? adopcion;
    return { adoption: toDto(actualizada), payment };
  }

  return { create, listMine, getMine, pay };
}

export type AdoptionService = ReturnType<typeof createAdoptionService>;
