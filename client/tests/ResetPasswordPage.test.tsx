import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { errorApi, mockApi, renderRoute } from './helpers/render';

async function guardar(password = 'nueva-clave', repetida = password) {
  await userEvent.type(await screen.findByLabelText('Nueva contraseña'), password);
  await userEvent.type(screen.getByLabelText('Repite la contraseña'), repetida);
  await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
}

describe('CU-10 Nueva contraseña', () => {
  it('guarda la contraseña y lleva a iniciar sesión con un aviso', async () => {
    const { enviados } = mockApi({ '/api/auth/reset-password': { status: 204 } });
    const { router } = renderRoute('/reset-password?token=abc');
    await guardar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByText('Contraseña cambiada. Ya puedes iniciar sesión.')).toBeInTheDocument();
    expect(enviados('/api/auth/reset-password')).toEqual([
      { token: 'abc', password: 'nueva-clave', passwordConfirm: 'nueva-clave' },
    ]);
  });

  it('5b: la contraseña no cumple el mínimo o no coincide', async () => {
    const { pedidas } = mockApi({});
    renderRoute('/reset-password?token=abc');
    await guardar('corta', 'corta');
    expect(await screen.findByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(pedidas('/api/auth/reset-password')).toHaveLength(0);
  });

  it('5a: enlace no válido, con la opción de pedir otro', async () => {
    mockApi({ '/api/auth/reset-password': errorApi(422, 'INVALID_TOKEN', 'x') });
    renderRoute('/reset-password?token=caducado');
    await guardar();
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o ha caducado.');
    expect(screen.getByRole('link', { name: 'Pedir otro enlace' })).toHaveAttribute('href', '/forgot-password');
  });

  it('sin token en la URL no muestra el formulario', async () => {
    mockApi({});
    renderRoute('/reset-password');
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o ha caducado.');
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
  });
});
