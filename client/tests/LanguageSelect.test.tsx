import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { card, caretaker, dashboard, page, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';
import { elegirOpcion } from './helpers/select';

const portada = { featured: [card()], stats: { animalCount: 1 } };

/** Abre el menú de idioma de la cabecera y elige uno por su nombre. */
async function elegirIdioma(etiqueta: RegExp, idioma: string) {
  await userEvent.click(await screen.findByRole('button', { name: etiqueta }));
  await userEvent.click(screen.getByRole('menuitemradio', { name: idioma }));
}

describe('Fase 3 Selector de idioma', () => {
  it('cambia los textos de la web, <html lang> y lo recuerda en el navegador', async () => {
    mockApi({ '/api/home': { body: portada }, '/api/animals': { body: page([card()]) } });
    renderRoute('/');
    expect(await screen.findByRole('button', { name: 'Idioma Castellano' })).toBeInTheDocument();
    await elegirIdioma(/^Idioma/, 'English');
    expect(await screen.findByRole('button', { name: 'Language English' })).toBeInTheDocument();
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
    await elegirIdioma(/^Idioma/, 'Valencià');
    await waitFor(() => expect(enviados('/api/me/profile')).toEqual([{ preferredLanguage: 'ca' }]));
    expect(await screen.findByRole('button', { name: 'Idioma Valencià' })).toBeInTheDocument();
  });

  it('al entrar, la web se pone en el idioma guardado en la cuenta', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser({ preferredLanguage: 'en' }) } },
      '/api/home': { body: portada },
    });
    renderRoute('/');
    expect(await screen.findByRole('button', { name: 'Language English' })).toBeInTheDocument();
  });

  it('las opciones se nombran en su propio idioma', async () => {
    mockApi({ '/api/home': { body: portada } });
    renderRoute('/');
    await userEvent.click(await screen.findByRole('button', { name: /^Idioma/ }));
    const opciones = screen
      .getAllByRole('menuitemradio')
      .map((o) => [o.getAttribute('lang'), o.textContent, o.getAttribute('aria-checked')]);
    expect(opciones).toEqual([
      ['es', 'Castellano', 'true'],
      ['ca', 'Valencià', 'false'],
      ['en', 'English', 'false'],
    ]);
  });

  it('se abre como el menú de usuario y se cierra con Esc (el foco vuelve al botón) o al pulsar fuera', async () => {
    mockApi({ '/api/home': { body: portada }, '/api/animals': { body: page([card()]) } });
    renderRoute('/');
    const boton = await screen.findByRole('button', { name: /^Idioma/ });
    expect(boton).toHaveAttribute('aria-haspopup', 'menu');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton.querySelector('svg[data-icon="chevron-down"]')).not.toBeNull();
    await userEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Idioma' });
    expect(menu).toHaveClass('dropdown-panel');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
    await userEvent.click(boton);
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
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
    await elegirOpcion(within(seccion).getByLabelText('Idioma de la web y de los emails'), 'English');
    await userEvent.click(within(seccion).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enviados('/api/me/profile')).toContainEqual({ preferredLanguage: 'en' }));
  });

  // El botón muestra solo el icono y la flecha en todas las cabeceras; el nombre
  // del idioma sigue en su nombre accesible («Idioma Castellano»).
  const soloIcono = (boton: HTMLElement) => {
    expect(within(boton).getByText('Castellano')).toHaveClass('visually-hidden');
    expect(boton.querySelector('svg[data-icon="language"]')).not.toBeNull();
    expect(boton.querySelector('svg[data-icon="chevron-down"]')).not.toBeNull();
  };

  it('sin sesión, el botón de idioma muestra solo el icono', async () => {
    mockApi({ '/api/home': { body: portada } });
    renderRoute('/');
    soloIcono(await screen.findByRole('button', { name: 'Idioma Castellano' }));
  });

  it('en la cabecera del adoptante, solo el icono', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser({ preferredLanguage: 'es' }) } },
      '/api/home': { body: portada },
    });
    renderRoute('/');
    await screen.findByRole('button', { name: 'Menú de Lucía' });
    soloIcono(screen.getByRole('button', { name: 'Idioma Castellano' }));
  });

  it('un trabajador, en la web y en el panel, también ve solo el icono', async () => {
    mockApi({
      '/api/auth/me': { body: { user: caretaker({ preferredLanguage: 'es' }) } },
      '/api/home': { body: portada },
      '/api/admin/dashboard': { body: dashboard() },
    });
    const { router } = renderRoute('/');
    await screen.findByRole('button', { name: /^Menú de/ });
    soloIcono(screen.getByRole('button', { name: 'Idioma Castellano' }));

    await router.navigate('/admin');
    await screen.findByRole('navigation', { name: 'Menú del panel' });
    soloIcono(screen.getByRole('button', { name: 'Idioma Castellano' }));
  });

  it('la flecha apunta hacia arriba mientras el panel está abierto y vuelve abajo al cerrarlo', async () => {
    mockApi({ '/api/home': { body: portada } });
    renderRoute('/');
    const boton = await screen.findByRole('button', { name: /^Idioma/ });
    await userEvent.click(boton);
    expect(boton.querySelector('svg[data-icon="chevron-up"]')).not.toBeNull();
    expect(boton.querySelector('svg[data-icon="chevron-down"]')).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(boton.querySelector('svg[data-icon="chevron-down"]')).not.toBeNull();
  });
});
