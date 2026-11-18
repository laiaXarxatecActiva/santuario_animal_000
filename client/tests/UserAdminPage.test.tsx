import type { AdminUserDetailDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminUserDetail } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';

type Respuesta = { status?: number; body?: unknown };

function api(ficha: AdminUserDetailDto, extra: Record<string, (u: URL, p: Peticion) => Respuesta> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: admin() } },
    [`/api/admin/users/${ficha.id}`]: (_u, p) => (p.method === 'PATCH' ? { body: ficha } : { body: ficha }),
    ...extra,
  });
}

const nuria = (overrides: Partial<AdminUserDetailDto> = {}) =>
  adminUserDetail({
    id: 3,
    firstName: 'Nuria',
    lastName: 'Peris Gil',
    email: 'nuria.peris@santuario.test',
    role: 'caretaker',
    phone: null,
    lastLoginAt: null,
    invitationPending: true,
    adoptions: [],
    ...overrides,
  });

describe('CU-35 Gestionar usuarios: ficha', () => {
  it('3: muestra los datos y las adopciones de un adoptante', async () => {
    api(adminUserDetail());
    renderRoute('/admin/users/6');
    expect(await screen.findByRole('heading', { level: 1, name: 'Lucía Martínez Navarro' })).toBeInTheDocument();
    expect(screen.getByText('lucia.martinez@correo.test')).toBeInTheDocument();
    expect(screen.getByText('612-34-56-78')).toBeInTheDocument();
    const adopciones = screen.getByRole('region', { name: 'Adopciones' });
    expect(within(adopciones).getByText('Rufo')).toBeInTheDocument();
    expect(within(adopciones).getByText('Usual')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Aportaciones' })).toHaveTextContent('Todavía no hay aportaciones');
  });

  it('4a: desactivar a un adoptante avisa de que se darán de baja sus adopciones', async () => {
    const { enviados } = api(adminUserDetail(), {
      '/api/admin/users/6': (_u, p) =>
        p.method === 'PATCH' ? { body: adminUserDetail({ status: 'inactive' }) } : { body: adminUserDetail() },
    });
    renderRoute('/admin/users/6');
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar cuenta' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Desactivar la cuenta de Lucía Martínez Navarro?' });
    expect(ventana).toHaveTextContent('Se cerrarán todas sus sesiones.');
    expect(ventana).toHaveTextContent('Se darán de baja sus adopciones y no se le volverá a cobrar.');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText('Cuenta desactivada')).toBeInTheDocument();
    expect(enviados('/api/admin/users/6').filter((b) => b !== undefined)).toEqual([{ isActive: false }]);
  });

  it('4: reactiva una cuenta inactiva; una anonimizada no tiene la opción', async () => {
    const inactiva = adminUserDetail({ status: 'inactive' });
    const { enviados } = api(inactiva, {
      '/api/admin/users/6': (_u, p) => (p.method === 'PATCH' ? { body: adminUserDetail() } : { body: inactiva }),
    });
    const vista = renderRoute('/admin/users/6');
    await userEvent.click(await screen.findByRole('button', { name: 'Reactivar cuenta' }));
    await waitFor(() =>
      expect(enviados('/api/admin/users/6').filter((b) => b !== undefined)).toEqual([{ isActive: true }]),
    );
    vista.unmount();

    api(adminUserDetail({ status: 'anonymized' }));
    renderRoute('/admin/users/6');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Reactivar cuenta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar cuenta' })).not.toBeInTheDocument();
  });

  it('4b: el administrador no ve «Desactivar» en su propia ficha', async () => {
    api(adminUserDetail({ id: 1, firstName: 'Marta', lastName: 'Soler Vidal', role: 'admin', adoptions: [] }));
    renderRoute('/admin/users/1');
    await screen.findByRole('heading', { level: 1, name: 'Marta Soler Vidal' });
    expect(screen.queryByRole('button', { name: 'Desactivar cuenta' })).not.toBeInTheDocument();
  });

  it('A1: cambia el rol de un trabajador; el error del servidor se muestra', async () => {
    const { enviados } = api(nuria(), {
      '/api/admin/users/3': (_u, p) =>
        p.method === 'PATCH' ? errorApi(422, 'LAST_ACTIVE_ADMIN', 'x') : { body: nuria() },
    });
    renderRoute('/admin/users/3');
    await userEvent.selectOptions(await screen.findByLabelText('Rol'), 'Administrador');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar rol' }));
    await waitFor(() =>
      expect(enviados('/api/admin/users/3').filter((b) => b !== undefined)).toEqual([{ role: 'admin' }]),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Es el último administrador activo: nombra antes a otro administrador.',
    );
  });

  it('A1: un adoptante no tiene la opción de cambiar el rol', async () => {
    api(adminUserDetail());
    renderRoute('/admin/users/6');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Cambiar rol' })).not.toBeInTheDocument();
  });

  it('CU-36 4a: reenvía la invitación a un trabajador que no ha entrado nunca', async () => {
    const { pedidas } = api(nuria(), { '/api/admin/users/3/invitation': () => ({ status: 204 }) });
    renderRoute('/admin/users/3');
    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar invitación' }));
    expect(await screen.findByText('Hemos enviado otra invitación a nuria.peris@santuario.test')).toBeInTheDocument();
    expect(pedidas('/api/admin/users/3/invitation')).toHaveLength(1);
  });

  it('si el usuario no existe, «No encontrado»', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/users/99': errorApi(404, 'NOT_FOUND', 'Este usuario no existe.'),
    });
    renderRoute('/admin/users/99');
    expect(await screen.findByText('Este usuario no existe')).toBeInTheDocument();
  });
});
