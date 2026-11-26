import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminPlans, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';

type Respuesta = { status?: number; body?: unknown };

function api(user = admin(), extra: Record<string, (u: URL, p: Peticion) => Respuesta | Promise<Respuesta>> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/plans': { body: { data: adminPlans } },
    '/api/admin/dashboard': {
      body: { animalsByStatus: {}, activeAdoptions: 0, pendingAdoptions: 0, updateAlerts: [] },
    },
    ...extra,
  });
}

const tarjeta = async (nombre: string) => screen.findByRole('region', { name: nombre });

/** GET devuelve los planes; PUT responde con los planes enviados (como los guardaría el servidor). */
const guardarPlanes =
  () =>
  (_u: URL, p: Peticion): Respuesta =>
    p.method === 'PUT'
      ? {
          body: {
            data: (p.body as { plans: { id: number }[] }).plans.map((enviado) => ({
              ...adminPlans.find((plan) => plan.id === enviado.id),
              ...enviado,
            })),
          },
        }
      : { body: { data: adminPlans } };

/** Cuerpos de los PUT a /api/admin/plans (los GET no llevan cuerpo). */
const cuerposPut = (enviados: (ruta: string) => unknown[]) =>
  enviados('/api/admin/plans').filter((cuerpo) => cuerpo !== undefined);

