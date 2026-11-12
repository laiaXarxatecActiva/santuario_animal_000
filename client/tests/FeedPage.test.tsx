import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { activeAdoption, adoption, feedItem, feedPage, sessionUser } from './helpers/fixtures';
import { stubIntersectionObserverVisible } from './helpers/intersection';
import { mockApi, renderRoute, type Peticion } from './helpers/render';

const conSesion = (user = sessionUser()) => ({ body: { user } });

const nueva = feedItem();
const leida = feedItem({
  id: 4,
  title: 'Sombra recibe visita',
  visibility: 'public',
  isRead: true,
  animal: { id: 8, name: 'Sombra', coverPhoto: null },
});

const misAdopciones = [
  activeAdoption(),
  activeAdoption({ id: 2, animal: { id: 8, name: 'Sombra', species: 'Buitre negro', coverPhoto: null } }),
  adoption({ id: 7, status: 'paused', animal: { id: 11, name: 'Lupe', species: 'Alimoche', coverPhoto: null } }),
];

function apiMuro(feed: (url: URL) => ReturnType<typeof feedPage> = () => feedPage([nueva, leida])) {
  const marcas: { id: string; method: string }[] = [];
  const marcar = (url: URL, p: Peticion) => {
    marcas.push({ id: url.pathname.split('/')[4] ?? '', method: p.method });
    return { status: 204 };
  };
  const api = mockApi({
    '/api/auth/me': conSesion(),
    '/api/me/adoptions': { body: { data: misAdopciones } },
    '/api/me/feed': (url) => ({ body: feed(url) }),
    '/api/me/feed/2/read': marcar,
    '/api/me/feed/4/read': marcar,
  });
  return { ...api, marcas };
}

const tarjeta = async (titulo: string) =>
  (await screen.findByRole('heading', { level: 2, name: titulo })).closest('article') as HTMLElement;

describe('CU-17 Consultar el muro de actualizaciones', () => {
  it('sin sesión, pide iniciar sesión', async () => {
    mockApi({});
    const { router } = renderRoute('/feed');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('2: muestra las actualizaciones con su animal y la marca «Nuevo» en las no leídas', async () => {
    const { pedidas } = apiMuro();
    renderRoute('/feed');
    expect(await screen.findByRole('heading', { level: 1, name: 'Novedades' })).toBeInTheDocument();
    const primera = await tarjeta('Revisión del ala: todo en orden');
    expect(within(primera).getByText('Rufo')).toBeInTheDocument();
    expect(within(primera).getByText('Nuevo')).toBeInTheDocument();
    expect(within(primera).getByText('La veterinaria ha confirmado que el ala está bien.')).toBeInTheDocument();
    const segunda = await tarjeta('Sombra recibe visita');
    expect(within(segunda).queryByText('Nuevo')).not.toBeInTheDocument();
    expect(pedidas('/api/me/feed').some((u) => u.searchParams.get('pageSize') === '10')).toBe(true);
  });

  it('3: filtra por «Sin leer» y por animal (solo los de adopción activa)', async () => {
    const { pedidas } = apiMuro();
    renderRoute('/feed');
    await tarjeta('Sombra recibe visita');
    await userEvent.click(screen.getByRole('radio', { name: 'Sin leer' }));
    await waitFor(() =>
      expect(pedidas('/api/me/feed').some((u) => u.searchParams.get('unread') === 'true')).toBe(true),
    );
    const selector = screen.getByRole('combobox', { name: 'Animal' });
    expect(
      within(selector)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos', 'Rufo', 'Sombra']);
    await userEvent.selectOptions(selector, 'Sombra');
    await waitFor(() => expect(pedidas('/api/me/feed').some((u) => u.searchParams.get('animalId') === '8')).toBe(true));
  });

  it('4: al verse en pantalla, las no leídas se marcan como leídas', async () => {
    stubIntersectionObserverVisible();
    const { marcas } = apiMuro();
    renderRoute('/feed');
    await tarjeta('Revisión del ala: todo en orden');
    await waitFor(() => expect(marcas).toEqual([{ id: '2', method: 'PUT' }]));
  });

  it('4: se puede volver a marcar como no leída, y después como leída', async () => {
    const { marcas } = apiMuro();
    renderRoute('/feed');
    const segunda = await tarjeta('Sombra recibe visita');
    await userEvent.click(within(segunda).getByRole('button', { name: 'Marcar como no leída' }));
    await waitFor(() => expect(marcas).toEqual([{ id: '4', method: 'DELETE' }]));
    await userEvent.click(await within(segunda).findByRole('button', { name: 'Marcar como leída' }));
    await waitFor(() => expect(marcas).toContainEqual({ id: '4', method: 'PUT' }));
  });

  it('carga más actualizaciones con el botón «Cargar más»', async () => {
    const { pedidas } = apiMuro((url) =>
      url.searchParams.get('page') === '2'
        ? feedPage([leida], { page: 2, total: 2, totalPages: 2, pageSize: 1 })
        : feedPage([nueva], { total: 2, totalPages: 2, pageSize: 1 }),
    );
    renderRoute('/feed');
    await tarjeta('Revisión del ala: todo en orden');
    expect(screen.queryByRole('heading', { name: 'Sombra recibe visita' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(await tarjeta('Sombra recibe visita')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Revisión del ala: todo en orden' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
    expect(pedidas('/api/me/feed').some((u) => u.searchParams.get('page') === '2')).toBe(true);
  });

  it('2a: sin actualizaciones muestra un mensaje amable', async () => {
    apiMuro(() => feedPage([]));
    renderRoute('/feed');
    expect(await screen.findByText('Aún no hay novedades de tus animales')).toBeInTheDocument();
  });
});
