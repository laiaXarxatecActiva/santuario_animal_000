import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PublicHeader } from '../src/components/PublicHeader';
import { sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const pintar = (ruta = '/') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[ruta]}>
        <PublicHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const navegacion = () => screen.getByRole('navigation', { name: 'Navegación principal' });
const textos = (contenedor: HTMLElement) =>
  within(contenedor)
    .getAllByRole('link')
    .map((a) => a.textContent);

describe('PublicHeader', () => {
  it('muestra los enlaces del visitante y marca el activo', async () => {
    mockApi({});
    pintar('/animals');
    expect(textos(navegacion())).toEqual(['Animales', 'Cómo funciona', 'Donar', 'Sobre el santuario']);
    expect(within(navegacion()).getByRole('link', { name: 'Animales' })).toHaveAttribute('aria-current', 'page');
    expect((await screen.findAllByRole('link', { name: 'Entrar' }))[0]).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: 'Registrarse' })[0]).toHaveAttribute('href', '/register');
  });

  it('el menú de hamburguesa se abre y se cierra con Esc', async () => {
    mockApi({});
    pintar();
    const boton = screen.getByRole('button', { name: 'Abrir el menú' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(boton);
    expect(screen.getByRole('button', { name: 'Cerrar el menú' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Abrir el menú' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('el menú se cierra al elegir un enlace', async () => {
    mockApi({});
    pintar();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir el menú' }));
    const menu = document.getElementById(
      screen.getByRole('button', { name: 'Cerrar el menú' }).getAttribute('aria-controls') ?? '',
    );
    await userEvent.click(within(menu!).getByRole('link', { name: 'Animales' }));
    expect(screen.getByRole('button', { name: 'Abrir el menú' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('el botón de tema está siempre visible, fuera del menú', () => {
    mockApi({});
    pintar();
    expect(screen.getByRole('button', { name: 'Activar modo oscuro' })).toBeVisible();
  });

  it('CU-09: el adoptante ve sus enlaces y su menú de usuario', async () => {
    mockApi({ '/api/auth/me': { body: { user: sessionUser() } } });
    pintar();
    const menu = await screen.findByRole('button', { name: 'Menú de Lucía' });
    expect(textos(navegacion())).toEqual(['Animales', 'Mis animales', 'Novedades', 'Donar']);
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();

    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menu);
    const panel = document.getElementById(menu.getAttribute('aria-controls') ?? '')!;
    expect(textos(panel)).toEqual(['Mis aportaciones', 'Mi perfil', 'Cómo funciona']);
    expect(within(panel).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('CU-09: el trabajador ve el enlace al panel', async () => {
    mockApi({ '/api/auth/me': { body: { user: sessionUser({ firstName: 'Marta', role: 'admin' }) } } });
    pintar();
    const menu = await screen.findByRole('button', { name: 'Menú de Marta' });
    expect(textos(navegacion())).toEqual(['Animales', 'Cómo funciona', 'Donar', 'Panel']);
    await userEvent.click(menu);
    expect(textos(document.getElementById(menu.getAttribute('aria-controls') ?? '')!)).toEqual(['Mi perfil']);
  });

  it('CU-11: cerrar sesión destruye la sesión y vuelve al inicio como visitante', async () => {
    let user: ReturnType<typeof sessionUser> | null = sessionUser();
    const { pedidas } = mockApi({
      '/api/auth/me': () => ({ body: { user } }),
      '/api/auth/logout': () => {
        user = null;
        return { status: 204 };
      },
      '/api/home': { body: { shelteredCount: 0, featured: [] } },
      '/api/animals': { body: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } },
      '/api/species': { body: { data: [] } },
    });
    const { router } = renderRoute('/animals');
    await userEvent.click(await screen.findByRole('button', { name: 'Menú de Lucía' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect((await screen.findAllByRole('link', { name: 'Entrar' }))[0]).toBeInTheDocument();
    expect(pedidas('/api/auth/logout')).toHaveLength(1);
  });

  it('CU-17 5: «Novedades» muestra el número de actualizaciones sin leer', async () => {
    const { pedidas } = mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/feed': { body: { data: [], meta: { page: 1, pageSize: 1, total: 4, totalPages: 4, unreadCount: 3 } } },
    });
    pintar();
    const enlace = await within(navegacion()).findByRole('link', { name: 'Novedades, 3 sin leer' });
    expect(enlace).toHaveAttribute('href', '/feed');
    expect(enlace).toHaveTextContent('3');
    expect(pedidas('/api/me/feed')[0]?.searchParams.get('pageSize')).toBe('1');
  });

  it('CU-17 5: sin nada por leer no hay contador, y el trabajador no lo pide', async () => {
    const adoptante = mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/feed': { body: { data: [], meta: { page: 1, pageSize: 1, total: 0, totalPages: 0, unreadCount: 0 } } },
    });
    const { unmount } = pintar();
    await waitFor(() => expect(adoptante.pedidas('/api/me/feed')).toHaveLength(1));
    expect(within(navegacion()).getByRole('link', { name: 'Novedades' })).toBeInTheDocument();
    unmount();

    const trabajador = mockApi({ '/api/auth/me': { body: { user: sessionUser({ role: 'admin' }) } } });
    pintar();
    await screen.findByRole('link', { name: 'Panel' });
    expect(trabajador.pedidas('/api/me/feed')).toHaveLength(0);
  });
});
