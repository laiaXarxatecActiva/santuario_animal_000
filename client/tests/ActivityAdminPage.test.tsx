import type { ActivityLogDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';
import { elegirOpcion } from './helpers/select';

const entradas: ActivityLogDto[] = [
  {
    id: 2,
    createdAt: '2026-11-08T08:00:00.000Z',
    user: { id: 3, name: 'Nuria Peris Gil' },
    action: 'create',
    tableName: 'animals',
    recordId: 14,
    details: { name: 'Pipa' },
  },
  {
    id: 1,
    createdAt: '2026-11-03T02:00:00.000Z',
    user: null,
    action: 'update',
    tableName: 'adoptions',
    recordId: 7,
    details: { status: ['active', 'paused'], reason: 'payment_failed' },
  },
];

const usuarios = {
  data: [{ id: 3, firstName: 'Nuria', lastName: 'Peris Gil', email: 'n@s.test', role: 'caretaker' }],
  meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
};

function api(user = admin()) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/activity-logs': { body: { data: entradas, meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 } } },
    '/api/admin/users': { body: usuarios },
    '/api/admin/dashboard': {
      body: { animalsByStatus: {}, activeAdoptions: 0, pendingAdoptions: 0, updateAlerts: [] },
    },
  });
}

describe('CU-42 Consultar el registro de actividad', () => {
  it('el enlace «Actividad» del menú solo lo ve el administrador', async () => {
    api();
    const vista = renderRoute('/admin');
    // El apartado «Administración» empieza cerrado en el escritorio.
    await userEvent.click(await screen.findByRole('button', { name: 'Administración' }));
    expect(await screen.findByRole('link', { name: 'Actividad' })).toHaveAttribute('href', '/admin/activity');
    vista.unmount();

    api(caretaker());
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Actividad' })).not.toBeInTheDocument();
  });

  it('2: muestra quién hizo qué, sobre qué registro y cuándo; las tareas aparecen como «Sistema»', async () => {
    api();
    renderRoute('/admin/activity');
    expect(await screen.findByRole('heading', { level: 1, name: 'Registro de actividad' })).toBeInTheDocument();
    const nuria = (await screen.findByText('Nuria Peris Gil', { selector: 'td *, td' })).closest('tr') as HTMLElement;
    expect(within(nuria).getByText('Creación')).toBeInTheDocument();
    expect(within(nuria).getByRole('link', { name: 'Animales #14' })).toHaveAttribute('href', '/admin/animals/14');
    const sistema = screen.getByText('Sistema', { selector: 'td *, td' }).closest('tr') as HTMLElement;
    expect(within(sistema).getByText('Modificación')).toBeInTheDocument();
  });

  it('2: la columna con la tabla afectada se llama «Registro», como su filtro (no «Tabla»)', async () => {
    api();
    renderRoute('/admin/activity');
    await screen.findByText('Nuria Peris Gil', { selector: 'td *, td' });
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Fecha',
      'Usuario',
      'Acción',
      'Registro',
      'Detalles',
    ]);
    expect(screen.queryByRole('columnheader', { name: 'Tabla' })).not.toBeInTheDocument();
  });

  it('3: al abrir una entrada se ven los detalles del cambio', async () => {
    api();
    renderRoute('/admin/activity');
    const fila = (await screen.findByText('Sistema', { selector: 'td *, td' })).closest('tr') as HTMLElement;
    await userEvent.click(within(fila).getByText('Ver detalles'));
    expect(within(fila).getByText('active → paused')).toBeVisible();
    expect(within(fila).getByText('payment_failed')).toBeVisible();
  });

  it('2: filtra por usuario (o «Sistema»), registro, acción y fechas', async () => {
    const { pedidas } = api();
    renderRoute('/admin/activity');
    await screen.findByRole('heading', { level: 1 });
    await elegirOpcion(await screen.findByLabelText('Usuario'), 'Sistema');
    await elegirOpcion(screen.getByLabelText('Registro'), 'Adopciones');
    await elegirOpcion(screen.getByLabelText('Acción'), 'Modificación');
    await userEvent.type(screen.getByLabelText('Desde'), '2026-11-01');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-11-30');
    await waitFor(() => {
      const ultima = pedidas('/api/admin/activity-logs').at(-1);
      expect(ultima?.searchParams.get('userId')).toBe('system');
      expect(ultima?.searchParams.get('tableName')).toBe('adoptions');
      expect(ultima?.searchParams.get('action')).toBe('update');
      expect(ultima?.searchParams.get('from')).toBe('2026-11-01');
      expect(ultima?.searchParams.get('to')).toBe('2026-11-30');
    });
  });
});

describe('CU-42 Actividad en la ficha de un trabajador (SCREENS §5.6)', () => {
  it('muestra su actividad reciente y enlaza al registro filtrado', async () => {
    const { adminUserDetail } = await import('./helpers/fixtures');
    const { pedidas } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/users/3': {
        body: adminUserDetail({ id: 3, firstName: 'Nuria', lastName: 'Peris Gil', role: 'caretaker' }),
      },
      '/api/admin/activity-logs': {
        body: { data: [entradas[0]], meta: { page: 1, pageSize: 10, total: 25, totalPages: 3 } },
      },
    });
    renderRoute('/admin/users/3');
    const seccion = (await screen.findByRole('heading', { level: 2, name: 'Actividad' })).closest(
      'section',
    ) as HTMLElement;
    expect(await within(seccion).findByText('Creación')).toBeInTheDocument();
    expect(within(seccion).getByRole('link', { name: 'Ver toda su actividad' })).toHaveAttribute(
      'href',
      '/admin/activity?userId=3',
    );
    expect(pedidas('/api/admin/activity-logs')[0]?.searchParams.get('userId')).toBe('3');
  });
});
