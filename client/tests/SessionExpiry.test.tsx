import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sessionUser } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

describe('Sesión caducada (401 en cualquier llamada)', () => {
  it('vacía la sesión y lleva a iniciar sesión, conservando la página', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/adoptions': errorApi(401, 'UNAUTHORIZED', 'Tienes que iniciar sesión.'),
    });
    const { router } = renderRoute('/my-animals?status=active');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/my-animals?status=active')}`);
    expect(
      await screen.findByText('Tu sesión ha caducado. Vuelve a iniciar sesión para continuar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Menú de/ })).not.toBeInTheDocument();
  });

  it('un 401 del login (credenciales incorrectas) no se trata como sesión caducada', async () => {
    mockApi({ '/api/auth/login': errorApi(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos.') });
    const { router } = renderRoute('/login');
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.type(await screen.findByLabelText('Email'), 'a@b.test');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'incorrecta-123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });
});
