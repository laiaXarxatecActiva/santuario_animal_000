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
