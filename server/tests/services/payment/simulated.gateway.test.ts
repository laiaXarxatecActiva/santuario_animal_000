import { describe, expect, it } from 'vitest';
import { relojFijo } from '../../../src/dominio/reloj.js';
import { createSimulatedGateway } from '../../../src/services/payment/simulated.gateway.js';

const reloj = relojFijo('2026-11-12T10:00:00Z');
const cobro = { amount: '5.00', description: 'Cuota Usual - Rufo - 2026-11' };

describe('SimulatedGateway (TECH_SPEC §11.1)', () => {
  it('el resultado pedido manda sobre el modo configurado', async () => {
    const gateway = createSimulatedGateway({ mode: 'always_fail', reloj });
    expect(await gateway.charge({ ...cobro, simulatedOutcome: 'success' })).toMatchObject({ success: true });
    const fallo = await createSimulatedGateway({ mode: 'always_succeed', reloj }).charge({
      ...cobro,
      simulatedOutcome: 'failure',
    });
    expect(fallo).toMatchObject({ success: false, failureReason: 'Pago rechazado por la pasarela simulada.' });
  });

  it('sin resultado pedido aplica el modo', async () => {
    expect((await createSimulatedGateway({ mode: 'always_succeed', reloj }).charge(cobro)).success).toBe(true);
    expect((await createSimulatedGateway({ mode: 'always_fail', reloj }).charge(cobro)).success).toBe(false);
  });

  it('en modo random falla con la probabilidad indicada', async () => {
    const valores = [0.1, 0.5];
    const gateway = createSimulatedGateway({
      mode: 'random',
      failureRate: 0.2,
      reloj,
      random: () => valores.shift() ?? 0,
    });
    expect((await gateway.charge(cobro)).success).toBe(false);
    expect((await gateway.charge(cobro)).success).toBe(true);
  });

  it('devuelve una referencia única SIM-<fecha>-<código>', async () => {
    const gateway = createSimulatedGateway({ mode: 'always_succeed', reloj });
    const a = await gateway.charge(cobro);
    const b = await gateway.charge(cobro);
    expect(a.reference).toMatch(/^SIM-20261112-[0-9A-F]{10}$/);
    expect(a.reference).not.toBe(b.reference);
  });

  it('las devoluciones simuladas siempre salen bien', async () => {
    expect(await createSimulatedGateway({ mode: 'always_fail', reloj }).refund('SIM-x')).toEqual({ success: true });
  });
});
