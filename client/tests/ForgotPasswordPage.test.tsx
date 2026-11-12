import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderRoute } from './helpers/render';

describe('CU-10 He olvidado mi contraseña', () => {
  it('pide el enlace y muestra siempre el mismo mensaje', async () => {
    const { enviados } = mockApi({
      '/api/auth/forgot-password': { body: { message: 'Si existe una cuenta con ese email, recibirás un enlace.' } },
    });
    renderRoute('/forgot-password');
    await userEvent.type(await screen.findByLabelText('Email'), 'ana@correo.test');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByText('Si existe una cuenta con ese email, recibirás un enlace.')).toBeInTheDocument();
    expect(enviados('/api/auth/forgot-password')).toEqual([{ email: 'ana@correo.test' }]);
    expect(screen.queryByRole('button', { name: 'Enviar enlace' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/login');
  });

  it('valida el email', async () => {
    const { pedidas } = mockApi({});
    renderRoute('/forgot-password');
    await userEvent.type(await screen.findByLabelText('Email'), 'no-es-un-email');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByText('Introduce un email válido.')).toBeInTheDocument();
    expect(pedidas('/api/auth/forgot-password')).toHaveLength(0);
  });
});
