import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminUsers, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

const pagina = { data: adminUsers, meta: { page: 1, pageSize: 20, total: 3, totalPages: 1 } };

function api(user = admin()) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/users': { body: pagina },
    '/api/admin/dashboard': {
      body: { animalsByStatus: {}, activeAdoptions: 0, pendingAdoptions: 0, updateAlerts: [] },
    },
  });
}

describe('CU-35 Gestionar usuarios: listado', () => {
  it('el enlace «Usuarios» del menú solo lo ve el administrador', async () => {
    api();
    const vistaAdmin = renderRoute('/admin');
    // El apartado «Administración» empieza cerrado en el escritorio.
    await userEvent.click(await screen.findByRole('button', { name: 'Administración' }));
    expect(await screen.findByRole('link', { name: 'Usuarios' })).toHaveAttribute('href', '/admin/users');
    vistaAdmin.unmount();

    api(caretaker());
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
  });

  it('2: muestra nombre, email, rol, estado, alta y último acceso', async () => {
    api();
    renderRoute('/admin/users');
    expect(await screen.findByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument();
    expect(await screen.findByText('3 resultados')).toBeInTheDocument();
    const lucia = (await screen.findByRole('link', { name: 'Lucía Martínez Navarro' })).closest('tr') as HTMLElement;
    expect(screen.getByRole('link', { name: 'Lucía Martínez Navarro' })).toHaveAttribute('href', '/admin/users/6');
    expect(within(lucia).getByText('lucia.martinez@correo.test')).toBeInTheDocument();
    expect(within(lucia).getByText('Adoptante')).toBeInTheDocument();
    expect(within(lucia).getByText('Activa')).toBeInTheDocument();

    const nuria = screen.getByRole('link', { name: 'Nuria Peris Gil' }).closest('tr') as HTMLElement;
    expect(within(nuria).getByText('Cuidador')).toBeInTheDocument();
    expect(within(nuria).getByText('Nunca')).toBeInTheDocument();
    const teresa = screen.getByRole('link', { name: 'Teresa Vicent Molina' }).closest('tr') as HTMLElement;
    expect(within(teresa).getByText('Inactiva')).toBeInTheDocument();
  });

  it('2: busca y filtra por rol y estado', async () => {
    const { pedidas } = api();
    renderRoute('/admin/users');
    await userEvent.type(await screen.findByLabelText('Buscar por nombre o email'), 'lucia');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'Administrador');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Inactiva');
    await waitFor(() => {
      const ultima = pedidas('/api/admin/users').at(-1);
      expect(ultima?.searchParams.get('q')).toBe('lucia');
      expect(ultima?.searchParams.get('role')).toBe('admin');
      expect(ultima?.searchParams.get('status')).toBe('inactive');
    });
  });

  it('enlace para crear un trabajador', async () => {
    api();
    renderRoute('/admin/users');
    expect(await screen.findByRole('link', { name: 'Nuevo trabajador' })).toHaveAttribute('href', '/admin/users/new');
  });

  it('error al cargar: aviso con «Reintentar»', async () => {
    mockApi({ '/api/auth/me': { body: { user: admin() } }, '/api/admin/users': errorApi(500, 'INTERNAL_ERROR', 'x') });
    renderRoute('/admin/users');
    expect(await screen.findByText('No hemos podido cargar los usuarios')).toBeInTheDocument();
  });
});
