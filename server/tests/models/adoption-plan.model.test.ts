import { describe, expect, it } from 'vitest';
import { findActiveById, mapRow } from '../../src/models/adoption-plan.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

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

describe('findActiveById (CU-13 5c)', () => {
  const db = usarBaseDeDatos();

  it('devuelve un plan activo y null si está desactivado o no existe', async () => {
    expect(await findActiveById(db.pool, 2)).toMatchObject({ id: 2, name: 'Usual', monthlyAmount: '5.00' });
    await db.pool.query('UPDATE adoption_plans SET is_active = FALSE WHERE id = 3');
    expect(await findActiveById(db.pool, 3)).toBeNull();
    expect(await findActiveById(db.pool, 99)).toBeNull();
  });
});
