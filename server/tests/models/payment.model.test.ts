import { describe, expect, it } from 'vitest';
import { PaymentAlreadyCompletedError } from '../../src/errors/app-error.js';
import { create } from '../../src/models/payment.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();
const cuota = {
  adoptionId: 11,
  amount: '5.00',
  periodStart: '2026-11-12',
  periodEnd: '2026-12-11',
};

describe('payment.model', () => {
  it('guarda un pago fallido con su motivo y sin fecha de cobro', async () => {
    const pago = await create(db.pool, {
      ...cuota,
      status: 'failed',
      reference: 'SIM-TEST-1',
      failureReason: 'Rechazado',
      paidAt: null,
    });
    expect(pago).toEqual({
      id: expect.any(Number),
      status: 'failed',
      amount: '5.00',
      periodStart: '2026-11-12',
      periodEnd: '2026-12-11',
      failureReason: 'Rechazado',
    });
  });

  it('guarda un pago completado (método simulado)', async () => {
    const paidAt = new Date('2026-11-12T10:00:00Z');
    const pago = await create(db.pool, {
      ...cuota,
      status: 'completed',
      reference: 'SIM-TEST-2',
      failureReason: null,
      paidAt,
    });
    const { rows } = await db.pool.query('SELECT method, paid_at, payment_reference FROM payments WHERE id = $1', [
      pago.id,
    ]);
    expect(rows[0]).toEqual({ method: 'simulated', paid_at: paidAt, payment_reference: 'SIM-TEST-2' });
  });

  it('no admite dos cuotas válidas del mismo mes', async () => {
    await expect(
      create(db.pool, {
        ...cuota,
        status: 'completed',
        reference: 'SIM-TEST-3',
        failureReason: null,
        paidAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(PaymentAlreadyCompletedError);
  });
});
