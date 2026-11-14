import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker, dashboard } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

// RGPD (TECH_SPEC §13): aviso informativo de cookies técnicas (SCREENS §2.4).
const aviso = () => screen.queryByRole('region', { name: 'Aviso de cookies' });

describe('Aviso de cookies', () => {
  it('aparece la primera vez en la web pública y enlaza a la página de cookies', async () => {
    mockApi({});
    renderRoute('/how-it-works');
    expect(await screen.findByRole('region', { name: 'Aviso de cookies' })).toHaveTextContent(
      'Solo usamos cookies técnicas para mantener tu sesión.',
    );
    expect(screen.getByRole('link', { name: 'Más información' })).toHaveAttribute('href', '/cookies');
  });

  it('«Entendido» lo cierra y no vuelve a salir en la siguiente visita', async () => {
    mockApi({});
    const { unmount } = renderRoute('/how-it-works');
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));
    expect(aviso()).not.toBeInTheDocument();
    expect(localStorage.getItem('cookie-notice')).toBe('accepted');

    unmount();
    renderRoute('/how-it-works');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(aviso()).not.toBeInTheDocument();
  });

  it('no aparece en el panel de gestión', async () => {
    mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/dashboard': { body: dashboard() },
    });
    renderRoute('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Nuria' })).toBeInTheDocument();
    expect(aviso()).not.toBeInTheDocument();
  });
});
