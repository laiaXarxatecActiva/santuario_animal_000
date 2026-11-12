import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sessionUser } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';
import { ADOPTER_HOME, WORKER_HOME } from '../src/utils/redirect';

async function entrar(email = 'lucia.martinez@correo.test', password = 'Lucia.buitres1') {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Contraseña'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('CU-09 Iniciar sesión', () => {
  it('muestra el formulario con los enlaces de recuperar y registrarse', async () => {
    mockApi({});
    renderRoute('/login?next=/animals/3');
    expect(await screen.findByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '¿Has olvidado tu contraseña?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Regístrate' })).toHaveAttribute('href', '/register?next=%2Fanimals%2F3');
  });

  it('envía las credenciales y lleva al adoptante a la página de origen', async () => {
    const { enviados } = mockApi({ '/api/auth/login': { body: { user: sessionUser() } } });
    const { router } = renderRoute('/login?next=/animals/3');
    await entrar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/animals/3'));
    expect(enviados('/api/auth/login')).toEqual([{ email: 'lucia.martinez@correo.test', password: 'Lucia.buitres1' }]);
  });

  it('sin página de origen, el adoptante va a su inicio y el trabajador al suyo', async () => {
    mockApi({ '/api/auth/login': { body: { user: sessionUser() } } });
    const adoptante = renderRoute('/login');
    await entrar();
    await waitFor(() => expect(adoptante.router.state.location.pathname).toBe(ADOPTER_HOME));
    adoptante.unmount();

    mockApi({ '/api/auth/login': { body: { user: sessionUser({ role: 'admin' }) } } });
    const trabajador = renderRoute('/login?next=/animals/3');
    await entrar('marta.soler@santuario.test', 'MartaSoler26#!');
    await waitFor(() => expect(trabajador.router.state.location.pathname).toBe(WORKER_HOME));
  });

  it('valida los campos antes de enviar', async () => {
    const { pedidas } = mockApi({});
    renderRoute('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Introduce tu email.')).toBeInTheDocument();
    expect(screen.getByText('Introduce tu contraseña.')).toBeInTheDocument();
    expect(pedidas('/api/auth/login')).toHaveLength(0);
  });

  it.each([
    ['3a', errorApi(401, 'INVALID_CREDENTIALS', 'x'), 'Email o contraseña incorrectos.'],
    ['3b', errorApi(403, 'ACCOUNT_INACTIVE', 'x'), 'Esta cuenta no está activa. Contacta con el santuario.'],
    ['3c', errorApi(429, 'TOO_MANY_REQUESTS', 'x'), 'Demasiados intentos; espera unos minutos.'],
    ['error del servidor', errorApi(500, 'INTERNAL_ERROR', 'x'), 'Algo ha ido mal; inténtalo de nuevo.'],
  ])('%s: muestra el aviso de error', async (_caso, respuesta, mensaje) => {
    mockApi({ '/api/auth/login': respuesta });
    const { router } = renderRoute('/login');
    await entrar();
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(router.state.location.pathname).toBe('/login');
  });

  it('muestra el aviso que llega de otra página (contraseña cambiada)', async () => {
    mockApi({});
    const { router } = renderRoute('/');
    await router.navigate('/login', {
      state: { flash: { type: 'success', message: 'Contraseña cambiada. Ya puedes iniciar sesión.' } },
    });
    expect(await screen.findByText('Contraseña cambiada. Ya puedes iniciar sesión.')).toBeInTheDocument();
  });
});
