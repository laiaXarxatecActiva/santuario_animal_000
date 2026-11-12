import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { activeAdoption, adoption, animal, page, sessionUser, update } from './helpers/fixtures';
import { stubIntersectionObserverVisible } from './helpers/intersection';
import { mockApi, renderRoute, type Peticion } from './helpers/render';

const conSesion = (user = sessionUser()) => ({ body: { user } });

const rufoAmpliado = animal({
  exclusiveAccess: true,
  healthSummary: 'Rufo está bien de salud.',
  photos: [
    ...animal().photos,
    {
      id: 17,
      mediaType: 'image',
      url: '/uploads/animals/1/03.jpg',
      thumbnailUrl: null,
      altText: 'Primer plano de Rufo',
      visibility: 'adopters',
    },
  ],
});

const actualizaciones = [
  { ...update, id: 2, title: 'Revisión del ala', visibility: 'adopters' as const, isRead: false },
  { ...update, id: 1, isRead: true },
];

function apiFicha(extra: Parameters<typeof mockApi>[0] = {}) {
  const lecturas: { url: string; method: string }[] = [];
  const api = mockApi({
    '/api/auth/me': conSesion(),
    '/api/animals/1': { body: rufoAmpliado },
    '/api/me/adoptions': { body: { data: [activeAdoption()] } },
    '/api/animals/1/updates': { body: page(actualizaciones) },
    '/api/me/feed/2/read': (url: URL, peticion: Peticion) => {
      lecturas.push({ url: url.pathname, method: peticion.method });
      return { status: 204 };
    },
    ...extra,
  });
  return { ...api, lecturas };
}

describe('CU-16 Consultar la ficha ampliada de un animal adoptado', () => {
  it('sin sesión, pide iniciar sesión y vuelve después', async () => {
    mockApi({});
    const { router } = renderRoute('/my-animals/1');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fmy-animals%2F1');
  });

  it('2: muestra la tarjeta «Tu adopción» en lugar de la de adoptar', async () => {
    apiFicha();
    renderRoute('/my-animals/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Rufo' })).toBeInTheDocument();
    const tuAdopcion = screen.getByRole('heading', { name: 'Tu adopción' }).closest('section') as HTMLElement;
    expect(within(tuAdopcion).getByText('Activa')).toBeInTheDocument();
    expect(within(tuAdopcion).getByText('Plan Usual · 5,00 €/mes')).toBeInTheDocument();
    expect(within(tuAdopcion).getByText('Desde el 5 de septiembre de 2025')).toBeInTheDocument();
    expect(
      within(tuAdopcion).getByText('Próxima noticia prevista: hacia el 24 de noviembre de 2026'),
    ).toBeInTheDocument();
    expect(within(tuAdopcion).getByRole('link', { name: 'Ver mis animales' })).toHaveAttribute('href', '/my-animals');
    expect(screen.queryByRole('link', { name: 'Adoptar a Rufo' })).not.toBeInTheDocument();
  });

  it('2: muestra el resumen de salud y las fotos exclusivas', async () => {
    apiFicha();
    renderRoute('/my-animals/1');
    expect(await screen.findByRole('heading', { name: 'Su salud' })).toBeInTheDocument();
    expect(screen.getByText('Rufo está bien de salud.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver foto 3 de 3 (solo adoptantes)' })).toBeInTheDocument();
  });

  it('2 y 3: muestra todas las noticias, marca las nuevas y las da por leídas al verlas', async () => {
    stubIntersectionObserverVisible();
    const { lecturas, pedidas } = apiFicha();
    renderRoute('/my-animals/1');
    const noticias = (await screen.findByRole('heading', { name: 'Noticias' })).closest('section') as HTMLElement;
    const nueva = (await within(noticias).findByRole('heading', { name: 'Revisión del ala' })).closest(
      'article',
    ) as HTMLElement;
    expect(within(nueva).getByText('Nuevo')).toBeInTheDocument();
    expect(within(nueva).getByText('Solo adoptantes')).toBeInTheDocument();
    const leida = within(noticias).getByRole('heading', { name: 'Rufo estrena posadero' }).closest('article')!;
    expect(within(leida as HTMLElement).queryByText('Nuevo')).not.toBeInTheDocument();
    await waitFor(() => expect(lecturas).toEqual([{ url: '/api/me/feed/2/read', method: 'PUT' }]));
    expect(pedidas('/api/me/feed/1/read')).toHaveLength(0);
  });

  it('1a: con la adopción pendiente explica por qué no ve lo exclusivo y ofrece pagar', async () => {
    apiFicha({
      '/api/animals/1': { body: animal() },
      '/api/me/adoptions': { body: { data: [adoption()] } },
      '/api/animals/1/updates': { body: page([update]) },
    });
    renderRoute('/my-animals/1');
    expect(
      await screen.findByText('Cuando completes el pago, verás aquí las noticias y fotos exclusivas de Rufo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pagar ahora' })).toHaveAttribute('href', '/adopt/1');
    expect(screen.queryByRole('heading', { name: 'Su salud' })).not.toBeInTheDocument();
  });

  it('1a: con la adopción pausada lo explica y ofrece regularizarla', async () => {
    apiFicha({
      '/api/animals/1': { body: animal() },
      '/api/me/adoptions': { body: { data: [adoption({ status: 'paused', startDate: '2025-09-05' })] } },
      '/api/animals/1/updates': { body: page([update]) },
    });
    renderRoute('/my-animals/1');
    expect(await screen.findByText(/Tu adopción de Rufo está pausada/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pagar ahora' })).toHaveAttribute('href', '/adopt/1');
  });

  it('1a: sin adopción activa ve la ficha pública con un aviso', async () => {
    apiFicha({
      '/api/animals/1': { body: animal() },
      '/api/me/adoptions': { body: { data: [] } },
      '/api/animals/1/updates': { body: page([update]) },
    });
    renderRoute('/my-animals/1');
    expect(
      await screen.findByText('No tienes una adopción activa de Rufo. Aquí ves su ficha pública.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver su ficha pública' })).toHaveAttribute('href', '/animals/1');
  });

  it('un animal que ya no está disponible muestra el aviso', async () => {
    apiFicha({
      '/api/animals/1': { status: 404, body: { error: { code: 'ANIMAL_NOT_AVAILABLE', message: 'x', details: [] } } },
    });
    renderRoute('/my-animals/1');
    expect(await screen.findByText('Este animal no está disponible')).toBeInTheDocument();
  });
});
