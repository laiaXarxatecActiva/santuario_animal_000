import { describe, expect, it } from 'vitest';
import {
  AccountInactiveError,
  AdoptionAlreadyOpenError,
  AdoptionClosedError,
  AdoptionNotPayableError,
  AdoptionPaymentExpiredError,
  AnimalNotAdoptableError,
  PaymentAlreadyCompletedError,
  PlanNotAvailableError,
  WorkerCannotAdoptError,
  AppError,
  EmailAlreadyRegisteredError,
  EmailAlreadyVerifiedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  InvalidTokenError,
  TooManyRequestsError,
  UnsupportedMediaTypeError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../src/errors/app-error.js';

describe('errores de la aplicación', () => {
  it.each([
    [new ValidationError([]), 400, 'VALIDATION_ERROR'],
    [new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError('ADOPTION_ALREADY_OPEN', 'x'), 409, 'ADOPTION_ALREADY_OPEN'],
    [new BusinessRuleError('ANIMAL_NOT_ADOPTABLE', 'x'), 422, 'ANIMAL_NOT_ADOPTABLE'],
  ])('%s tiene el estado HTTP y el código correctos', (error, status, code) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });

  it('conserva el nombre de la subclase', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
  });

  it('ValidationError guarda los detalles por campo', () => {
    const error = new ValidationError([{ field: 'email', message: 'Obligatorio' }]);
    expect(error.details).toEqual([{ field: 'email', message: 'Obligatorio' }]);
  });
});

describe('AnimalNotAvailableError', () => {
  it('CU-03 1a: es un 404 con su propio código', async () => {
    const { AnimalNotAvailableError, NotFoundError } = await import('../src/errors/app-error.js');
    const error = new AnimalNotAvailableError();
    expect(error).toBeInstanceOf(NotFoundError);
    expect([error.status, error.code, error.message]).toEqual([
      404,
      'ANIMAL_NOT_AVAILABLE',
      'Este animal no está disponible.',
    ]);
  });
});

describe('errores de autenticación (CU-07 a CU-10)', () => {
  it.each([
    [new EmailAlreadyRegisteredError(), 409, 'EMAIL_ALREADY_REGISTERED', 'Ya existe una cuenta con este email.'],
    [new InvalidCredentialsError(), 401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos.'],
    [new AccountInactiveError(), 403, 'ACCOUNT_INACTIVE', 'Esta cuenta no está activa. Contacta con el santuario.'],
    [new InvalidTokenError(), 422, 'INVALID_TOKEN', 'El enlace no es válido o ha caducado.'],
    [new EmailAlreadyVerifiedError(), 409, 'EMAIL_ALREADY_VERIFIED', 'Tu email ya estaba verificado.'],
    [new EmailNotVerifiedError(), 403, 'EMAIL_NOT_VERIFIED', 'Verifica tu email para poder adoptar.'],
    [new TooManyRequestsError(), 429, 'TOO_MANY_REQUESTS', 'Demasiados intentos; espera unos minutos.'],
    [new UnsupportedMediaTypeError(), 415, 'UNSUPPORTED_MEDIA_TYPE', 'La petición debe enviarse en formato JSON.'],
  ])('%s', (error, status, code, message) => {
    expect(error).toBeInstanceOf(AppError);
    expect({ status: error.status, code: error.code, message: error.message }).toEqual({ status, code, message });
  });
});

describe('errores de las adopciones (CU-13, CU-14)', () => {
  it.each([
    [new WorkerCannotAdoptError(), 403, 'WORKER_CANNOT_ADOPT', 'Las cuentas de trabajador no pueden adoptar.'],
    [new AnimalNotAdoptableError(), 422, 'ANIMAL_NOT_ADOPTABLE', 'Este animal ya no admite adopciones.'],
    [new PlanNotAvailableError(), 422, 'PLAN_NOT_AVAILABLE', 'Este plan ya no está disponible. Elige otro.'],
    [new AdoptionAlreadyOpenError('Rufo'), 409, 'ADOPTION_ALREADY_OPEN', 'Ya tienes una adopción en curso de Rufo.'],
    [new AdoptionAlreadyOpenError(), 409, 'ADOPTION_ALREADY_OPEN', 'Ya tienes una adopción en curso de este animal.'],
    [
      new AdoptionPaymentExpiredError(),
      422,
      'ADOPTION_PAYMENT_EXPIRED',
      'Han pasado más de 7 días sin completar el pago. Puedes empezar una adopción nueva.',
    ],
    [new AdoptionNotPayableError(), 422, 'ADOPTION_NOT_PAYABLE', 'Esta adopción no tiene ningún pago pendiente.'],
    [new AdoptionClosedError(), 422, 'ADOPTION_CLOSED', 'Esta adopción ya está cerrada.'],
    [new PaymentAlreadyCompletedError(), 409, 'PAYMENT_ALREADY_COMPLETED', 'Esta cuota ya está pagada.'],
  ])('%s', (error, status, code, message) => {
    expect({ status: error.status, code: error.code, message: error.message }).toEqual({ status, code, message });
  });
});
