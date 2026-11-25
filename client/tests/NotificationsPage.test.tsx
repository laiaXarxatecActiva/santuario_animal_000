import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sessionUser } from './helpers/fixtures';
import { notification, notificationsPage } from './helpers/notifications';
import { mockApi, renderRoute, type Peticion } from './helpers/render';

const sinLeer = notification();
const leida = notification({ id: 1, type: 'donation_thanks', message: 'Gracias por tu donación.', isRead: true });

function api(lista = notificationsPage([sinLeer, leida])) {
  const peticiones: { ruta: string; method: string }[] = [];
  const registrar = (url: URL, p: Peticion) => {
    peticiones.push({ ruta: url.pathname, method: p.method });
    return { status: 204 };
  };
  const mocks = mockApi({
    '/api/auth/me': { body: { user: sessionUser() } },
    '/api/me/notifications': { body: lista },
    '/api/me/notifications/read-all': registrar,
    '/api/me/notifications/1': registrar,
  });
  return { ...mocks, peticiones };
}

describe('CU-18 Página de notificaciones', () => {
  it('sin sesión lleva a iniciar sesión', async () => {
    mockApi({});
    const { router } = renderRoute('/notifications');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('4: lista todas, con la no leída marcada y paginación de 20', async () => {
    const { pedidas } = api();
    renderRoute('/notifications');
    expect(await screen.findByRole('heading', { level: 1, name: 'Notificaciones' })).toBeInTheDocument();
    const lista = await screen.findByRole('list', { name: 'Notificaciones' });
    const items = within(lista).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText('Sin leer')).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).queryByText('Sin leer')).not.toBeInTheDocument();
    // La cabecera pide las 10 de la campana; la página, 20.
    expect(pedidas('/api/me/notifications').map((u) => u.searchParams.get('pageSize'))).toContain('20');
  });

  it('4: marca todas como leídas', async () => {
    const { peticiones } = api();
    renderRoute('/notifications');
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar todas como leídas' }));
    await waitFor(() => expect(peticiones).toContainEqual({ ruta: '/api/me/notifications/read-all', method: 'POST' }));
  });

  it('«Marcar todas» no aparece si no hay ninguna sin leer', async () => {
    api(notificationsPage([leida]));
    renderRoute('/notifications');
    expect(await screen.findByText('Gracias por tu donación.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar todas como leídas' })).not.toBeInTheDocument();
  });

  it('4: borra una notificación', async () => {
    const { peticiones } = api();
    renderRoute('/notifications');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar: Gracias por tu donación.' }));
    await waitFor(() => expect(peticiones).toContainEqual({ ruta: '/api/me/notifications/1', method: 'DELETE' }));
  });

  it('2a: sin notificaciones lo indica', async () => {
    api(notificationsPage([]));
    renderRoute('/notifications');
    expect(await screen.findByText('No tienes notificaciones')).toBeInTheDocument();
  });

  describe('4: limpiar notificaciones', () => {
    function apiConLimpiar(lista = notificationsPage([sinLeer, leida])) {
      const metodos: string[] = [];
      const mocks = mockApi({
        '/api/auth/me': { body: { user: sessionUser() } },
        '/api/me/notifications': (_url: URL, p: Peticion) => {
          metodos.push(p.method);
          return p.method === 'DELETE' ? { status: 204 } : { body: lista };
        },
      });
      return { ...mocks, borrados: () => metodos.filter((m) => m === 'DELETE') };
    }

    it('pide confirmación y borra todas', async () => {
      const { borrados } = apiConLimpiar();
      renderRoute('/notifications');
      await userEvent.click(await screen.findByRole('button', { name: 'Limpiar notificaciones' }));
      const dialogo = await screen.findByRole('dialog', { name: '¿Borrar todas tus notificaciones?' });
      expect(borrados()).toEqual([]);
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Borrar todas' }));
      await waitFor(() => expect(borrados()).toEqual(['DELETE']));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('al cancelar no borra nada', async () => {
      const { borrados } = apiConLimpiar();
      renderRoute('/notifications');
      await userEvent.click(await screen.findByRole('button', { name: 'Limpiar notificaciones' }));
      const dialogo = await screen.findByRole('dialog', { name: '¿Borrar todas tus notificaciones?' });
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(borrados()).toEqual([]);
    });

    it('no aparece si no hay notificaciones', async () => {
      apiConLimpiar(notificationsPage([]));
      renderRoute('/notifications');
      expect(await screen.findByText('No tienes notificaciones')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Limpiar notificaciones' })).not.toBeInTheDocument();
    });
  });
});
