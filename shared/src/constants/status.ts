// Valores de estado. Deben coincidir con los CHECK de seedsql.sql.

export const ANIMAL_STATUSES = ['in_sanctuary', 'in_treatment', 'deceased', 'transferred'] as const;
export type AnimalStatus = (typeof ANIMAL_STATUSES)[number];

// Un animal fallecido o trasladado queda archivado y no es adoptable.
export const ARCHIVED_ANIMAL_STATUSES = ['deceased', 'transferred'] as const satisfies readonly AnimalStatus[];

export const ADOPTION_STATUSES = ['pending', 'active', 'paused', 'cancelled', 'finished'] as const;
export type AdoptionStatus = (typeof ADOPTION_STATUSES)[number];

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

// Estados comunes a pagos (cuotas) y donaciones.
export const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['simulated', 'cash', 'bank_transfer', 'card'] as const;
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
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Resultado que se pide a la pasarela simulada (TECH_SPEC §11.1).
export const SIMULATED_OUTCOMES = ['success', 'failure'] as const;
export type SimulatedOutcome = (typeof SIMULATED_OUTCOMES)[number];
