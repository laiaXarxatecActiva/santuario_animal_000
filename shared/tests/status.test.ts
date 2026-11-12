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
      'system',
    ]);
    expect(SIMULATED_OUTCOMES).toEqual(['success', 'failure']);
  });
});
