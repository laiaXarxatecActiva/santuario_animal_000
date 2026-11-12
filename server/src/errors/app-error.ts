// Errores con significado HTTP. El errorHandler central los traduce a
// `{ error: { code, message, details } }`. Nunca se lanzan strings.

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(details: ErrorDetail[], message = 'Los datos enviados no son válidos.') {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Tienes que iniciar sesión.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para esta acción.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'No encontrado.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class BusinessRuleError extends AppError {
  constructor(code: string, message: string) {
    super(422, code, message);
  }
}

// CU-03 1a: no existe, no está publicado o está fallecido o trasladado.
export class AnimalNotAvailableError extends NotFoundError {
  override readonly code = 'ANIMAL_NOT_AVAILABLE';
  constructor() {
    super('Este animal no está disponible.');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Demasiados intentos; espera unos minutos.') {
    super(429, 'TOO_MANY_REQUESTS', message);
  }
}

// TECH_SPEC §13 (CSRF): las peticiones que modifican datos solo se aceptan en JSON.
export class UnsupportedMediaTypeError extends AppError {
  constructor() {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', 'La petición debe enviarse en formato JSON.');
  }
}

// CU-07 3a.
export class EmailAlreadyRegisteredError extends ConflictError {
  constructor() {
    super('EMAIL_ALREADY_REGISTERED', 'Ya existe una cuenta con este email.');
  }
}

// CU-09 3a: no se indica si falla el email o la contraseña.
export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos.');
  }
}

// CU-09 3b.
export class AccountInactiveError extends AppError {
  constructor() {
    super(403, 'ACCOUNT_INACTIVE', 'Esta cuenta no está activa. Contacta con el santuario.');
  }
}

// CU-08 2a y CU-10 5a: token caducado, usado o inexistente.
export class InvalidTokenError extends BusinessRuleError {
  constructor() {
    super('INVALID_TOKEN', 'El enlace no es válido o ha caducado.');
  }
}

// CU-08 3a, al pedir un reenvío.
export class EmailAlreadyVerifiedError extends ConflictError {
  constructor() {
    super('EMAIL_ALREADY_VERIFIED', 'Tu email ya estaba verificado.');
  }
}

// RN-21: acciones que exigen el email verificado (requireVerifiedEmail).
export class EmailNotVerifiedError extends AppError {
  constructor() {
    super(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu email para poder adoptar.');
  }
}

// RN-03 (CU-13 2a).
export class WorkerCannotAdoptError extends AppError {
  constructor() {
    super(403, 'WORKER_CANNOT_ADOPT', 'Las cuentas de trabajador no pueden adoptar.');
  }
}

// RN-06 (CU-13 5b).
export class AnimalNotAdoptableError extends BusinessRuleError {
  constructor() {
    super('ANIMAL_NOT_ADOPTABLE', 'Este animal ya no admite adopciones.');
  }
}

// CU-13 5c.
export class PlanNotAvailableError extends BusinessRuleError {
  constructor() {
    super('PLAN_NOT_AVAILABLE', 'Este plan ya no está disponible. Elige otro.');
  }
}

// RN-05 (CU-13 5a).
export class AdoptionAlreadyOpenError extends ConflictError {
  constructor(animalName?: string) {
    super('ADOPTION_ALREADY_OPEN', `Ya tienes una adopción en curso de ${animalName ?? 'este animal'}.`);
  }
}

// RN-07 (CU-14 1a).
export class AdoptionPaymentExpiredError extends BusinessRuleError {
  constructor() {
    super(
      'ADOPTION_PAYMENT_EXPIRED',
      'Han pasado más de 7 días sin completar el pago. Puedes empezar una adopción nueva.',
    );
  }
}

// CU-14: la adopción está al día.
export class AdoptionNotPayableError extends BusinessRuleError {
  constructor() {
    super('ADOPTION_NOT_PAYABLE', 'Esta adopción no tiene ningún pago pendiente.');
  }
}

// CU-14 4a: cerrada (por ejemplo, porque el animal ha fallecido o se ha trasladado).
export class AdoptionClosedError extends BusinessRuleError {
  constructor() {
    super('ADOPTION_CLOSED', 'Esta adopción ya está cerrada.');
  }
}

// Índice `payments_one_valid_per_period`: dos pagos a la vez del mismo mes.
export class PaymentAlreadyCompletedError extends ConflictError {
  constructor() {
    super('PAYMENT_ALREADY_COMPLETED', 'Esta cuota ya está pagada.');
  }
}

// CU-23: preferencias que solo tienen los adoptantes (RN-16, RN-19).
export class AdopterOnlyPreferenceError extends AppError {
  constructor() {
    super(403, 'ADOPTER_ONLY_PREFERENCE', 'Estas preferencias solo están disponibles para los adoptantes.');
  }
}

// CU-24 2a. El detalle permite mostrarlo junto al campo.
export class InvalidCurrentPasswordError extends BusinessRuleError {
  constructor() {
    super('INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta.');
  }
  override readonly details = [{ field: 'currentPassword', message: 'La contraseña actual no es correcta.' }];
}

// CU-24: la nueva contraseña coincide con la actual.
export class PasswordUnchangedError extends BusinessRuleError {
  constructor() {
    super('PASSWORD_UNCHANGED', 'La nueva contraseña debe ser distinta de la actual.');
  }
  override readonly details = [
    { field: 'newPassword', message: 'La nueva contraseña debe ser distinta de la actual.' },
  ];
}

// Error de negocio sobre un campo concreto del formulario (422 con detalle).
export class FieldRuleError extends AppError {
  constructor(code: string, field: string, message: string) {
    super(422, code, message, [{ field, message }]);
  }
}

// CU-30 4a.
export class SpeciesAlreadyExistsError extends AppError {
  constructor() {
    super(409, 'SPECIES_ALREADY_EXISTS', 'Esta especie ya existe.', [
      { field: 'name', message: 'Esta especie ya existe.' },
    ]);
  }
}

// CU-30 A1.
export class SpeciesInUseError extends ConflictError {
  constructor(animales: number) {
    super(
      'SPECIES_IN_USE',
      animales === 1 ? 'Hay 1 animal de esta especie.' : `Hay ${animales} animales de esta especie.`,
    );
  }
}

// CU-28 A4 y RN-17.
export class AnimalHasAdoptionsError extends ConflictError {
  constructor() {
    super('ANIMAL_HAS_ADOPTIONS', 'Este animal tiene historial de adopciones; archívalo cambiando su estado.');
  }
}

// CU-28 2b (CHECK animals_archived_not_adoptable).
export class ArchivedAnimalNotAdoptableError extends FieldRuleError {
  constructor() {
    super(
      'ARCHIVED_ANIMAL_NOT_ADOPTABLE',
      'isAdoptable',
      'Un animal fallecido o trasladado no puede admitir adopciones.',
    );
  }
}

// CU-33 (precondición): un animal fallecido o trasladado ya no cambia de estado.
export class AnimalArchivedError extends BusinessRuleError {
  constructor() {
    super('ANIMAL_ARCHIVED', 'Este animal está archivado (fallecido o trasladado) y su estado ya no se puede cambiar.');
  }
}
