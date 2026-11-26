import type { AdminUserDetailDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminUserDetail } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';
import { elegirOpcion } from './helpers/select';

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
    await elegirOpcion(await screen.findByLabelText('Rol'), 'Administrador');
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

describe('CU-48 Cerrar todas las sesiones de un usuario', () => {
  it('1-3: pide el motivo, lo envía y dice cuántas sesiones se han cerrado', async () => {
    const { enviados } = api(adminUserDetail(), {
      '/api/admin/users/6/logout-all': () => ({ body: { closedSessions: 2 } }),
    });
    renderRoute('/admin/users/6');
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sus sesiones' }));
    const ventana = await screen.findByRole('dialog', {
      name: '¿Cerrar todas las sesiones de Lucía Martínez Navarro?',
    });
    expect(ventana).toHaveTextContent('La cuenta seguirá activa');

    await userEvent.click(within(ventana).getByRole('button', { name: 'Cerrar sesiones' }));
    expect(within(ventana).getByText('Escribe el motivo.')).toBeInTheDocument();
    expect(enviados('/api/admin/users/6/logout-all')).toHaveLength(0);

    await userEvent.type(within(ventana).getByLabelText(/Motivo/), ' Le han robado el móvil ');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Cerrar sesiones' }));
    expect(await screen.findByText('Se han cerrado 2 sesiones')).toBeInTheDocument();
    expect(enviados('/api/admin/users/6/logout-all')).toEqual([{ reason: 'Le han robado el móvil' }]);
  });

  it('3a: en su propia ficha avisa de que esta sesión seguirá abierta', async () => {
    api(adminUserDetail({ id: 1, firstName: 'Marta', lastName: 'Soler Vidal', role: 'admin', adoptions: [] }));
    renderRoute('/admin/users/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sus sesiones' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('esta seguirá abierta');
  });

  it('una cuenta inactiva o anonimizada no tiene la opción (no puede tener sesiones)', async () => {
    for (const status of ['inactive', 'anonymized'] as const) {
      api(adminUserDetail({ status }));
      const vista = renderRoute('/admin/users/6');
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByRole('button', { name: 'Cerrar sus sesiones' })).not.toBeInTheDocument();
      vista.unmount();
    }
  });
});

