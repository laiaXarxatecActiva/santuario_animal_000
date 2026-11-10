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