describe('CU-40 Gestionar planes de adopción', () => {
  it('el enlace «Planes» del menú solo lo ve el administrador', async () => {
    api();
    const vistaAdmin = renderRoute('/admin');
    // El apartado «Administración» empieza cerrado en el escritorio.
    await userEvent.click(await screen.findByRole('button', { name: 'Administración' }));
    expect(await screen.findByRole('link', { name: 'Planes' })).toHaveAttribute('href', '/admin/plans');
    vistaAdmin.unmount();

    api(caretaker());
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Planes' })).not.toBeInTheDocument();
  });

  it('2: muestra cada plan con su importe, descripción, por defecto, activo y adopciones activas', async () => {
    api();
    renderRoute('/admin/plans');
    expect(await screen.findByRole('heading', { level: 1, name: 'Planes' })).toBeInTheDocument();
    const usual = await tarjeta('Usual');
    expect(within(usual).getByLabelText('Nombre')).toHaveValue('Usual');
    expect(within(usual).getByLabelText('Importe mensual (€)')).toHaveValue('5,00');
    expect(within(usual).getByLabelText('Descripción (opcional)')).toHaveValue('La opción más habitual.');
    expect(within(usual).getByRole('switch', { name: 'Plan por defecto' })).toBeChecked();
    expect(within(usual).getByRole('switch', { name: 'Activo' })).toBeChecked();
    expect(within(usual).getByText('5 adopciones activas')).toBeInTheDocument();

    const extra = await tarjeta('Extraordinaria');
    expect(within(extra).getByRole('switch', { name: 'Activo' })).not.toBeChecked();
    expect(within(extra).getByText('1 adopción activa')).toBeInTheDocument();
  });

  it('3: el título de la tarjeta cambia al escribir y un único «Guardar cambios» guarda todos los planes', async () => {
    const { enviados } = api(admin(), { '/api/admin/plans': guardarPlanes() });
    renderRoute('/admin/plans');
    const simbolica = await tarjeta('Simbólica');
    const guardarTodo = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(guardarTodo).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descartar cambios' })).toBeDisabled();
    // Ninguna tarjeta tiene su propio botón de guardar.
    expect(within(simbolica).queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();

    await userEvent.type(within(simbolica).getByLabelText('Nombre'), '+');
    expect(within(simbolica).getByRole('heading', { name: 'Simbólica+' })).toBeInTheDocument();
    await userEvent.type(
      within(await tarjeta('Extraordinaria')).getByLabelText('Descripción (opcional)'),
      'Para padrinos.',
    );
    await userEvent.click(guardarTodo);

    expect(await screen.findByText('Planes guardados')).toBeInTheDocument();
    expect(cuerposPut(enviados)).toEqual([
      {
        plans: [
          {
            id: 1,
            name: 'Simbólica+',
            monthlyAmount: '1,00',
            description: 'Para quien quiere colaborar con lo mínimo.',
            isDefault: false,
            isActive: true,
          },
          {
            id: 2,
            name: 'Usual',
            monthlyAmount: '5,00',
            description: 'La opción más habitual.',
            isDefault: true,
            isActive: true,
          },
          {
            id: 3,
            name: 'Extraordinaria',
            monthlyAmount: '12,00',
            description: 'Para padrinos.',
            isDefault: false,
            isActive: false,
          },
        ],
        confirmAmountChange: false,
      },
    ]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled());
  });

  it('tras guardar, las tarjetas muestran lo guardado aunque el servidor tarde en volver a enviar los planes', async () => {
    let lecturas = 0;
    api(admin(), {
      '/api/admin/plans': (u, p) => {
        if (p.method === 'PUT') return guardarPlanes()(u, p);
        lecturas += 1;
        // La segunda lectura (tras guardar) no llega: la página tiene que arreglarse con la respuesta del PUT.
        return lecturas === 1 ? { body: { data: adminPlans } } : new Promise<Respuesta>(() => {});
      },
    });
    renderRoute('/admin/plans');
    await userEvent.type(within(await tarjeta('Simbólica')).getByLabelText('Nombre'), '+');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Planes guardados')).toBeInTheDocument();
    expect(within(await tarjeta('Simbólica+')).getByLabelText('Nombre')).toHaveValue('Simbólica+');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it('al marcar otro plan por defecto, el anterior se desmarca al momento (y si estaba desactivado, se activa)', async () => {
    api();
    renderRoute('/admin/plans');
    const usual = await tarjeta('Usual');
    const extra = await tarjeta('Extraordinaria');
    await userEvent.click(within(extra).getByRole('switch', { name: 'Plan por defecto' }));
    expect(within(extra).getByRole('switch', { name: 'Plan por defecto' })).toBeChecked();
    expect(within(usual).getByRole('switch', { name: 'Plan por defecto' })).not.toBeChecked();
    expect(within(extra).getByRole('switch', { name: 'Activo' })).toBeChecked();
    expect(
      within(extra).getByText('Se ha activado porque el plan por defecto tiene que estar activo.'),
    ).toBeInTheDocument();
  });

  it('no se puede quitar ni desactivar el plan por defecto: el interruptor no cambia y avisa sin guardar', async () => {
    const { enviados } = api();
    renderRoute('/admin/plans');
    const usual = await tarjeta('Usual');
    await userEvent.click(within(usual).getByRole('switch', { name: 'Plan por defecto' }));
    expect(within(usual).getByRole('switch', { name: 'Plan por defecto' })).toBeChecked();
    expect(
      within(usual).getByText('Siempre tiene que haber un plan por defecto: marca otro plan como plan por defecto.'),
    ).toBeInTheDocument();

    await userEvent.click(within(usual).getByRole('switch', { name: 'Activo' }));
    expect(within(usual).getByRole('switch', { name: 'Activo' })).toBeChecked();
    expect(
      within(usual).getByText(
        'El plan por defecto tiene que estar activo: marca antes otro plan como plan por defecto.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(cuerposPut(enviados)).toHaveLength(0);
  });

  it('«Descartar cambios» vuelve a lo guardado', async () => {
    api();
    renderRoute('/admin/plans');
    const simbolica = await tarjeta('Simbólica');
    await userEvent.type(within(simbolica).getByLabelText('Nombre'), ' nueva');
    await userEvent.click(within(await tarjeta('Extraordinaria')).getByRole('switch', { name: 'Plan por defecto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(within(simbolica).getByLabelText('Nombre')).toHaveValue('Simbólica');
    expect(within(await tarjeta('Usual')).getByRole('switch', { name: 'Plan por defecto' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it('salir con cambios sin guardar pide confirmación', async () => {
    api();
    const { router } = renderRoute('/admin/plans');
    await userEvent.type(within(await tarjeta('Simbólica')).getByLabelText('Nombre'), '+');
    await userEvent.click(screen.getByRole('link', { name: 'Escritorio' }));
    const ventana = await screen.findByRole('dialog', { name: 'Tienes cambios sin guardar' });
    await userEvent.click(within(ventana).getByRole('button', { name: 'Seguir editando' }));
    expect(router.state.location.pathname).toBe('/admin/plans');
    expect(within(await tarjeta('Simbólica+')).getByLabelText('Nombre')).toHaveValue('Simbólica+');

    await userEvent.click(screen.getByRole('link', { name: 'Escritorio' }));
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Tienes cambios sin guardar' })).getByRole('button', {
        name: 'Salir sin guardar',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'));
  });

  it('3a: cambiar el importe con adopciones activas avisa y pide confirmación antes de guardar', async () => {
    const { enviados } = api(admin(), { '/api/admin/plans': guardarPlanes() });
    renderRoute('/admin/plans');
    const importe = within(await tarjeta('Usual')).getByLabelText('Importe mensual (€)');
    await userEvent.clear(importe);
    await userEvent.type(importe, '6');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await screen.findByText(
        'Usual: el nuevo importe se cobrará a las 5 adopciones activas de este plan desde su siguiente cuota.',
      ),
    ).toBeInTheDocument();
    expect(cuerposPut(enviados)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y guardar' }));
    await waitFor(() => expect(cuerposPut(enviados)).toHaveLength(1));
    expect(cuerposPut(enviados)[0]).toMatchObject({ confirmAmountChange: true });
  });

  it('3a: sin adopciones activas, el importe se guarda sin aviso', async () => {
    const { enviados } = api(admin(), { '/api/admin/plans': guardarPlanes() });
    renderRoute('/admin/plans');
    const importe = within(await tarjeta('Simbólica')).getByLabelText('Importe mensual (€)');
    await userEvent.clear(importe);
    await userEvent.type(importe, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(cuerposPut(enviados)).toHaveLength(1));
  });

  it('3b: valida el importe antes de enviar', async () => {
    const { enviados } = api(admin(), { '/api/admin/plans': guardarPlanes() });
    renderRoute('/admin/plans');
    const simbolica = await tarjeta('Simbólica');
    const importe = within(simbolica).getByLabelText('Importe mensual (€)');
    await userEvent.clear(importe);
    await userEvent.type(importe, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(simbolica).findByText('El importe debe ser mayor que 0.')).toBeInTheDocument();
    expect(cuerposPut(enviados)).toHaveLength(0);
  });

  it('el error del servidor sale junto al campo del plan', async () => {
    const mensaje = 'Ya existe un plan con este nombre.';
    api(admin(), {
      '/api/admin/plans': (_u, p) =>
        p.method === 'PUT'
          ? errorApi(409, 'PLAN_ALREADY_EXISTS', mensaje, [{ field: 'plans.0.name', message: mensaje }])
          : { body: { data: adminPlans } },
    });
    renderRoute('/admin/plans');
    const simbolica = await tarjeta('Simbólica');
    await userEvent.type(within(simbolica).getByLabelText('Nombre'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(simbolica).findByText(mensaje)).toBeInTheDocument();
  });

  it('A2: crea un plan nuevo', async () => {
    const nuevo = { ...adminPlans[0], id: 4, name: 'Padrino', monthlyAmount: '25.00', description: null };
    const { enviados } = api(admin(), {
      '/api/admin/plans': (_u, p) =>
        p.method === 'POST' ? { status: 201, body: nuevo } : { body: { data: adminPlans } },
    });
    renderRoute('/admin/plans');
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo plan' }));
    const ventana = await screen.findByRole('dialog', { name: 'Nuevo plan' });
    await userEvent.type(within(ventana).getByLabelText('Nombre'), 'Padrino');
    await userEvent.type(within(ventana).getByLabelText('Importe mensual (€)'), '25');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Plan creado')).toBeInTheDocument();
    expect(enviados('/api/admin/plans').filter((cuerpo) => cuerpo !== undefined)).toEqual([
      { name: 'Padrino', monthlyAmount: '25', description: '', isDefault: false, isActive: true },
    ]);
  });

  it('error al cargar: aviso con «Reintentar»', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/plans': errorApi(500, 'INTERNAL_ERROR', 'x'),
    });
    renderRoute('/admin/plans');
    expect(await screen.findByText('No hemos podido cargar los planes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