describe('CU-51 Enviar a un trabajador el enlace para cambiar su contraseña', () => {
  it('1-4: explica qué pasará, lo envía y lo confirma', async () => {
    const { pedidas } = api(nuria({ lastLoginAt: '2026-11-20T08:00:00.000Z', invitationPending: false }), {
      '/api/admin/users/3/password-reset': () => ({ status: 204 }),
    });
    renderRoute('/admin/users/3');
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar enlace de contraseña' }));
    const ventana = await screen.findByRole('dialog', {
      name: '¿Enviar a Nuria Peris Gil un enlace para cambiar su contraseña?',
    });
    expect(ventana).toHaveTextContent('Nadie más verá la contraseña');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Enviar enlace' }));
    expect(
      await screen.findByText('Hemos enviado a nuria.peris@santuario.test un enlace para cambiar su contraseña.'),
    ).toBeInTheDocument();
    expect(pedidas('/api/admin/users/3/password-reset')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('«Cancelar» cierra la ventana sin enviar nada', async () => {
    const { pedidas } = api(nuria(), { '/api/admin/users/3/password-reset': () => ({ status: 204 }) });
    renderRoute('/admin/users/3');
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar enlace de contraseña' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(pedidas('/api/admin/users/3/password-reset')).toHaveLength(0);
  });

  it('1a: no aparece para adoptantes, cuentas desactivadas ni la propia cuenta', async () => {
    const fichas = [
      adminUserDetail(),
      nuria({ status: 'inactive' }),
      adminUserDetail({ id: 1, firstName: 'Marta', lastName: 'Soler Vidal', role: 'admin', adoptions: [] }),
    ];
    for (const ficha of fichas) {
      api(ficha);
      const vista = renderRoute(`/admin/users/${ficha.id}`);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByRole('button', { name: 'Enviar enlace de contraseña' })).not.toBeInTheDocument();
      vista.unmount();
    }
  });
});

const sinDatos = {
  adoptions: 0,
  payments: 0,
  donations: 0,
  incidents: 0,
  handoverNotes: 0,
  animalUpdates: 0,
  tasks: 0,
  activityLogs: 0,
  total: 0,
};
const listaVacia = { body: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } };

describe('CU-75 Eliminar una cuenta desde el panel', () => {
  it('sin datos enlazados: avisa de que no se puede deshacer, la borra y vuelve al listado', async () => {
    const { fetchMock } = api(nuria(), {
      '/api/admin/users/3': (_u, p) => (p.method === 'DELETE' ? { status: 204 } : { body: nuria() }),
      '/api/admin/users/3/linked-data': () => ({ body: sinDatos }),
      '/api/admin/users': () => listaVacia,
    });
    const { router } = renderRoute('/admin/users/3');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar cuenta' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Eliminar la cuenta de Nuria Peris Gil?' });
    expect(await within(ventana).findByRole('alert')).toHaveTextContent('No se puede deshacer');
    expect(within(ventana).queryByRole('button', { name: 'Borrar de todos modos' })).not.toBeInTheDocument();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Eliminar cuenta' }));
    expect(await screen.findByText('Se ha eliminado la cuenta de Nuria Peris Gil')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/users');
    const borrados = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');
    expect(borrados.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([{}]);
  });

  it('con datos enlazados: los enumera y permite borrar de todos modos, con motivo opcional', async () => {
    const { fetchMock } = api(adminUserDetail(), {
      '/api/admin/users/6': (_u, p) => (p.method === 'DELETE' ? { status: 204 } : { body: adminUserDetail() }),
      '/api/admin/users/6/linked-data': () => ({ body: { ...sinDatos, adoptions: 2, payments: 5, total: 7 } }),
      '/api/admin/users': () => listaVacia,
    });
    renderRoute('/admin/users/6');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar cuenta' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Eliminar la cuenta de Lucía Martínez Navarro?' });
    expect(await within(ventana).findByText('Adopciones: 2')).toBeInTheDocument();
    expect(within(ventana).getByText('Pagos: 5')).toBeInTheDocument();
    expect(within(ventana).queryByText(/Donaciones/)).not.toBeInTheDocument();
    // La advertencia de borrar es roja (aviso de error).
    expect(within(ventana).getByRole('alert')).toHaveTextContent('se borrará también todo lo relacionado');
    expect(within(ventana).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(within(ventana).getByRole('button', { name: 'Borrar datos personales' })).toBeInTheDocument();

    await userEvent.type(within(ventana).getByLabelText(/Motivo/), ' Lo pide por escrito ');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Borrar de todos modos' }));
    expect(await screen.findByText('Se ha eliminado la cuenta de Lucía Martínez Navarro')).toBeInTheDocument();
    const borrados = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');
    expect(borrados.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { force: true, reason: 'Lo pide por escrito' },
    ]);
  });

  it('con datos enlazados: «Borrar datos personales» la anonimiza en lugar de borrarla', async () => {
    const { enviados, fetchMock } = api(adminUserDetail(), {
      '/api/admin/users/6/linked-data': () => ({ body: { ...sinDatos, donations: 1, total: 1 } }),
      '/api/admin/users/6/anonymize': () => ({ body: adminUserDetail({ status: 'anonymized' }) }),
    });
    renderRoute('/admin/users/6');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar cuenta' }));
    const ventana = await screen.findByRole('dialog');
    await userEvent.click(await within(ventana).findByRole('button', { name: 'Borrar datos personales' }));
    expect(await screen.findByText('Se han borrado sus datos personales')).toBeInTheDocument();
    expect(enviados('/api/admin/users/6/anonymize')).toEqual([{}]);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  it('«Cancelar» no borra nada; en su propia ficha el administrador no tiene la opción', async () => {
    const { fetchMock } = api(nuria(), { '/api/admin/users/3/linked-data': () => ({ body: sinDatos }) });
    const vista = renderRoute('/admin/users/3');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar cuenta' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    vista.unmount();

    api(adminUserDetail({ id: 1, firstName: 'Marta', lastName: 'Soler Vidal', role: 'admin', adoptions: [] }));
    renderRoute('/admin/users/1');
    await screen.findByRole('heading', { level: 1, name: 'Marta Soler Vidal' });
    expect(screen.queryByRole('button', { name: 'Eliminar cuenta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar datos personales' })).not.toBeInTheDocument();
  });
});

describe('CU-76 Anonimizar una cuenta desde el panel', () => {
  it('explica qué pasará, envía el motivo opcional y avisa', async () => {
    const { enviados } = api(nuria(), {
      '/api/admin/users/3/anonymize': () => ({ body: nuria({ status: 'anonymized' }) }),
    });
    renderRoute('/admin/users/3');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar datos personales' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Borrar los datos personales de Nuria Peris Gil?' });
    // La advertencia es amarilla (aviso de tipo warning, que se anuncia como «status»).
    expect(within(ventana).getByRole('status')).toHaveTextContent('Se borrarán sus datos personales');
    await userEvent.type(within(ventana).getByLabelText(/Motivo/), 'Ya no trabaja aquí');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Borrar datos personales' }));
    expect(await screen.findByText('Se han borrado sus datos personales')).toBeInTheDocument();
    expect(enviados('/api/admin/users/3/anonymize')).toEqual([{ reason: 'Ya no trabaja aquí' }]);
  });

  it('una cuenta ya sin datos personales no tiene «Borrar datos personales», pero sí «Eliminar cuenta»', async () => {
    api(adminUserDetail({ status: 'anonymized' }));
    renderRoute('/admin/users/6');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Borrar datos personales' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar cuenta' })).toBeInTheDocument();
  });
});
