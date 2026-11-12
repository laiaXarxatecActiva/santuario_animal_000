import type { ProfileDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sessionUser } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';

const perfilLucia: ProfileDto = {
  firstName: 'Lucía',
  lastName: 'Martínez Navarro',
  email: 'lucia.martinez@correo.test',
  phone: '611222006',
  role: 'adopter',
  emailNotifications: true,
  emailFrequency: 'per_update',
  showPublicName: false,
};

/** API con un perfil que se puede modificar con PATCH. */
function apiPerfil(perfil: ProfileDto = perfilLucia, extra: Parameters<typeof mockApi>[0] = {}) {
  let actual = perfil;
  const user = () => sessionUser({ firstName: actual.firstName, role: actual.role });
  return mockApi({
    '/api/auth/me': () => ({ body: { user: user() } }),
    '/api/me/profile': (_url: URL, p: Peticion) => {
      if (p.method === 'PATCH') actual = { ...actual, ...(p.body as Partial<ProfileDto>) };
      return { body: actual };
    },
    ...extra,
  });
}

const seccion = async (titulo: string) =>
  (await screen.findByRole('heading', { level: 2, name: titulo })).closest('section') as HTMLElement;

describe('CU-23 Gestionar el perfil y las preferencias', () => {
  it('sin sesión, pide iniciar sesión y vuelve después', async () => {
    mockApi({});
    const { router } = renderRoute('/profile');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fprofile');
  });

  it('2: el adoptante ve sus datos y sus preferencias', async () => {
    apiPerfil();
    renderRoute('/profile');
    expect(await screen.findByRole('heading', { level: 1, name: 'Mi perfil' })).toBeInTheDocument();
    const datos = await seccion('Tus datos');
    expect(within(datos).getByLabelText('Nombre')).toHaveValue('Lucía');
    expect(within(datos).getByLabelText('Apellidos')).toHaveValue('Martínez Navarro');
    expect(within(datos).getByLabelText('Teléfono (opcional)')).toHaveValue('611-22-20-06');
    expect(within(datos).getByText('lucia.martinez@correo.test')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Tus datos',
      'Notificaciones',
      'Privacidad',
      'Contraseña',
    ]);
  });

  it('los trabajadores solo ven sus datos y la contraseña', async () => {
    apiPerfil({ ...perfilLucia, firstName: 'Nuria', role: 'caretaker' });
    renderRoute('/profile');
    await seccion('Tus datos');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Tus datos', 'Contraseña']);
  });

  it('el teléfono solo admite dígitos y añade los guiones solo', async () => {
    apiPerfil();
    renderRoute('/profile');
    const telefono = within(await seccion('Tus datos')).getByLabelText('Teléfono (opcional)');
    await userEvent.clear(telefono);
    await userEvent.type(telefono, '+34 7a12345678999');
    expect(telefono).toHaveValue('347-12-34-56');
    await userEvent.clear(telefono);
    await userEvent.type(telefono, '712345678');
    expect(telefono).toHaveValue('712-34-56-78');
  });

  it('3-4: guarda los datos, muestra «Cambios guardados» y actualiza el nombre de la cabecera', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    await userEvent.clear(within(datos).getByLabelText('Nombre'));
    await userEvent.type(within(datos).getByLabelText('Nombre'), 'Lucía María');
    await userEvent.clear(within(datos).getByLabelText('Teléfono (opcional)'));
    await userEvent.type(within(datos).getByLabelText('Teléfono (opcional)'), '622334455');
    await userEvent.click(within(datos).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(datos).findByText('Cambios guardados')).toBeInTheDocument();
    expect(enviados('/api/me/profile').at(-1)).toEqual({
      firstName: 'Lucía María',
      lastName: 'Martínez Navarro',
      phone: '622334455',
    });
    expect(await screen.findByRole('button', { name: 'Menú de Lucía María' })).toBeInTheDocument();
  });

  it('se puede borrar el teléfono', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    await userEvent.clear(within(datos).getByLabelText('Teléfono (opcional)'));
    await userEvent.click(within(datos).getByRole('button', { name: 'Guardar cambios' }));
    await within(datos).findByText('Cambios guardados');
    expect(enviados('/api/me/profile').at(-1)).toMatchObject({ phone: null });
  });

  it('3a: un teléfono incompleto o un nombre vacío dan error en el campo y no se envía nada', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    await userEvent.clear(within(datos).getByLabelText('Nombre'));
    await userEvent.clear(within(datos).getByLabelText('Teléfono (opcional)'));
    await userEvent.type(within(datos).getByLabelText('Teléfono (opcional)'), '6123');
    await userEvent.click(within(datos).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(datos).findByText('Introduce tu nombre.')).toBeInTheDocument();
    expect(within(datos).getByText(/Introduce un móvil español de 9 dígitos/)).toBeInTheDocument();
    expect(enviados('/api/me/profile').filter(Boolean)).toEqual([]);
  });

  it('notificaciones: sin emails no se elige frecuencia; se guarda con su propio botón', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const avisos = await seccion('Notificaciones');
    const mensual = within(avisos).getByRole('radio', { name: 'Un resumen al mes' });
    await userEvent.click(mensual);
    await userEvent.click(within(avisos).getByRole('switch', { name: 'Recibir emails' }));
    expect(mensual).toBeDisabled();
    await userEvent.click(within(avisos).getByRole('button', { name: 'Guardar' }));
    expect(await within(avisos).findByText('Cambios guardados')).toBeInTheDocument();
    expect(enviados('/api/me/profile').at(-1)).toEqual({
      emailNotifications: false,
      emailFrequency: 'monthly_digest',
    });
  });

  it('privacidad: activa aparecer en la ficha de sus animales (RN-16)', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const privacidad = await seccion('Privacidad');
    const interruptor = within(privacidad).getByRole('switch', {
      name: 'Mostrar mi nombre en la ficha de los animales que adopto',
    });
    expect(interruptor).not.toBeChecked();
    await userEvent.click(interruptor);
    await userEvent.click(within(privacidad).getByRole('button', { name: 'Guardar' }));
    expect(await within(privacidad).findByText('Cambios guardados')).toBeInTheDocument();
    expect(enviados('/api/me/profile').at(-1)).toEqual({ showPublicName: true });
  });

  it('los errores del servidor aparecen junto al campo', async () => {
    apiPerfil(perfilLucia, {
      '/api/me/profile': (_url: URL, p: Peticion) =>
        p.method === 'PATCH'
          ? errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
              { field: 'lastName', message: 'No puede tener más de 150 caracteres.' },
            ])
          : { body: perfilLucia },
    });
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    await userEvent.click(within(datos).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(datos).findByText('No puede tener más de 150 caracteres.')).toBeInTheDocument();
  });
});

