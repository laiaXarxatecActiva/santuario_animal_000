import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminDonations, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

const pagina = {
  data: adminDonations,
  meta: { page: 1, pageSize: 20, total: 3, totalPages: 1 },
  totalCollected: '187.40',
};
const meses = {
  data: [
    { month: '2026-09', total: '100.00', count: 1 },
    { month: '2026-10', total: '87.40', count: 1 },
    { month: '2026-11', total: '0.00', count: 0 },
  ],
};

function api(user = admin(), extra: Record<string, () => { status?: number; body?: unknown }> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/donations': { body: pagina },
    '/api/admin/donations/monthly-totals': { body: meses },
    '/api/admin/dashboard': {
      body: { animalsByStatus: {}, activeAdoptions: 0, pendingAdoptions: 0, updateAlerts: [] },
    },
    ...extra,
  });
}

describe('CU-39 Gestionar donaciones', () => {
  it('el enlace «Donaciones» del menú solo lo ve el administrador', async () => {
    api();
    const vista = renderRoute('/admin');
    expect(await screen.findByRole('link', { name: 'Donaciones' })).toHaveAttribute('href', '/admin/donations');
    vista.unmount();

    api(caretaker());
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Donaciones' })).not.toBeInTheDocument();
  });

  it('2: muestra las donaciones y la suma de lo recaudado con los filtros', async () => {
    api();
    renderRoute('/admin/donations');
    expect(await screen.findByRole('heading', { level: 1, name: 'Donaciones' })).toBeInTheDocument();
    expect(await screen.findByText(/^Recaudado con estos filtros: 187,40\s€$/)).toBeInTheDocument();
    const hucha = screen.getByText('Visitantes de la jornada').closest('tr') as HTMLElement;
    expect(within(hucha).getByText('Recaudado en la hucha.')).toBeInTheDocument();
    expect(within(hucha).getByText('Efectivo')).toBeInTheDocument();
    expect(within(hucha).getByText('Cobrada')).toBeInTheDocument();
    const marcos = screen.getByText('Marcos').closest('tr') as HTMLElement;
    expect(within(marcos).getByText('Fallida')).toBeInTheDocument();
    expect(within(marcos).queryByRole('button', { name: /Devolver/ })).not.toBeInTheDocument();
  });

  it('2: una anónima sale como «Anónimo», con el nombre y el email solo para el administrador', async () => {
    api();
    renderRoute('/admin/donations');
    const fila = (await screen.findByText('Anónimo')).closest('tr') as HTMLElement;
    expect(within(fila).getByText('Pablo García Esteve · pablo.garcia@correo.test')).toBeInTheDocument();
  });

  it('2: busca y filtra por estado, forma de pago y fechas', async () => {
    const { pedidas } = api();
    renderRoute('/admin/donations');
    await userEvent.type(await screen.findByLabelText('Buscar por nombre o email del donante'), 'pablo');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Cobrada');
    await userEvent.selectOptions(screen.getByLabelText('Forma de pago'), 'Efectivo');
    await userEvent.type(screen.getByLabelText('Desde'), '2026-09-01');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-31');
    await waitFor(() => {
      const ultima = pedidas('/api/admin/donations').at(-1);
      expect(ultima?.searchParams.get('q')).toBe('pablo');
      expect(ultima?.searchParams.get('status')).toBe('completed');
      expect(ultima?.searchParams.get('method')).toBe('cash');
      expect(ultima?.searchParams.get('from')).toBe('2026-09-01');
      expect(ultima?.searchParams.get('to')).toBe('2026-10-31');
    });
  });

  it('3: la pestaña «Por meses» muestra lo cobrado cada mes con los mismos filtros (sin el estado)', async () => {
    const { pedidas } = api();
    renderRoute('/admin/donations?method=simulated&status=failed&from=2026-09-01');
    await userEvent.click(await screen.findByRole('tab', { name: 'Por meses' }));
    const panel = screen.getByRole('tabpanel');
    const octubre = (await within(panel).findByText('octubre de 2026')).closest('tr') as HTMLElement;
    expect(within(octubre).getByText(/^87,40\s€$/)).toBeInTheDocument();
    const noviembre = within(panel).getByText('noviembre de 2026').closest('tr') as HTMLElement;
    expect(within(noviembre).getByText(/^0,00\s€$/)).toBeInTheDocument();
    const peticion = pedidas('/api/admin/donations/monthly-totals').at(-1);
    expect(peticion?.searchParams.get('method')).toBe('simulated');
    expect(peticion?.searchParams.get('from')).toBe('2026-09-01');
    expect(peticion?.searchParams.has('status')).toBe(false);
    expect(within(panel).getByText('Solo cuenta las donaciones cobradas.')).toBeInTheDocument();
  });

  it('4: «Exportar CSV» descarga con los mismos filtros; «Registrar donación» lleva al formulario', async () => {
    api();
    renderRoute('/admin/donations?method=cash&status=completed&page=2');
    const enlace = await screen.findByRole('link', { name: 'Exportar CSV' });
    expect(enlace).toHaveAttribute('href', '/api/admin/donations/export.csv?status=completed&method=cash');
    expect(screen.getByRole('link', { name: 'Registrar donación' })).toHaveAttribute('href', '/admin/donations/new');
  });

  it('A2: devolver pide confirmación y avisa del resultado', async () => {
    const { pedidas } = api(admin(), {
      '/api/admin/donations/5/refund': () => ({ body: { ...adminDonations[1], status: 'refunded' } }),
    });
    renderRoute('/admin/donations');
    await userEvent.click(await screen.findByRole('button', { name: /^Devolver 100,00\s€ de Pablo García Esteve$/ }));
    const ventana = await screen.findByRole('dialog', { name: '¿Devolver esta donación?' });
    expect(ventana).toHaveTextContent('Se hizo en la web: la devolución se hace por el mismo medio.');
    expect(ventana).toHaveTextContent('Le avisaremos por email y en la web.');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Devolver' }));
    expect(await screen.findByText('Donación devuelta.')).toBeInTheDocument();
    expect(pedidas('/api/admin/donations/5/refund')).toHaveLength(1);
  });

  it('A2: si no dejó email ni tiene cuenta, la ventana avisa de que no le llegará ningún aviso', async () => {
    api();
    renderRoute('/admin/donations');
    await userEvent.click(
      await screen.findByRole('button', { name: /^Devolver 87,40\s€ de Visitantes de la jornada$/ }),
    );
    const ventana = await screen.findByRole('dialog');
    expect(ventana).toHaveTextContent('Se pagó en efectivo o por transferencia');
    expect(ventana).toHaveTextContent('No dejó email ni tiene cuenta: no recibirá ningún aviso de la devolución.');
  });

  it('A2: el error del servidor se muestra', async () => {
    api(admin(), {
      '/api/admin/donations/6/refund': () => errorApi(422, 'DONATION_NOT_REFUNDABLE', 'x'),
    });
    renderRoute('/admin/donations');
    await userEvent.click(
      await screen.findByRole('button', { name: /^Devolver 87,40\s€ de Visitantes de la jornada$/ }),
    );
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Devolver' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se puede devolver una donación cobrada.');
  });

  it('error al cargar: aviso con «Reintentar»', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/donations': errorApi(500, 'INTERNAL_ERROR', 'x'),
    });
    renderRoute('/admin/donations');
    expect(await screen.findByText('No hemos podido cargar las donaciones')).toBeInTheDocument();
  });
});
