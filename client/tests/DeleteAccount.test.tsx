import type { ProfileDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker, sessionUser } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

const perfil = (role: ProfileDto['role'] = 'adopter'): ProfileDto => ({
  firstName: 'Lucía',
  lastName: 'Martínez Navarro',
  email: 'lucia.martinez@correo.test',
  phone: null,
  role,
  emailNotifications: true,
  emailFrequency: 'per_update',
  showPublicName: false,
});

function api(respuesta: { status?: number; body?: unknown } = { body: { message: 'Tu cuenta se ha eliminado.' } }) {
  let borrada = false;
  return mockApi({
    '/api/auth/me': () => ({ body: { user: borrada ? null : sessionUser() } }),
    '/api/me/profile': { body: perfil() },
    '/api/me': () => {
      if (!respuesta.status || respuesta.status < 400) borrada = true;
      return respuesta;
    },
    '/api/home': { body: { shelteredCount: 0, featured: [] } },
  });
}

async function abrirDialogo() {
  const seccion = (await screen.findByRole('heading', { level: 2, name: 'Eliminar cuenta' })).closest(
    'section',
  ) as HTMLElement;
  expect(within(seccion).getByText(/se borran tus datos personales/)).toBeInTheDocument();
  await userEvent.click(within(seccion).getByRole('button', { name: 'Eliminar mi cuenta' }));
  return screen.getByRole('dialog', { name: '¿Eliminar tu cuenta?' });
}

describe('CU-25 Eliminar la cuenta (SCREENS §4.6)', () => {
  it('1-5: explica las consecuencias, pide la contraseña, elimina, cierra la sesión y lo confirma', async () => {
    const { enviados } = api();
    const { router } = renderRoute('/profile');
    const dialogo = await abrirDialogo();
    // El foco empieza en «Cancelar» (DESIGN_SYSTEM: confirmación destructiva).
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await userEvent.type(within(dialogo).getByLabelText('Contraseña'), 'Lucia.buitres1');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar cuenta' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('Tu cuenta se ha eliminado.')).toBeInTheDocument();
    expect(enviados('/api/me')).toEqual([{ password: 'Lucia.buitres1' }]);
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('3: sin contraseña no se envía', async () => {
    const { enviados } = api();
    renderRoute('/profile');
    const dialogo = await abrirDialogo();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar cuenta' }));
    expect(await within(dialogo).findByText('Escribe tu contraseña.')).toBeInTheDocument();
    expect(enviados('/api/me')).toEqual([]);
  });

  it('3a: con la contraseña incorrecta lo dice en el campo y no se elimina nada', async () => {
    api(
      errorApi(422, 'INVALID_PASSWORD', 'La contraseña no es correcta.', [
        { field: 'password', message: 'La contraseña no es correcta.' },
      ]),
    );
    const { router } = renderRoute('/profile');
    const dialogo = await abrirDialogo();
    await userEvent.type(within(dialogo).getByLabelText('Contraseña'), 'mala');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar cuenta' }));
    expect(await within(dialogo).findByText('La contraseña no es correcta.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profile');
  });

  it('1a: un trabajador no ve la opción', async () => {
    mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/me/profile': { body: perfil('caretaker') },
    });
    renderRoute('/profile');
    expect(await screen.findByRole('heading', { level: 2, name: 'Contraseña' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Eliminar cuenta' })).not.toBeInTheDocument();
  });
});
