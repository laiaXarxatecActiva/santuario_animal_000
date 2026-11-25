// Valores de estado. Deben coincidir con los CHECK de seedsql.sql.

export const ANIMAL_STATUSES = ['in_sanctuary', 'in_treatment', 'deceased', 'transferred'] as const;
export type AnimalStatus = (typeof ANIMAL_STATUSES)[number];

// Un animal fallecido o trasladado queda archivado y no es adoptable.
export const ARCHIVED_ANIMAL_STATUSES = ['deceased', 'transferred'] as const satisfies readonly AnimalStatus[];

export const ADOPTION_STATUSES = ['pending', 'active', 'paused', 'cancelled', 'finished'] as const;
export type AdoptionStatus = (typeof ADOPTION_STATUSES)[number];

// CU-49: forma de pago de una adopción. Debe coincidir con el CHECK de adoptions.payment_mode.
// `automatic`: la tarea `billing` cobra cada mes; `manual`: el adoptante paga cada cuota.
export const PAYMENT_MODES = ['automatic', 'manual'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

// Adopción abierta: pendiente, activa o pausada (glosario de TECH_SPEC).
export const OPEN_ADOPTION_STATUSES = ['pending', 'active', 'paused'] as const satisfies readonly AdoptionStatus[];

export function isOpenAdoptionStatus(status: AdoptionStatus): boolean {
  return (OPEN_ADOPTION_STATUSES as readonly AdoptionStatus[]).includes(status);
}

export const ADOPTION_END_REASONS = [
  'user_cancelled',
  'payment_not_completed',
  'payment_failed',
  'animal_deceased',
  'animal_transferred',
  'admin_cancelled',
  'account_deleted',
] as const;
export type AdoptionEndReason = (typeof ADOPTION_END_REASONS)[number];

// CU-15: sucesos que guarda adoption_events (los apunta un trigger). Debe
// coincidir con su CHECK de seedsql.sql.
export const ADOPTION_EVENT_TYPES = [
  'plan_change_requested',
  'plan_change_cancelled',
  'plan_changed',
  'payment_mode_changed',
  'paused',
  'resumed',
] as const;
export type AdoptionEventType = (typeof ADOPTION_EVENT_TYPES)[number];

// CU-15: todos los sucesos del historial. Los primeros salen de adoptions y payments.
export const HISTORY_EVENT_TYPES = [
  'adopted',
  'payment_completed',
  'payment_failed',
  'payment_refunded',
  'cancel_requested',
  'ended',
  ...ADOPTION_EVENT_TYPES,
] as const;
export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

// Estados comunes a pagos (cuotas) y donaciones.
export const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['simulated', 'cash', 'bank_transfer', 'card'] as const;
// CU-37: métodos de un pago registrado a mano por un administrador.
export const MANUAL_PAYMENT_METHODS = ['cash', 'bank_transfer'] as const satisfies readonly PaymentMethod[];
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

// CU-37 A1-A3: acciones del administrador sobre una adopción.
export const ADOPTION_ADMIN_ACTIONS = ['pause', 'resume', 'cancel'] as const;
export type AdoptionAdminAction = (typeof ADOPTION_ADMIN_ACTIONS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const VISIBILITIES = ['public', 'adopters'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

// Tipos de notificación. Deben coincidir con el CHECK de notifications.type.
export const NOTIFICATION_TYPES = [
  'new_update',
  'adoption_welcome',
  'payment_completed',
  'payment_failed',
  'plan_changed',
  'adoption_cancelled',
  'adoption_closed',
  'donation_thanks',
  'update_reminder',
  'coverage_gap',
  'low_intake',
  'medication_missed',
  'vet_visit_today',
  'incident_reported',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Resultado que se pide a la pasarela simulada (TECH_SPEC §11.1).
export const SIMULATED_OUTCOMES = ['success', 'failure'] as const;
export type SimulatedOutcome = (typeof SIMULATED_OUTCOMES)[number];
