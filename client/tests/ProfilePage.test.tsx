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

/** Barra fija con el único «Guardar cambios»: siempre está. */
const barra = () => screen.queryByRole('region', { name: 'Cambios del perfil' });

/** Sin cambios, la barra sigue ahí con los dos botones visibles pero desactivados. */
const sinCambiosQueGuardar = () => {
  expect(barra()).toBeInTheDocument();
  expect(barra()).not.toHaveTextContent('Tienes cambios sin guardar');
  expect(within(barra()!).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  expect(within(barra()!).getByRole('button', { name: 'Descartar cambios' })).toBeDisabled();
};

/** Guarda con la barra y confirma en el resumen. */
async function guardar() {
  await userEvent.click(within(barra()!).getByRole('button', { name: 'Guardar cambios' }));
  const resumen = await screen.findByRole('dialog', { name: 'Revisa los cambios' });
  await userEvent.click(within(resumen).getByRole('button', { name: 'Confirmar y guardar' }));
}

describe('CU-23 Gestionar el perfil y las preferencias', () => {
  it('sin sesión, pide iniciar sesión y vuelve después', async () => {
    mockApi({});
    const { router } = renderRoute('/profile');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fprofile');
  });

  it('2: el adoptante ve sus datos y sus preferencias, sin la sección de idioma', async () => {
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
      'Eliminar cuenta',
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

  it('un solo «Guardar cambios»: la barra está siempre; sus botones se activan al cambiar algo y se desactivan al deshacerlo', async () => {
    apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    sinCambiosQueGuardar();

    await userEvent.type(within(datos).getByLabelText('Nombre'), ' María');
    expect(barra()).toHaveTextContent('Tienes cambios sin guardar');
    expect(within(barra()!).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    expect(within(barra()!).getByRole('button', { name: 'Descartar cambios' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: 'Guardar cambios' })).toHaveLength(1);

    await userEvent.type(within(datos).getByLabelText('Nombre'), '{Backspace>6/}');
    expect(within(datos).getByLabelText('Nombre')).toHaveValue('Lucía');
    sinCambiosQueGuardar();
  });

  it('«Descartar cambios» vuelve a lo guardado sin enviar nada', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    await userEvent.clear(within(datos).getByLabelText('Apellidos'));
    await userEvent.click(within(await seccion('Privacidad')).getByRole('switch'));
    await userEvent.click(within(barra()!).getByRole('button', { name: 'Descartar cambios' }));
    expect(within(datos).getByLabelText('Apellidos')).toHaveValue('Martínez Navarro');
    expect(within(await seccion('Privacidad')).getByRole('switch')).not.toBeChecked();
    sinCambiosQueGuardar();
    expect(enviados('/api/me/profile').filter(Boolean)).toEqual([]);
  });

  it('lo cambiado lleva la marca «Modificado» hasta que se guarda', async () => {
    apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    const telefono = within(datos).getByLabelText('Teléfono (opcional)');
    expect(screen.queryByText('Modificado')).not.toBeInTheDocument();
    await userEvent.clear(telefono);
    await userEvent.type(telefono, '622334455');
    const avisos = await seccion('Notificaciones');
    await userEvent.click(within(avisos).getByRole('radio', { name: 'Un resumen al mes' }));
    expect(within(datos).getAllByText('Modificado')).toHaveLength(1);
    expect(telefono).toHaveAccessibleDescription(expect.stringContaining('Modificado'));
    expect(within(avisos).getAllByText('Modificado')).toHaveLength(1);
    expect(within(datos).getByLabelText('Nombre')).not.toHaveAccessibleDescription(
      expect.stringContaining('Modificado'),
    );

    await guardar();
    expect(await within(barra()!).findByText('Cambios guardados')).toBeInTheDocument();
    expect(screen.queryByText('Modificado')).not.toBeInTheDocument();
  });

  it('antes de guardar, un resumen enumera cada cambio; «Volver» no envía nada', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    await userEvent.clear(within(datos).getByLabelText('Teléfono (opcional)'));
    await userEvent.type(within(datos).getByLabelText('Teléfono (opcional)'), '622334455');
    await userEvent.click(within(await seccion('Notificaciones')).getByRole('switch', { name: 'Recibir emails' }));
    await userEvent.click(within(barra()!).getByRole('button', { name: 'Guardar cambios' }));

    const resumen = await screen.findByRole('dialog', { name: 'Revisa los cambios' });
    const lineas = within(resumen)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(lineas).toEqual(['Teléfono: 611-22-20-06 → 622-33-44-55', 'Recibir emails: Sí → No']);
    // El foco empieza en «Volver», para que pulsar Intro sin leer no guarde.
    expect(within(resumen).getByRole('button', { name: 'Volver' })).toHaveFocus();
    await userEvent.click(within(resumen).getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(datos).getByLabelText('Teléfono (opcional)')).toHaveValue('622-33-44-55');
    expect(enviados('/api/me/profile').filter(Boolean)).toEqual([]);
  });

  it('3-4: guarda los datos y las preferencias de una vez, muestra «Cambios guardados» y actualiza la cabecera', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    await userEvent.clear(within(datos).getByLabelText('Nombre'));
    await userEvent.type(within(datos).getByLabelText('Nombre'), 'Lucía María');
    await userEvent.clear(within(datos).getByLabelText('Teléfono (opcional)'));
    await userEvent.type(within(datos).getByLabelText('Teléfono (opcional)'), '622334455');
    await userEvent.click(within(await seccion('Privacidad')).getByRole('switch'));
    await guardar();
    expect(await within(barra()!).findByText('Cambios guardados')).toBeInTheDocument();
    expect(within(barra()!).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(within(barra()!).getByRole('button', { name: 'Descartar cambios' })).toBeDisabled();
    // Una sola petición, solo con lo que ha cambiado.
    expect(enviados('/api/me/profile').filter(Boolean)).toEqual([
      { firstName: 'Lucía María', phone: '622334455', showPublicName: true },
    ]);
    expect(await screen.findByRole('button', { name: 'Menú de Lucía María' })).toBeInTheDocument();
  });

  it('se puede borrar el teléfono', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    await userEvent.clear(within(datos).getByLabelText('Teléfono (opcional)'));
    await userEvent.click(within(barra()!).getByRole('button', { name: 'Guardar cambios' }));
    const resumen = await screen.findByRole('dialog', { name: 'Revisa los cambios' });
    expect(within(resumen).getByRole('listitem')).toHaveTextContent('Teléfono: 611-22-20-06 → Sin teléfono');
    await userEvent.click(within(resumen).getByRole('button', { name: 'Confirmar y guardar' }));
    await within(barra()!).findByText('Cambios guardados');
    expect(enviados('/api/me/profile').at(-1)).toEqual({ phone: null });
  });

  it('3a: un teléfono incompleto o un nombre vacío dan error en el campo, sin resumen y sin enviar nada', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const datos = await seccion('Tus datos');
    await userEvent.clear(within(datos).getByLabelText('Nombre'));
    await userEvent.clear(within(datos).getByLabelText('Teléfono (opcional)'));
    await userEvent.type(within(datos).getByLabelText('Teléfono (opcional)'), '6123');
    await userEvent.click(within(barra()!).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(datos).findByText('Introduce tu nombre.')).toBeInTheDocument();
    expect(within(datos).getByText(/Introduce un móvil español de 9 dígitos/)).toBeInTheDocument();
    expect(within(datos).getByLabelText('Nombre')).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(enviados('/api/me/profile').filter(Boolean)).toEqual([]);
  });

  it('notificaciones: sin emails no se elige frecuencia; se guarda con el botón común', async () => {
    const { enviados } = apiPerfil();
    renderRoute('/profile');
    const avisos = await seccion('Notificaciones');
    const mensual = within(avisos).getByRole('radio', { name: 'Un resumen al mes' });
    await userEvent.click(mensual);
    await userEvent.click(within(avisos).getByRole('switch', { name: 'Recibir emails' }));
    expect(mensual).toBeDisabled();
    await guardar();
    expect(await within(barra()!).findByText('Cambios guardados')).toBeInTheDocument();
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
    await guardar();
    expect(await within(barra()!).findByText('Cambios guardados')).toBeInTheDocument();
    expect(enviados('/api/me/profile').at(-1)).toEqual({ showPublicName: true });
  });

  it('los errores del servidor aparecen junto al campo y la barra sigue para reintentar', async () => {
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
    await userEvent.type(within(datos).getByLabelText('Apellidos'), ' Pérez');
    await guardar();
    expect(await within(datos).findByText('No puede tener más de 150 caracteres.')).toBeInTheDocument();
    expect(within(barra()!).getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('un error general del servidor se muestra en la barra', async () => {
    apiPerfil(perfilLucia, {
      '/api/me/profile': (_url: URL, p: Peticion) =>
        p.method === 'PATCH' ? errorApi(500, 'INTERNAL_ERROR', 'Error interno.') : { body: perfilLucia },
    });
    renderRoute('/profile');
    await userEvent.click(within(await seccion('Privacidad')).getByRole('switch'));
    await guardar();
    expect(await within(barra()!).findByRole('alert')).toBeInTheDocument();
  });

  it('salir con cambios sin guardar pide confirmación', async () => {
    apiPerfil(perfilLucia, { '/api/animals': { body: { data: [], meta: { page: 1, pageSize: 12, total: 0 } } } });
    const { router } = renderRoute('/profile');
    await userEvent.type(within(await seccion('Tus datos')).getByLabelText('Nombre'), '+');
    const enlace = () =>
      within(screen.getByRole('navigation', { name: /principal/i })).getByRole('link', { name: 'Animales' });
    await userEvent.click(enlace());
    const ventana = await screen.findByRole('dialog', { name: 'Tienes cambios sin guardar' });
    expect(within(ventana).getByRole('button', { name: 'Seguir editando' })).toHaveFocus();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Seguir editando' }));
    expect(router.state.location.pathname).toBe('/profile');
    expect(within(await seccion('Tus datos')).getByLabelText('Nombre')).toHaveValue('Lucía+');

    await userEvent.click(enlace());
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Tienes cambios sin guardar' })).getByRole('button', {
        name: 'Salir sin guardar',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/animals'));
  });

  it('lo escrito en la contraseña también cuenta como cambio sin guardar; sin cambios se sale sin aviso', async () => {
    apiPerfil(perfilLucia, { '/api/animals': { body: { data: [], meta: { page: 1, pageSize: 12, total: 0 } } } });
    const { router } = renderRoute('/profile');
    const contraseña = await seccion('Contraseña');
    const enlace = () =>
      within(screen.getByRole('navigation', { name: /principal/i })).getByRole('link', { name: 'Animales' });
    await userEvent.type(within(contraseña).getByLabelText('Contraseña actual'), 'a');
    await userEvent.click(enlace());
    const ventana = await screen.findByRole('dialog', { name: 'Tienes cambios sin guardar' });
    await userEvent.click(within(ventana).getByRole('button', { name: 'Seguir editando' }));

    await userEvent.clear(within(contraseña).getByLabelText('Contraseña actual'));
    await userEvent.click(enlace());
    await waitFor(() => expect(router.state.location.pathname).toBe('/animals'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

  it('«Cambiar contraseña» es un botón de contorno, desactivado hasta que se escribe en sus campos', async () => {
    apiPerfil();
    renderRoute('/profile');
    const contraseña = await seccion('Contraseña');
    const boton = within(contraseña).getByRole('button', { name: 'Cambiar contraseña' });
    expect(boton).toBeDisabled();
    expect(boton.className).toMatch(/outline/);
    await userEvent.type(within(contraseña).getByLabelText('Nueva contraseña'), 'x');
    expect(boton).toBeEnabled();
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
