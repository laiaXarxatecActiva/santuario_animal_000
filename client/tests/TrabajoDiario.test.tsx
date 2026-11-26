import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminAnimal, adminSpecies, adminUserDetail, caretaker, dashboard } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';
import { cualificaciones, zonas } from './helpers/work-fixtures';
import { CARETAKER_HOME, homeFor } from '../src/utils/redirect';
import { elegirOpcion, opcionesDe } from './helpers/select';

const menuLateral = () => screen.getByRole('navigation', { name: 'Menú del panel' });

describe('Trabajo diario: menú del panel y destino al entrar', () => {
  it('el cuidador ve «Mi día», pero no la gestión de tareas, plantillas ni zonas', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } }, '/api/admin/dashboard': { body: dashboard() } });
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Nuria' });
    const menu = within(menuLateral());
    expect(menu.getByText('Trabajo diario')).toBeInTheDocument();
    expect(menu.getByRole('link', { name: 'Mi día' })).toHaveAttribute('href', '/admin/my-day');
    expect(menu.queryByRole('link', { name: 'Tareas del día' })).not.toBeInTheDocument();
    expect(menu.queryByRole('link', { name: 'Plantillas de tareas' })).not.toBeInTheDocument();
    expect(menu.queryByRole('link', { name: 'Zonas y cualificaciones' })).not.toBeInTheDocument();
  });

  it('el administrador ve también la gestión', async () => {
    mockApi({ '/api/auth/me': { body: { user: admin() } }, '/api/admin/dashboard': { body: dashboard() } });
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Marta' });
    const menu = within(menuLateral());
    expect(menu.getByRole('link', { name: 'Tareas del día' })).toHaveAttribute('href', '/admin/tasks');
    expect(menu.getByRole('link', { name: 'Plantillas de tareas' })).toHaveAttribute('href', '/admin/task-templates');
    expect(menu.getByRole('link', { name: 'Zonas y cualificaciones' })).toHaveAttribute('href', '/admin/zones');
  });

  it('CU-56: el cuidador empieza en «Mi día»; el administrador, en el escritorio', () => {
    expect(CARETAKER_HOME).toBe('/admin/my-day');
    expect(homeFor(caretaker(), undefined)).toBe('/admin/my-day');
    expect(homeFor(admin(), '/animals/3')).toBe('/admin');
  });
});

describe('CU-52 La zona del animal', () => {
  it('se elige en el formulario del animal entre las zonas activas', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/species': { body: { data: adminSpecies } },
      '/api/admin/zones': { body: { data: zonas } },
      '/api/admin/animals/1': (_u, p) => ({ body: adminAnimal({ zone: p.method === 'PUT' ? zonas[2]! : null }) }),
    });
    renderRoute('/admin/animals/1');
    const zona = await screen.findByLabelText('Zona (opcional)');
    await waitFor(() => expect(opcionesDe(zona)).toContain('Gran voladero'));
    expect(opcionesDe(zona)).not.toContain('Voladero viejo');
    await elegirOpcion(zona, 'Gran voladero');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(enviados('/api/admin/animals/1').filter(Boolean)[0]).toMatchObject({ zoneId: 1 }));
  });
});

describe('CU-53 Cualificaciones de un trabajador', () => {
  it('se marcan en su ficha y se guardan', async () => {
    const ficha = adminUserDetail({
      id: 3,
      firstName: 'Nuria',
      lastName: 'Peris Gil',
      email: 'nuria.peris@santuario.test',
      role: 'caretaker',
      adoptions: [],
    });
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/users/3': { body: ficha },
      '/api/admin/qualifications': { body: { data: cualificaciones } },
      '/api/admin/users/3/qualifications': (_u, p) => ({
        body: {
          userId: 3,
          qualifications:
            p.method === 'PUT'
              ? [
                  { id: 2, name: 'Manejo de grandes rapaces' },
                  { id: 4, name: 'Primeros auxilios' },
                ]
              : [{ id: 2, name: 'Manejo de grandes rapaces' }],
        },
      }),
      '/api/admin/activity-logs': { body: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } } },
    });
    renderRoute('/admin/users/3');
    const seccion = await screen.findByRole('region', { name: 'Cualificaciones' });
    await waitFor(() =>
      expect(within(seccion).getByRole('checkbox', { name: 'Manejo de grandes rapaces' })).toBeChecked(),
    );
    expect(within(seccion).getByRole('checkbox', { name: 'Administrar medicación' })).not.toBeChecked();
    await userEvent.click(within(seccion).getByRole('checkbox', { name: 'Primeros auxilios' }));
    await userEvent.click(within(seccion).getByRole('button', { name: 'Guardar cualificaciones' }));
    expect(await screen.findByText('Cualificaciones guardadas')).toBeInTheDocument();
    expect(enviados('/api/admin/users/3/qualifications').filter(Boolean)).toEqual([{ qualificationIds: [2, 4] }]);
  });

  it('un adoptante no tiene cualificaciones', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/users/6': { body: adminUserDetail() },
    });
    renderRoute('/admin/users/6');
    await screen.findByRole('heading', { level: 1, name: 'Lucía Martínez Navarro' });
    expect(screen.queryByRole('region', { name: 'Cualificaciones' })).not.toBeInTheDocument();
  });
});
