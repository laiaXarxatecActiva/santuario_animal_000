import { describe, expect, it } from 'vitest';
import { ADOPTION_STATUSES, isOpenAdoptionStatus } from '../src/constants/status.js';

describe('estados de adopción', () => {
  it('pendiente, activa y pausada son adopciones abiertas', () => {
    const abiertas = ADOPTION_STATUSES.filter(isOpenAdoptionStatus);
    expect(abiertas).toEqual(['pending', 'active', 'paused']);
  });

  it('cancelada y finalizada son adopciones cerradas', () => {
    expect(isOpenAdoptionStatus('cancelled')).toBe(false);
    expect(isOpenAdoptionStatus('finished')).toBe(false);
  });
});

describe('constantes de pagos y notificaciones', () => {
  it('coinciden con los CHECK de seedsql.sql', async () => {
    const { NOTIFICATION_TYPES, SIMULATED_OUTCOMES } = await import('../src/constants/status.js');
    expect(NOTIFICATION_TYPES).toEqual([
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
    ]);
    expect(SIMULATED_OUTCOMES).toEqual(['success', 'failure']);
  });
});

describe('CU-15 sucesos del historial de adopciones', () => {
  it('los guardados en adoption_events coinciden con el CHECK de seedsql.sql', async () => {
    const { ADOPTION_EVENT_TYPES } = await import('../src/constants/status.js');
    expect(ADOPTION_EVENT_TYPES).toEqual([
      'plan_change_requested',
      'plan_change_cancelled',
      'plan_changed',
      'payment_mode_changed',
      'paused',
      'resumed',
    ]);
  });

  it('el historial suma a esos los que salen de las adopciones y los pagos', async () => {
    const { ADOPTION_EVENT_TYPES, HISTORY_EVENT_TYPES } = await import('../src/constants/status.js');
    expect(HISTORY_EVENT_TYPES).toEqual([
      'adopted',
      'payment_completed',
      'payment_failed',
      'payment_refunded',
      'cancel_requested',
      'ended',
      ...ADOPTION_EVENT_TYPES,
    ]);
  });
});
