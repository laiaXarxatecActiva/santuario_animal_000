import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker, sessionUser } from './helpers/fixtures';
import { notification, notificationsPage } from './helpers/notifications';
import { mockApi, renderRoute, type Peticion } from './helpers/render';

const sinLeer = notification();
const leida = notification({
  id: 1,
  type: 'donation_thanks',
  message: 'Gracias por tu donación de 10,00 €.',
  link: '/my-contributions',
  isRead: true,
});

function api(user = sessionUser(), lista = notificationsPage([sinLeer, leida])) {
  const cambios: { id: string; body: unknown }[] = [];
  const mocks = mockApi({
    '/api/auth/me': { body: { user } },
    '/api/home': { body: { featured: [], animalCount: 0 } },
    '/api/me/notifications': { body: lista },
    '/api/me/notifications/2': (url: URL, p: Peticion) => {
      cambios.push({ id: url.pathname.split('/')[4] ?? '', body: p.body });
      return { body: { ...sinLeer, isRead: true } };
    },
  });
  return { ...mocks, cambios };
}

const campana = (nombre: RegExp | string) => screen.findByRole('button', { name: nombre });

describe('CU-18 Campana de notificaciones', () => {
  it('1: sin sesión no hay campana', async () => {
    mockApi({ '/api/home': { body: { featured: [], animalCount: 0 } } });
    renderRoute('/');
    expect((await screen.findAllByRole('link', { name: 'Entrar' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Notificaciones/ })).not.toBeInTheDocument();
  });

  it('1: muestra el número de no leídas en la etiqueta y en el contador', async () => {
    const { pedidas } = api();
    renderRoute('/');
    const boton = await campana('Notificaciones, 1 sin leer');
    expect(within(boton).getByText('1')).toBeInTheDocument();
    expect(pedidas('/api/me/notifications')[0]?.searchParams.get('pageSize')).toBe('10');
  });

  it('el contador no pasa de «9+»', async () => {
    api(sessionUser(), notificationsPage([sinLeer], { unreadCount: 12 }));
    renderRoute('/');
    expect(within(await campana('Notificaciones, 12 sin leer')).getByText('9+')).toBeInTheDocument();
  });

  it('2-3: al abrirla lista las últimas; al pulsar una sin leer la marca y navega a su enlace', async () => {
    const { cambios } = api();
    const { router } = renderRoute('/');
    await userEvent.click(await campana('Notificaciones, 1 sin leer'));
    const panel = screen.getByRole('region', { name: 'Notificaciones' });
    expect(within(panel).getByText('Gracias por tu donación de 10,00 €.')).toBeInTheDocument();
    expect(within(panel).getAllByText('hace 2 días')).toHaveLength(2);
    expect(within(panel).getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/notifications');

    await userEvent.click(within(panel).getByRole('link', { name: /Carbón respira mejor/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/my-animals/10'));
    expect(cambios).toEqual([{ id: '2', body: { isRead: true } }]);
  });

  it('pulsar una ya leída no la vuelve a marcar', async () => {
    const { cambios } = api();
    const { router } = renderRoute('/');
    await userEvent.click(await campana('Notificaciones, 1 sin leer'));
    await userEvent.click(screen.getByRole('link', { name: /Gracias por tu donación/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/my-contributions'));
    expect(cambios).toEqual([]);
  });

  it('2a: sin notificaciones lo indica', async () => {
    api(sessionUser(), notificationsPage([]));
    renderRoute('/');
    await userEvent.click(await campana('Notificaciones'));
    expect(screen.getByText('No tienes notificaciones')).toBeInTheDocument();
  });

  it('los trabajadores la ven también en el panel', async () => {
    mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/dashboard': { status: 500, body: null },
      '/api/me/notifications': {
        body: notificationsPage([
          notification({ type: 'update_reminder', message: 'Turia lleva más de 14 días sin actualización.' }),
        ]),
      },
    });
    renderRoute('/admin');
    await userEvent.click(await campana('Notificaciones, 1 sin leer'));
    expect(screen.getByText('Turia lleva más de 14 días sin actualización.')).toBeInTheDocument();
  });

  it('4: borra una notificación desde el desplegable sin cerrarlo ni navegar', async () => {
    const borradas: string[] = [];
    mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/home': { body: { featured: [], animalCount: 0 } },
      '/api/me/notifications': { body: notificationsPage([sinLeer, leida]) },
      '/api/me/notifications/1': (url: URL, p: Peticion) => {
        borradas.push(`${p.method} ${url.pathname}`);
        return { status: 204 };
      },
    });
    const { router } = renderRoute('/');
    await userEvent.click(await campana('Notificaciones, 1 sin leer'));
    const panel = screen.getByRole('region', { name: 'Notificaciones' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Borrar: Gracias por tu donación de 10,00 €.' }));
    await waitFor(() => expect(borradas).toEqual(['DELETE /api/me/notifications/1']));
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toBeVisible();
  });
});

describe('Animación de los desplegables (DESIGN_SYSTEM §9)', () => {
  it('el panel de la campana lleva la animación', async () => {
    api();
    renderRoute('/');
    await userEvent.click(await campana('Notificaciones, 1 sin leer'));
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveClass('dropdown-panel');
  });
});