describe('CU-24 Cambiar la contraseña', () => {
  async function rellenar(actual: string, nueva: string, repetida = nueva) {
    const contraseña = await seccion('Contraseña');
    await userEvent.type(within(contraseña).getByLabelText('Contraseña actual'), actual);
    await userEvent.type(within(contraseña).getByLabelText('Nueva contraseña'), nueva);
    await userEvent.type(within(contraseña).getByLabelText('Repite la nueva contraseña'), repetida);
    await userEvent.click(within(contraseña).getByRole('button', { name: 'Cambiar contraseña' }));
    return contraseña;
  }

  it('3: envía la actual y la nueva, muestra «Contraseña cambiada» y vacía el formulario', async () => {
    const { enviados } = apiPerfil(perfilLucia, { '/api/me/password': { status: 204 } });
    renderRoute('/profile');
    const contraseña = await rellenar('Lucia.buitres1', 'NuevaClave#2026');
    expect(await within(contraseña).findByText('Contraseña cambiada')).toBeInTheDocument();
    expect(enviados('/api/me/password')).toEqual([
      { currentPassword: 'Lucia.buitres1', newPassword: 'NuevaClave#2026' },
    ]);
    expect(within(contraseña).getByLabelText('Contraseña actual')).toHaveValue('');
  });

  it('2a: la contraseña actual incorrecta se indica en su campo', async () => {
    apiPerfil(perfilLucia, {
      '/api/me/password': errorApi(422, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta.', [
        { field: 'currentPassword', message: 'La contraseña actual no es correcta.' },
      ]),
    });
    renderRoute('/profile');
    const contraseña = await rellenar('mal', 'NuevaClave#2026');
    expect(await within(contraseña).findByText('La contraseña actual no es correcta.')).toBeInTheDocument();
  });

  it('2b: la nueva debe repetirse igual y ser distinta de la actual', async () => {
    const { enviados } = apiPerfil(perfilLucia, { '/api/me/password': { status: 204 } });
    renderRoute('/profile');
    let contraseña = await rellenar('Lucia.buitres1', 'NuevaClave#2026', 'OtraClave#2026');
    expect(await within(contraseña).findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    for (const campo of ['Contraseña actual', 'Nueva contraseña', 'Repite la nueva contraseña']) {
      await userEvent.clear(within(contraseña).getByLabelText(campo));
    }
    contraseña = await rellenar('Lucia.buitres1', 'Lucia.buitres1');
    expect(
      await within(contraseña).findByText('La nueva contraseña debe ser distinta de la actual.'),
    ).toBeInTheDocument();
    expect(enviados('/api/me/password')).toEqual([]);
  });
});
