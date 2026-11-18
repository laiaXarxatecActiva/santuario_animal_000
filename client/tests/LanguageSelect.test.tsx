import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { card, page, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';

const portada = { featured: [card()], stats: { animalCount: 1 } };

describe('Fase 3 Selector de idioma', () => {
  it('cambia los textos de la web, <html lang> y lo recuerda en el navegador', async () => {
    mockApi({ '/api/home': { body: portada }, '/api/animals': { body: page([card()]) } });
    renderRoute('/');
    const selector = await screen.findByRole('combobox', { name: 'Idioma' });
    expect(selector).toHaveValue('es');
    await userEvent.selectOptions(selector, 'English');
    expect(await screen.findByRole('combobox', { name: 'Language' })).toHaveValue('en');
    expect(screen.getAllByRole('link', { name: 'Animals' }).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');
  });

  it('con sesión, guarda el idioma en el perfil para los emails', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: sessionUser({ preferredLanguage: 'es' }) } },
      '/api/home': { body: portada },
      '/api/me/profile': (_url: URL, p: Peticion) => ({ body: { ...(p.body as object) } }),
    });
    renderRoute('/');
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Idioma' }), 'Valencià');
    await waitFor(() => expect(enviados('/api/me/profile')).toEqual([{ preferredLanguage: 'ca' }]));
    expect(await screen.findByRole('combobox', { name: 'Idioma' })).toHaveValue('ca');
  });

  it('al entrar, la web se pone en el idioma guardado en la cuenta', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser({ preferredLanguage: 'en' }) } },
      '/api/home': { body: portada },
    });
    renderRoute('/');
    expect(await screen.findByRole('combobox', { name: 'Language' })).toHaveValue('en');
  });

  it('las opciones se nombran en su propio idioma', async () => {
    mockApi({ '/api/home': { body: portada } });
    renderRoute('/');
    const selector = await screen.findByRole('combobox', { name: 'Idioma' });
    const opciones = Array.from(selector.querySelectorAll('option')).map((o) => [o.value, o.textContent]);
    expect(opciones).toEqual([
      ['es', 'Castellano'],
      ['ca', 'Valencià'],
      ['en', 'English'],
    ]);
  });
});

describe('Fase 3 Idioma en el registro, el perfil y los errores', () => {
  it('CU-07: el registro envía el idioma de la web', async () => {
    const { enviados } = mockApi({ '/api/auth/register': { status: 202, body: {} } });
    localStorage.setItem('language', 'ca');
    const { default: i18n } = await import('../src/i18n');
    await i18n.changeLanguage('ca');
    renderRoute('/register');
    await userEvent.type(await screen.findByLabelText('Nom'), 'Jordi');
    await userEvent.type(screen.getByLabelText('Cognoms'), 'Mas');
    await userEvent.type(screen.getByLabelText('Correu electrònic'), 'jordi@correo.test');
    await userEvent.type(screen.getByLabelText('Contrasenya', { exact: true }), 'unaClaveLarga1');
    await userEvent.type(screen.getByLabelText('Repeteix la contrasenya'), 'unaClaveLarga1');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Crea el compte' }));
    await waitFor(() => expect(enviados('/api/auth/register')[0]).toMatchObject({ preferredLanguage: 'ca' }));
  });

  it('los errores de validación salen en el idioma de la web', async () => {
    mockApi({});
    const { default: i18n } = await import('../src/i18n');
    await i18n.changeLanguage('en');
    renderRoute('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter your email.')).toBeInTheDocument();
  });

  it('CU-23: el perfil tiene la sección «Idioma» y la guarda', async () => {
    const perfil = {
      firstName: 'Lucía',
      lastName: 'Martínez',
      email: 'lucia@correo.test',
      phone: null,
      role: 'adopter',
      emailNotifications: true,
      emailFrequency: 'per_update',
      showPublicName: false,
      preferredLanguage: 'es',
    };
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: sessionUser({ preferredLanguage: 'es' }) } },
      '/api/me/profile': (_url: URL, p: Peticion) => ({ body: { ...perfil, ...(p.body as object) } }),
    });
    renderRoute('/profile');
    const seccion = (await screen.findByRole('heading', { level: 2, name: 'Idioma' })).closest(
      'section',
    ) as HTMLElement;
    await userEvent.selectOptions(within(seccion).getByLabelText('Idioma de la web y de los emails'), 'English');
    await userEvent.click(within(seccion).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enviados('/api/me/profile')).toContainEqual({ preferredLanguage: 'en' }));
  });
});
