import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { caretaker, card, dashboard, leonado, negro, page } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const portada = { featured: [card()], stats: { animalCount: 1 } };

let scrollTo: ReturnType<typeof vi.fn>;
beforeEach(() => {
  scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
});

describe('Al cambiar de página se empieza arriba del todo (DESIGN_SYSTEM §8.7)', () => {
  it('un enlace del pie lleva a la otra página arriba del todo', async () => {
    mockApi({ '/api/home': { body: portada }, '/api/animals': { body: page([card()]) } });
    const { router } = renderRoute('/');
    const pie = await screen.findByRole('contentinfo');
    expect(scrollTo).not.toHaveBeenCalled();
    await userEvent.click(within(pie).getByRole('link', { name: 'Privacidad' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/privacy'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('un enlace del menú del panel también', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } }, '/api/admin/dashboard': { body: dashboard() } });
    const { router } = renderRoute('/admin');
    const menu = await screen.findByRole('navigation', { name: 'Menú del panel' });
    await userEvent.click(within(menu).getByRole('link', { name: 'Mi día' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/my-day'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('cambiar un filtro o el orden del catálogo no sube', async () => {
    mockApi({ '/api/species': { body: { data: [negro, leonado] } }, '/api/animals': { body: page([card()]) } });
    const { router } = renderRoute('/animals');
    await userEvent.click(await screen.findByRole('combobox', { name: 'Ordenar' }));
    await userEvent.click(screen.getByRole('option', { name: 'Menos adoptantes' }));
    await waitFor(() => expect(router.state.location.search).not.toBe(''));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('volver atrás no sube: el navegador devuelve a donde se estaba', async () => {
    mockApi({ '/api/home': { body: portada }, '/api/animals': { body: page([card()]) } });
    const { router } = renderRoute('/');
    await screen.findByRole('contentinfo');
    await router.navigate('/privacy');
    scrollTo.mockClear();
    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('un enlace a una sección de la página (#) no sube', async () => {
    mockApi({ '/api/home': { body: portada }, '/api/animals': { body: page([card()]) } });
    const { router } = renderRoute('/');
    await screen.findByRole('contentinfo');
    await router.navigate('/about#contact');
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
