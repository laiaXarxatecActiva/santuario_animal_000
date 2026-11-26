import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminAdoptions, adminPlans, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';
import { elegirOpcion } from './helpers/select';

const pagina = { data: adminAdoptions, meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 } };

function api(user = admin()) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/adoptions': { body: pagina },
    '/api/admin/plans': { body: { data: adminPlans } },
    '/api/admin/dashboard': {
      body: { animalsByStatus: {}, activeAdoptions: 0, pendingAdoptions: 0, updateAlerts: [] },
    },
  });
}

describe('CU-37 Gestionar adopciones: listado', () => {
  it('el enlace «Adopciones» del menú solo lo ve el administrador', async () => {
    api();
    const vista = renderRoute('/admin');
    // El apartado «Administración» empieza cerrado en el escritorio.
    await userEvent.click(await screen.findByRole('button', { name: 'Administración' }));
    expect(await screen.findByRole('link', { name: 'Adopciones' })).toHaveAttribute('href', '/admin/adoptions');
    vista.unmount();

    api(caretaker());
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Adopciones' })).not.toBeInTheDocument();
  });

  it('2: muestra adoptante, animal, plan, estado, inicio y próximo cobro', async () => {
    api();
    renderRoute('/admin/adoptions');
    expect(await screen.findByRole('heading', { level: 1, name: 'Adopciones' })).toBeInTheDocument();
    expect(await screen.findByText('2 resultados')).toBeInTheDocument();
    const pablo = screen.getByRole('link', { name: 'Pablo García Esteve' });
    expect(pablo).toHaveAttribute('href', '/admin/adoptions/4');
    const fila = pablo.closest('tr') as HTMLElement;
    expect(within(fila).getByText('Rufo')).toBeInTheDocument();
    expect(within(fila).getByText('Simbólica')).toBeInTheDocument();
    expect(within(fila).getByText('Activa')).toBeInTheDocument();
    const irene = screen.getByRole('link', { name: 'Irene Domínguez Prats' }).closest('tr') as HTMLElement;
    expect(within(irene).getByText('Pendiente de pago')).toBeInTheDocument();
    expect(within(irene).getAllByText('—')).toHaveLength(2);
  });

  it('2: busca y filtra por estado y plan', async () => {
    const { pedidas } = api();
    renderRoute('/admin/adoptions');
    await userEvent.type(await screen.findByLabelText('Buscar por adoptante o animal'), 'rufo');
    // Filtra a medida que se escribe: no hay botón «Buscar».
    expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument();
    await elegirOpcion(screen.getByLabelText('Estado'), 'Pausada');
    await elegirOpcion(await screen.findByLabelText('Plan'), 'Usual');
    await waitFor(() => {
      const ultima = pedidas('/api/admin/adoptions').at(-1);
      expect(ultima?.searchParams.get('q')).toBe('rufo');
      expect(ultima?.searchParams.get('status')).toBe('paused');
      expect(ultima?.searchParams.get('planId')).toBe('2');
    });
  });

  it('los filtros por animal o adoptante llegan desde la URL', async () => {
    const { pedidas } = api();
    renderRoute('/admin/adoptions?animalId=1&userId=7');
    await screen.findByText('2 resultados');
    const ultima = pedidas('/api/admin/adoptions').at(-1);
    expect(ultima?.searchParams.get('animalId')).toBe('1');
    expect(ultima?.searchParams.get('userId')).toBe('7');
  });

  it('enlace para crear una adopción a mano', async () => {
    api();
    renderRoute('/admin/adoptions');
    expect(await screen.findByRole('link', { name: 'Nueva adopción' })).toHaveAttribute('href', '/admin/adoptions/new');
  });

  it('error al cargar: aviso con «Reintentar»', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/plans': { body: { data: adminPlans } },
      '/api/admin/adoptions': errorApi(500, 'INTERNAL_ERROR', 'x'),
    });
    renderRoute('/admin/adoptions');
    expect(await screen.findByText('No hemos podido cargar las adopciones')).toBeInTheDocument();
  });
});
