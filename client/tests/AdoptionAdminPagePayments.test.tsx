import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminAdoptionDetail, adminPayments } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

describe('CU-38 desde la ficha de la adopción', () => {
  it('A2: «Registrar pago» muestra la cuota pendiente y la registra', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/adoptions/4': { body: adminAdoptionDetail() },
      '/api/admin/payments': () => ({ status: 201, body: adminPayments[0] }),
    });
    renderRoute('/admin/adoptions/4');
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const ventana = await screen.findByRole('dialog', { name: 'Registrar un pago' });
    expect(ventana).toHaveTextContent('Cuota del 16 dic 2026 al 15 ene 2027');
    const importe = within(ventana).getByLabelText('Importe (€)');
    expect(importe).toHaveValue('1,00');
    await userEvent.clear(importe);
    await userEvent.type(importe, '2,50');
    // Sin desplegable: solo se registran transferencias.
    expect(within(ventana).queryByLabelText('Forma de pago')).not.toBeInTheDocument();
    expect(within(ventana).getByText('Forma de pago: transferencia.')).toBeInTheDocument();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Registrar pago' }));
    expect(await screen.findByText('Pago registrado. Hemos enviado el recibo al adoptante.')).toBeInTheDocument();
    expect(enviados('/api/admin/payments')).toEqual([{ adoptionId: 4, amount: '2,50', method: 'bank_transfer' }]);
  });

  it('A2: valida antes de enviar y muestra el error del servidor', async () => {
    const { pedidas } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/adoptions/4': { body: adminAdoptionDetail() },
      '/api/admin/payments': () => errorApi(409, 'PAYMENT_ALREADY_COMPLETED', 'Este periodo ya está pagado.'),
    });
    renderRoute('/admin/adoptions/4');
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const ventana = await screen.findByRole('dialog');
    const importe = within(ventana).getByLabelText('Importe (€)');
    await userEvent.clear(importe);
    await userEvent.click(within(ventana).getByRole('button', { name: 'Registrar pago' }));
    expect(importe).toHaveAttribute('aria-invalid', 'true');
    expect(pedidas('/api/admin/payments')).toHaveLength(0);

    await userEvent.type(importe, '1,00');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Registrar pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Este periodo ya está pagado.');
  });

  it('sin cuota pendiente no hay «Registrar pago»', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/adoptions/4': { body: adminAdoptionDetail({ pendingFee: null }) },
    });
    renderRoute('/admin/adoptions/4');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
  });

  it('CU-37 A3: al cancelar se puede devolver también la última cuota cobrada', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/adoptions/4': { body: adminAdoptionDetail() },
      '/api/admin/adoptions/4/status': () => ({ body: adminAdoptionDetail({ status: 'cancelled' }) }),
    });
    renderRoute('/admin/adoptions/4');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar adopción' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Cancelar la adopción?' });
    await userEvent.type(within(ventana).getByLabelText('Motivo (nota interna)'), 'Lo pidió.');
    await userEvent.click(
      within(ventana).getByRole('checkbox', { name: /^Devolver también la última cuota cobrada \(1,00\s€\)$/ }),
    );
    await userEvent.click(within(ventana).getByRole('button', { name: 'Cancelar adopción' }));
    await waitFor(() =>
      expect(enviados('/api/admin/adoptions/4/status').filter((b) => b !== undefined)).toEqual([
        { action: 'cancel', notes: 'Lo pidió.', refundLastPayment: true },
      ]),
    );
  });

  it('sin cuotas cobradas, la ventana de cancelar no ofrece devolver', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/adoptions/4': { body: adminAdoptionDetail({ lastRefundablePayment: null }) },
    });
    renderRoute('/admin/adoptions/4');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar adopción' }));
    const ventana = await screen.findByRole('dialog');
    expect(within(ventana).queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
