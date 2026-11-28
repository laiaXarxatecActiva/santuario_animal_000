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

/**
 * Aviso de un plan: fuera de su tarjeta, bajo la lista y a la izquierda de los
 * botones, con el nombre del plan como título.
 */
async function avisoDe(nombre: string, texto: string) {
  const aviso = (await screen.findByText(texto)).closest('[role="status"], [role="alert"]') as HTMLElement;
  expect(aviso).toHaveTextContent(nombre);
  expect(await tarjeta(nombre)).not.toContainElement(aviso);
  expect(barra()).toContainElement(aviso);
  return aviso;
}

/** Barra pegada abajo con los avisos y los botones: siempre está. */
const barra = () => screen.queryByRole('region', { name: 'Cambios de los planes' });

/** Sin cambios, la barra sigue ahí con los dos botones visibles pero desactivados. */
const sinCambiosQueGuardar = () => {
  expect(barra()).toBeInTheDocument();
  expect(within(barra()!).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  expect(within(barra()!).getByRole('button', { name: 'Descartar cambios' })).toBeDisabled();
};

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
    // Sin cambios, los botones de guardar y descartar se ven, pero desactivados.
    sinCambiosQueGuardar();
    // Ninguna tarjeta tiene su propio botón de guardar.
    expect(within(simbolica).queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();

    await userEvent.type(within(simbolica).getByLabelText('Nombre'), '+');
    const guardarTodo = within(barra()!).getByRole('button', { name: 'Guardar cambios' });
    expect(within(barra()!).getByRole('button', { name: 'Descartar cambios' })).toBeEnabled();
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
    await waitFor(sinCambiosQueGuardar);
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
    sinCambiosQueGuardar();
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
    await avisoDe('Extraordinaria', 'Se ha activado porque el plan por defecto tiene que estar activo.');
  });

  it('los avisos van en la barra de abajo, a la izquierda de «Descartar cambios» y «Guardar cambios»', async () => {
    api();
    renderRoute('/admin/plans');
    const usual = await tarjeta('Usual');
    await userEvent.click(within(usual).getByRole('switch', { name: 'Plan por defecto' }));
    const aviso = await avisoDe(
      'Usual',
      'Siempre tiene que haber un plan por defecto: marca otro plan como plan por defecto.',
    );
    // Después de la lista de tarjetas.
    expect(usual.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // La zona de avisos va justo antes de la de los botones.
    const zonaAvisos = aviso.parentElement as HTMLElement;
    const botones = zonaAvisos.nextElementSibling as HTMLElement;
    expect(within(botones).getByRole('button', { name: 'Descartar cambios' })).toBeInTheDocument();
    expect(within(botones).getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('la barra está siempre: sin cambios, sus botones se ven desactivados; al cambiar algo, se activan', async () => {
    api();
    renderRoute('/admin/plans');
    const simbolica = await tarjeta('Simbólica');
    sinCambiosQueGuardar();
    await userEvent.type(within(simbolica).getByLabelText('Nombre'), '+');
    expect(within(barra()!).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    expect(within(barra()!).getByRole('button', { name: 'Descartar cambios' })).toBeEnabled();
  });

  it('con un aviso, la barra aparece aunque no haya cambios, con «Guardar cambios» desactivado', async () => {
    api();
    renderRoute('/admin/plans');
    await userEvent.click(within(await tarjeta('Usual')).getByRole('switch', { name: 'Activo' }));
    await avisoDe('Usual', 'El plan por defecto tiene que estar activo: marca antes otro plan como plan por defecto.');
    expect(within(barra()!).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it('cada aviso se cierra con su ✕ (y sin cambios, la barra se queda con los botones desactivados)', async () => {
    api();
    renderRoute('/admin/plans');
    await userEvent.click(within(await tarjeta('Usual')).getByRole('switch', { name: 'Plan por defecto' }));
    const aviso = await avisoDe(
      'Usual',
      'Siempre tiene que haber un plan por defecto: marca otro plan como plan por defecto.',
    );
    await userEvent.click(within(aviso).getByRole('button', { name: 'Cerrar aviso' }));
    expect(aviso).not.toBeInTheDocument();
    sinCambiosQueGuardar();
  });

  it('el nombre del plan en el aviso lleva a su tarjeta y pone el foco en el interruptor', async () => {
    api();
    renderRoute('/admin/plans');
    const usual = await tarjeta('Usual');
    await userEvent.click(within(usual).getByRole('switch', { name: 'Activo' }));
    const aviso = await avisoDe(
      'Usual',
      'El plan por defecto tiene que estar activo: marca antes otro plan como plan por defecto.',
    );
    await userEvent.click(within(await tarjeta('Simbólica')).getByLabelText('Nombre'));
    await userEvent.click(within(aviso).getByRole('button', { name: 'Usual' }));
    expect(within(usual).getByRole('switch', { name: 'Activo' })).toHaveFocus();
  });

  it('el aviso informativo se cierra solo a los 6 segundos; el de advertencia se queda', async () => {
    api();
    renderRoute('/admin/plans');
    const extra = await tarjeta('Extraordinaria');
    await userEvent.click(within(extra).getByRole('switch', { name: 'Plan por defecto' }));
    const info = await avisoDe('Extraordinaria', 'Se ha activado porque el plan por defecto tiene que estar activo.');
    await waitFor(() => expect(info).not.toBeInTheDocument(), { timeout: 7000 });
    // Sigue la barra: hay cambios sin guardar.
    expect(barra()).toBeInTheDocument();

    await userEvent.click(within(extra).getByRole('switch', { name: 'Plan por defecto' }));
    const aviso = await avisoDe(
      'Extraordinaria',
      'Siempre tiene que haber un plan por defecto: marca otro plan como plan por defecto.',
    );
    await new Promise((r) => setTimeout(r, 6500));
    expect(aviso).toBeInTheDocument();
  }, 20000);

  it('no se puede quitar ni desactivar el plan por defecto: el interruptor no cambia y avisa sin guardar', async () => {
    const { enviados } = api();
    renderRoute('/admin/plans');
    const usual = await tarjeta('Usual');
    await userEvent.click(within(usual).getByRole('switch', { name: 'Plan por defecto' }));
    expect(within(usual).getByRole('switch', { name: 'Plan por defecto' })).toBeChecked();
    await avisoDe('Usual', 'Siempre tiene que haber un plan por defecto: marca otro plan como plan por defecto.');

    await userEvent.click(within(usual).getByRole('switch', { name: 'Activo' }));
    expect(within(usual).getByRole('switch', { name: 'Activo' })).toBeChecked();
    await avisoDe('Usual', 'El plan por defecto tiene que estar activo: marca antes otro plan como plan por defecto.');
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
    sinCambiosQueGuardar();
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

  describe('A3 Borrar un plan que nunca se ha usado', () => {
    const sinUso = { ...adminPlans[0]!, id: 4, name: 'Padrino', monthlyAmount: '25.00', description: null, deletable: true };

    it('solo los planes sin uso tienen «Borrar»; los demás se desactivan con su interruptor', async () => {
      api(admin(), { '/api/admin/plans': () => ({ body: { data: [...adminPlans, sinUso] } }) });
      renderRoute('/admin/plans');
      expect(within(await tarjeta('Padrino')).getByRole('button', { name: 'Borrar Padrino' })).toBeEnabled();
      for (const nombre of ['Simbólica', 'Usual', 'Extraordinaria']) {
        expect(within(await tarjeta(nombre)).queryByRole('button', { name: /^Borrar/ })).not.toBeInTheDocument();
      }
    });

    it('pide confirmación y lo borra para siempre', async () => {
      let planes = [...adminPlans, sinUso];
      const borrados: string[] = [];
      api(admin(), {
        '/api/admin/plans': () => ({ body: { data: planes } }),
        '/api/admin/plans/4': (_u, p) => {
          borrados.push(p.method);
          planes = [...adminPlans];
          return { status: 204 };
        },
      });
      renderRoute('/admin/plans');
      await userEvent.click(within(await tarjeta('Padrino')).getByRole('button', { name: 'Borrar Padrino' }));
      const ventana = await screen.findByRole('dialog', { name: '¿Borrar el plan Padrino?' });
      expect(ventana).toHaveTextContent('Se borrará para siempre. Esta acción no se puede deshacer.');
      expect(borrados).toEqual([]);
      await userEvent.click(within(ventana).getByRole('button', { name: 'Borrar' }));
      expect(await screen.findByText('Plan borrado')).toBeInTheDocument();
      expect(borrados).toEqual(['DELETE']);
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Padrino' })).not.toBeInTheDocument());
    });

    it('con cambios sin guardar, «Borrar» se desactiva y explica por qué', async () => {
      api(admin(), { '/api/admin/plans': () => ({ body: { data: [...adminPlans, sinUso] } }) });
      renderRoute('/admin/plans');
      const padrino = await tarjeta('Padrino');
      await userEvent.type(within(await tarjeta('Simbólica')).getByLabelText('Nombre'), '+');
      expect(within(padrino).getByRole('button', { name: 'Borrar Padrino' })).toBeDisabled();
      expect(padrino).toHaveTextContent('Guarda o descarta los cambios antes de borrar un plan.');
    });

    it('si el servidor no lo deja borrar, se avisa', async () => {
      const mensaje = 'Este plan ya se ha usado en adopciones o pagos: desactívalo en lugar de borrarlo.';
      api(admin(), {
        '/api/admin/plans': () => ({ body: { data: [...adminPlans, sinUso] } }),
        '/api/admin/plans/4': () => errorApi(409, 'PLAN_HAS_HISTORY', mensaje),
      });
      renderRoute('/admin/plans');
      await userEvent.click(within(await tarjeta('Padrino')).getByRole('button', { name: 'Borrar Padrino' }));
      await userEvent.click(
        within(await screen.findByRole('dialog', { name: '¿Borrar el plan Padrino?' })).getByRole('button', {
          name: 'Borrar',
        }),
      );
      expect(await screen.findByText(mensaje)).toBeInTheDocument();
    });
  });
});
