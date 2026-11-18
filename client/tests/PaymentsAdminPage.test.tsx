import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminPayments, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

const pagina = {
  data: adminPayments,
  meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  totalCollected: '12.00',
};

function api(user = admin(), extra: Record<string, () => { status?: number; body?: unknown }> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/payments': { body: pagina },
    '/api/admin/dashboard': {
      body: { animalsByStatus: {}, activeAdoptions: 0, pendingAdoptions: 0, updateAlerts: [] },
    },
    ...extra,
  });
}

describe('CU-38 Gestionar pagos', () => {
  it('el enlace «Pagos» del menú solo lo ve el administrador', async () => {
    api();
    const vista = renderRoute('/admin');
    expect(await screen.findByRole('link', { name: 'Pagos' })).toHaveAttribute('href', '/admin/payments');
    vista.unmount();

    api(caretaker());
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Pagos' })).not.toBeInTheDocument();
  });

  it('2: muestra las cuotas y la suma de lo cobrado con los filtros', async () => {
    api();
    renderRoute('/admin/payments');
    expect(await screen.findByRole('heading', { level: 1, name: 'Pagos' })).toBeInTheDocument();
    expect(await screen.findByText(/^Cobrado con estos filtros: 12,00\s€$/)).toBeInTheDocument();
    const raquel = screen.getByRole('link', { name: 'Raquel Font Escrivà' });
    expect(raquel).toHaveAttribute('href', '/admin/adoptions/14');
    const fila = raquel.closest('tr') as HTMLElement;
    expect(within(fila).getByText('Ébano')).toBeInTheDocument();
    expect(within(fila).getByText('Efectivo')).toBeInTheDocument();
    expect(within(fila).getByText('Cobrado')).toBeInTheDocument();
    const elena = screen.getByRole('link', { name: 'Elena Rubio Sanz' }).closest('tr') as HTMLElement;
    expect(within(elena).getByText('Fallido')).toBeInTheDocument();
    expect(within(elena).queryByRole('button', { name: /Devolver/ })).not.toBeInTheDocument();
  });

  it('2: busca y filtra por estado, método y fechas', async () => {
    const { pedidas } = api();
    renderRoute('/admin/payments');
    await userEvent.type(await screen.findByLabelText('Buscar por adoptante o animal'), 'raquel');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Cobrado');
    await userEvent.selectOptions(screen.getByLabelText('Forma de pago'), 'Efectivo');
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-31');
    await waitFor(() => {
      const ultima = pedidas('/api/admin/payments').at(-1);
      expect(ultima?.searchParams.get('q')).toBe('raquel');
      expect(ultima?.searchParams.get('status')).toBe('completed');
      expect(ultima?.searchParams.get('method')).toBe('cash');
      expect(ultima?.searchParams.get('from')).toBe('2026-10-01');
      expect(ultima?.searchParams.get('to')).toBe('2026-10-31');
    });
  });

  it('3: «Exportar CSV» descarga con los mismos filtros', async () => {
    api();
    renderRoute('/admin/payments?method=cash&status=completed&page=2');
    const enlace = await screen.findByRole('link', { name: 'Exportar CSV' });
    expect(enlace).toHaveAttribute('href', '/api/admin/payments/export.csv?status=completed&method=cash');
  });

  it('A1: devolver pide confirmación y avisa del resultado', async () => {
    const { pedidas } = api(admin(), {
      '/api/admin/payments/70/refund': () => ({ body: { ...adminPayments[0], status: 'refunded' } }),
    });
    renderRoute('/admin/payments');
    await userEvent.click(await screen.findByRole('button', { name: /^Devolver 12,00\s€ a Raquel Font Escrivà$/ }));
    const ventana = await screen.findByRole('dialog', { name: '¿Devolver este pago?' });
    expect(ventana).toHaveTextContent('Raquel Font Escrivà');
    expect(ventana).toHaveTextContent('Se pagó en efectivo o por transferencia');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Devolver' }));
    expect(await screen.findByText('Pago devuelto. Hemos avisado al adoptante.')).toBeInTheDocument();
    expect(pedidas('/api/admin/payments/70/refund')).toHaveLength(1);
  });

  it('A1a: el error del servidor se muestra', async () => {
    api(admin(), {
      '/api/admin/payments/70/refund': () => errorApi(422, 'PAYMENT_NOT_REFUNDABLE', 'x'),
    });
    renderRoute('/admin/payments');
    await userEvent.click(await screen.findByRole('button', { name: /^Devolver 12,00\s€ a Raquel Font Escrivà$/ }));
    const ventana = await screen.findByRole('dialog');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Devolver' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se puede devolver un pago cobrado.');
  });

  it('error al cargar: aviso con «Reintentar»', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/payments': errorApi(500, 'INTERNAL_ERROR', 'x'),
    });
    renderRoute('/admin/payments');
    expect(await screen.findByText('No hemos podido cargar los pagos')).toBeInTheDocument();
  });
});
