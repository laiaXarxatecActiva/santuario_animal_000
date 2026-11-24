import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, caretaker, dashboard, page } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';
import { calendarioSemana } from './helpers/work-fixtures';

const AYUDA_TURNOS = /quién trabaja cada día de la semana/;

describe('Explicación de cada página del panel', () => {
  it('se muestra bajo el título, se oculta con «Entendido» y se recuerda', async () => {
    mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/shifts': { body: calendarioSemana() },
    });
    const { unmount } = renderRoute('/admin/shifts');
    expect(await screen.findByText(AYUDA_TURNOS)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText(AYUDA_TURNOS)).not.toBeInTheDocument();
    unmount();

    renderRoute('/admin/shifts');
    await screen.findByRole('heading', { level: 1, name: 'Turnos' });
    expect(screen.queryByText(AYUDA_TURNOS)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '¿Para qué sirve esta página?' }));
    expect(screen.getByText(AYUDA_TURNOS)).toBeInTheDocument();
  });

  it('ocultarla en una página no la oculta en las demás', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/dashboard': { body: dashboard() },
      '/api/admin/incidents': { body: page([]) },
    });
    const { unmount } = renderRoute('/admin');
    expect(await screen.findByText(/resumen de cómo está el santuario/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    unmount();

    renderRoute('/admin/incidents');
    expect(await screen.findByText(/problemas del santuario/)).toBeInTheDocument();
  });
});
