import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, caretaker, dashboard, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const panel = (user = caretaker()) =>
  mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/dashboard': { body: dashboard() },
    '/api/auth/logout': { status: 204 },
  });

const menuLateral = () => screen.getByRole('navigation', { name: 'Menú del panel' });

describe('AdminLayout (SCREENS §5.1)', () => {
  it('sin sesión, pide iniciar sesión y vuelve al panel', async () => {
    mockApi({});
    const { router } = renderRoute('/admin');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fadmin');
  });

  it('RN-18: un adoptante no tiene acceso', async () => {
    mockApi({ '/api/auth/me': { body: { user: sessionUser() } } });
    renderRoute('/admin');
    expect(await screen.findByText('No tienes acceso a esta página')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Menú del panel' })).not.toBeInTheDocument();
  });

  it('menú lateral con el escritorio activo y el enlace a la web', async () => {
    panel();
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Nuria' });
    expect(within(menuLateral()).getByRole('link', { name: 'Escritorio' })).toHaveAttribute('aria-current', 'page');
    expect(within(menuLateral()).getByRole('link', { name: /Ver la web/ })).toHaveAttribute('href', '/');
  });

  it('la sección «Administración» no aparece para el cuidador', async () => {
    panel();
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Nuria' });
    expect(within(menuLateral()).queryByText('Administración')).not.toBeInTheDocument();
  });

  it('móvil: la hamburguesa abre y cierra el menú', async () => {
    panel(admin());
    renderRoute('/admin');
    const boton = await screen.findByRole('button', { name: 'Abrir el menú' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(boton);
    expect(screen.getByRole('button', { name: 'Cerrar el menú' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('menú de usuario con el perfil y cerrar sesión', async () => {
    panel();
    const { router } = renderRoute('/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Menú de Nuria' }));
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/profile');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
