import { describe, expect, it } from 'vitest';
import { mapRow } from '../../src/models/adoption-plan.model.js';

describe('adoption-plan.model', () => {
  it('mapRow conserva el importe como string (nunca float)', () => {
    expect(mapRow({ id: 2, name: 'Usual', monthly_amount: '5.00', description: null, is_default: true })).toEqual({
      id: 2,
      name: 'Usual',
      monthlyAmount: '5.00',
      description: null,
      isDefault: true,
    });
  });
});
