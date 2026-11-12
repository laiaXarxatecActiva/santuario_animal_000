import { describe, expect, it } from 'vitest';
import {
  AppError,
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
