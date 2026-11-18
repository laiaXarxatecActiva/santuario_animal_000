import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminPlans, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';

type Respuesta = { status?: number; body?: unknown };

function api(user = admin(), extra: Record<string, (u: URL, p: Peticion) => Respuesta> = {}) {
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

describe('CU-40 Gestionar planes de adopción', () => {
  it('el enlace «Planes» del menú solo lo ve el administrador', async () => {
    api();
    const vistaAdmin = renderRoute('/admin');
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

  it('3: guarda los cambios del plan', async () => {
    const { enviados } = api(admin(), {
      '/api/admin/plans/1': () => ({ body: { ...adminPlans[0], name: 'Simbólica+' } }),
    });
    renderRoute('/admin/plans');
    const simbolica = await tarjeta('Simbólica');
    await userEvent.type(within(simbolica).getByLabelText('Nombre'), '+');
    await userEvent.click(within(simbolica).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Plan guardado')).toBeInTheDocument();
    expect(enviados('/api/admin/plans/1')).toEqual([
      {
        name: 'Simbólica+',
        monthlyAmount: '1,00',
        description: 'Para quien quiere colaborar con lo mínimo.',
        isDefault: false,
        isActive: true,
        confirmAmountChange: false,
      },
    ]);
  });

  it('3a: cambiar el importe con adopciones activas avisa y pide confirmación antes de guardar', async () => {
    const { enviados } = api(admin(), {
      '/api/admin/plans/2': () => ({ body: { ...adminPlans[1], monthlyAmount: '6.00' } }),
    });
    renderRoute('/admin/plans');
    const usual = await tarjeta('Usual');
    const importe = within(usual).getByLabelText('Importe mensual (€)');
    await userEvent.clear(importe);
    await userEvent.type(importe, '6');
    await userEvent.click(within(usual).getByRole('button', { name: 'Guardar' }));

    expect(
      await within(usual).findByText(
        'El nuevo importe se cobrará a las 5 adopciones activas de este plan desde su siguiente cuota.',
      ),
    ).toBeInTheDocument();
    expect(enviados('/api/admin/plans/2')).toHaveLength(0);

    await userEvent.click(within(usual).getByRole('button', { name: 'Confirmar y guardar' }));
    await waitFor(() => expect(enviados('/api/admin/plans/2')).toHaveLength(1));
    expect(enviados('/api/admin/plans/2')[0]).toMatchObject({ monthlyAmount: '6', confirmAmountChange: true });
  });

  it('3a: sin adopciones activas, el importe se guarda sin aviso', async () => {
    const { enviados } = api(admin(), { '/api/admin/plans/1': () => ({ body: adminPlans[0] }) });
    renderRoute('/admin/plans');
    const simbolica = await tarjeta('Simbólica');
    const importe = within(simbolica).getByLabelText('Importe mensual (€)');
    await userEvent.clear(importe);
    await userEvent.type(importe, '2');
    await userEvent.click(within(simbolica).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enviados('/api/admin/plans/1')).toHaveLength(1));
  });

  it('3b: valida el importe antes de enviar', async () => {
    const { pedidas } = api();
    renderRoute('/admin/plans');
    const simbolica = await tarjeta('Simbólica');
    const importe = within(simbolica).getByLabelText('Importe mensual (€)');
    await userEvent.clear(importe);
    await userEvent.type(importe, '0');
    await userEvent.click(within(simbolica).getByRole('button', { name: 'Guardar' }));
    expect(await within(simbolica).findByText('El importe debe ser mayor que 0.')).toBeInTheDocument();
    expect(pedidas('/api/admin/plans/1')).toHaveLength(0);
  });

  it('A1: el error del servidor sale junto al campo', async () => {
    const mensaje = 'No se puede desactivar el plan por defecto sin elegir antes otro.';
    api(admin(), {
      '/api/admin/plans/2': () =>
        errorApi(422, 'DEFAULT_PLAN_MUST_BE_ACTIVE', mensaje, [{ field: 'isActive', message: mensaje }]),
    });
    renderRoute('/admin/plans');
    const usual = await tarjeta('Usual');
    await userEvent.click(within(usual).getByRole('switch', { name: 'Activo' }));
    await userEvent.click(within(usual).getByRole('button', { name: 'Guardar' }));
    expect(await within(usual).findByText(mensaje)).toBeInTheDocument();
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
