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

// CSRF: petición que modifica datos enviada desde otra web (TECH_SPEC §13).
export class OriginNotAllowedError extends ForbiddenError {
  override readonly code = 'ORIGIN_NOT_ALLOWED';
  constructor() {
    super('La petición no procede de la web del santuario.');
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
// CU-25 3a.
export class InvalidPasswordError extends BusinessRuleError {
  constructor() {
    super('INVALID_PASSWORD', 'La contraseña no es correcta.');
  }
  override readonly details = [{ field: 'password', message: 'La contraseña no es correcta.' }];
}

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

// CU-29 A1: la portada debe seguir siendo pública.
export class CoverMustBePublicError extends FieldRuleError {
  constructor() {
    super(
      'COVER_MUST_BE_PUBLIC',
      'visibility',
      'La portada no puede ser solo para adoptantes. Elige antes otra portada.',
    );
  }
}

// CU-29 5a.
export class InvalidCoverError extends BusinessRuleError {
  constructor() {
    super(
      'INVALID_COVER',
      'La portada tiene que ser una foto pública de la galería del animal (no un vídeo ni una foto solo para adoptantes).',
    );
  }
}

// CU-29 paso 5: el orden no coincide con las fotos de la galería.
export class InvalidPhotoOrderError extends BusinessRuleError {
  constructor() {
    super('INVALID_PHOTO_ORDER', 'El orden debe incluir todas las fotos de la galería, una sola vez cada una.');
  }
}

// CU-29: las fotos de una actualización se gestionan desde ella (CU-32).
export class PhotoBelongsToUpdateError extends BusinessRuleError {
  constructor() {
    super('PHOTO_BELONGS_TO_UPDATE', 'Esta foto es de una actualización; cámbiala desde la actualización.');
  }
}

// CU-29 paso 2: sin archivos.
export class NoFilesError extends AppError {
  constructor() {
    super(400, 'NO_FILES', 'Elige al menos un archivo.');
  }
}

// CU-29 paso 2: como máximo 10 archivos por subida.
export class TooManyFilesError extends AppError {
  constructor() {
    super(400, 'TOO_MANY_FILES', 'Puedes subir como máximo 10 archivos a la vez.');
  }
}

// CU-29 paso 2: un archivo supera el máximo de cualquier tipo (50 MB).
export class FileTooLargeError extends AppError {
  constructor() {
    super(413, 'FILE_TOO_LARGE', 'Algún archivo supera los 50 MB.');
  }
}

// CU-31 precondición.
export class UpdateAnimalArchivedError extends BusinessRuleError {
  constructor() {
    super('UPDATE_ANIMAL_ARCHIVED', 'No se pueden publicar actualizaciones de un animal fallecido o trasladado.');
  }
}

// CU-32 1a.
export class NotUpdateAuthorError extends ForbiddenError {
  constructor() {
    super('Solo puedes modificar tus propias actualizaciones.');
  }
}

// CU-31: los archivos de una actualización se publican todos o ninguno.
export class FilesRejectedError extends AppError {
  constructor(details: ErrorDetail[]) {
    super(422, 'FILES_REJECTED', 'Algún archivo no se puede subir; revísalo o quítalo.', details);
  }
}

/** CU-20 1a: la adopción no está activa o tiene la baja solicitada. */
export class PlanChangeNotAllowedError extends BusinessRuleError {
  constructor() {
    super('PLAN_CHANGE_NOT_ALLOWED', 'Solo puedes cambiar el plan de una adopción activa sin baja solicitada.');
  }
}

/** CU-21: la baja ya estaba solicitada. */
export class AdoptionCancelAlreadyRequestedError extends ConflictError {
  constructor() {
    super('ADOPTION_CANCEL_ALREADY_REQUESTED', 'Ya habías solicitado la baja de esta adopción.');
  }
}

/** CU-19 4a: los pagos fallidos o pendientes no tienen recibo. */
export class ReceiptNotAvailableError extends BusinessRuleError {
  constructor() {
    super('RECEIPT_NOT_AVAILABLE', 'Este pago no tiene recibo porque no se ha cobrado.');
  }
}

/** CU-06 3c: no se ha podido enviar el email; el formulario conserva lo escrito. */
export class EmailNotSentError extends AppError {
  constructor() {
    super(503, 'EMAIL_NOT_SENT', 'No hemos podido enviar tu mensaje. Inténtalo de nuevo más tarde.');
  }
}

/** CU-40: nombre repetido (índice `adoption_plans_name_lower_key`). */
export class PlanAlreadyExistsError extends AppError {
  constructor() {
    super(409, 'PLAN_ALREADY_EXISTS', 'Ya existe un plan con este nombre.', [
      { field: 'name', message: 'Ya existe un plan con este nombre.' },
    ]);
  }
}

/** CU-40 A1: el plan por defecto tiene que estar activo. */
export class DefaultPlanMustBeActiveError extends FieldRuleError {
  constructor() {
    super(
      'DEFAULT_PLAN_MUST_BE_ACTIVE',
      'isActive',
      'No se puede desactivar el plan por defecto sin elegir antes otro.',
    );
  }
}

/** CU-40 A1: siempre hay un plan por defecto; se cambia marcando otro. */
export class DefaultPlanNeedsReplacementError extends FieldRuleError {
  constructor() {
    super(
      'DEFAULT_PLAN_NEEDS_REPLACEMENT',
      'isDefault',
      'Siempre tiene que haber un plan por defecto: marca otro plan como plan por defecto.',
    );
  }
}

/** CU-40 3a: el nuevo importe afecta a adopciones activas y no se ha confirmado. */
export class PlanAmountChangeUnconfirmedError extends ConflictError {
  constructor(adopciones: number) {
    super(
      'PLAN_AMOUNT_CHANGE_UNCONFIRMED',
      adopciones === 1
        ? 'El nuevo importe se cobrará a la adopción activa de este plan desde su siguiente cuota. Confírmalo para guardarlo.'
        : `El nuevo importe se cobrará a las ${adopciones} adopciones activas de este plan desde su siguiente cuota. Confírmalo para guardarlo.`,
    );
  }
}

/** CU-35 4b: el administrador no puede desactivar su propia cuenta. */
export class CannotDeactivateSelfError extends BusinessRuleError {
  constructor() {
    super('CANNOT_DEACTIVATE_SELF', 'No puedes desactivar tu propia cuenta.');
  }
}

/** CU-35 4c: una cuenta anonimizada ya no tiene datos personales. */
export class AnonymizedCannotReactivateError extends BusinessRuleError {
  constructor() {
    super('ANONYMIZED_CANNOT_REACTIVATE', 'Esta cuenta se eliminó a petición de su titular y no se puede reactivar.');
  }
}

/** CU-35 A1 (RN-01, RN-03): un adoptante no se convierte en trabajador ni al revés. */
export class RoleChangeNotAllowedError extends BusinessRuleError {
  constructor() {
    super('ROLE_CHANGE_NOT_ALLOWED', 'El rol solo se puede cambiar entre cuidador y administrador.');
  }
}

/** CU-35 A1: siempre tiene que quedar un administrador activo. */
export class LastActiveAdminError extends BusinessRuleError {
  constructor() {
    super('LAST_ACTIVE_ADMIN', 'Es el último administrador activo: nombra antes a otro administrador.');
  }
}

/** CU-36 3a: el email ya tiene cuenta (aunque sea de un adoptante, no se convierte). */
export class WorkerEmailTakenError extends AppError {
  constructor() {
    super(409, 'EMAIL_ALREADY_REGISTERED', 'Ya existe una cuenta con este email.', [
      { field: 'email', message: 'Ya existe una cuenta con este email.' },
    ]);
  }
}

/** CU-36 4a: solo se reenvía a un trabajador activo que nunca ha entrado. */
export class InvitationNotPendingError extends ConflictError {
  constructor() {
    super('INVITATION_NOT_PENDING', 'Esta cuenta no tiene ninguna invitación pendiente.');
  }
}

// CU-37 2a: el adoptante elegido no existe o su cuenta no está activa.
export class AdopterNotAvailableError extends BusinessRuleError {
  constructor() {
    super('ADOPTER_NOT_AVAILABLE', 'Esta cuenta no existe o no está activa.');
  }
}

// CU-37 A1-A3: la acción no corresponde al estado de la adopción.
export class AdoptionActionNotAllowedError extends BusinessRuleError {
  constructor() {
    super('ADOPTION_ACTION_NOT_ALLOWED', 'Esta acción no se puede hacer con la adopción en su estado actual.');
  }
}
