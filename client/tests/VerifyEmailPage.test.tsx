import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sessionUser } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

describe('CU-08 Verificar el email', () => {
  it('verifica el email con el token del enlace', async () => {
    const { enviados } = mockApi({ '/api/auth/verify-email': { body: { status: 'verified' } } });
    renderRoute('/verify-email?token=abc');
    expect(await screen.findByText('Email verificado. Ya puedes adoptar.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver animales' })).toHaveAttribute('href', '/animals');
    expect(enviados('/api/auth/verify-email')).toEqual([{ token: 'abc' }]);
  });

  it('3a: el email ya estaba verificado', async () => {
    mockApi({ '/api/auth/verify-email': { body: { status: 'already_verified' } } });
    renderRoute('/verify-email?token=abc');
    expect(await screen.findByText('Tu email ya estaba verificado.')).toBeInTheDocument();
  });

  it('2a: enlace no válido, sin sesión: no ofrece reenviar', async () => {
    mockApi({ '/api/auth/verify-email': errorApi(422, 'INVALID_TOKEN', 'x') });
    renderRoute('/verify-email?token=caducado');
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o ha caducado.');
    expect(screen.queryByRole('button', { name: 'Reenviar email' })).not.toBeInTheDocument();
  });

  it('2a: sin token en la URL', async () => {
    const { pedidas } = mockApi({});
    renderRoute('/verify-email');
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o ha caducado.');
    expect(pedidas('/api/auth/verify-email')).toHaveLength(0);
  });

  it('A1: con sesión y el email sin verificar, permite reenviar el email', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: sessionUser({ emailVerified: false }) } },
      '/api/auth/verify-email': errorApi(422, 'INVALID_TOKEN', 'x'),
      '/api/auth/resend-verification': { status: 204 },
    });
    renderRoute('/verify-email?token=caducado');
    const botones = await screen.findAllByRole('button', { name: 'Reenviar email' });
    // Solo el de la página: el aviso de la cabecera no se repite aquí.
    expect(botones).toHaveLength(1);
    await userEvent.click(botones[0]!);
    expect(await screen.findByText('Te hemos enviado un nuevo email de verificación.')).toBeInTheDocument();
    expect(enviados('/api/auth/resend-verification')).toEqual([{}]);
  });

  it('A1: si se supera el límite de reenvíos lo indica', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser({ emailVerified: false }) } },
      '/api/auth/verify-email': errorApi(422, 'INVALID_TOKEN', 'x'),
      '/api/auth/resend-verification': errorApi(429, 'TOO_MANY_REQUESTS', 'x'),
    });
    renderRoute('/verify-email?token=caducado');
    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar email' }));
    expect(await screen.findByText('Demasiados intentos; espera unos minutos.')).toBeInTheDocument();
  });
});
