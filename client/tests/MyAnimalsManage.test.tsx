import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { activeAdoption, adoption, plans, sessionUser } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

const tarjeta = async (nombre: string) =>
  (await screen.findByRole('heading', { level: 2, name: nombre })).closest('article') as HTMLElement;

const abrirMenu = async (rufo: HTMLElement) => {
  await userEvent.click(within(rufo).getByRole('button', { name: 'Más acciones de Rufo' }));
  return within(rufo).getByRole('menu');
};

describe('CU-20 Cambiar de plan (Mis animales)', () => {
  it('1-5: elige otro plan en la tarjeta, lo guarda y muestra el cambio programado', async () => {
    let actual = activeAdoption();
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/plans': { body: { data: plans } },
      '/api/me/adoptions': () => ({ body: { data: [actual] } }),
      '/api/me/adoptions/1/plan': () => {
        actual = activeAdoption({ nextPlan: { id: 3, name: 'Extraordinaria', monthlyAmount: '12.00' } });
        return { body: actual };
      },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    await userEvent.click(within(await abrirMenu(rufo)).getByRole('menuitem', { name: 'Cambiar plan' }));

    const formulario = within(rufo).getByRole('group', { name: 'Cambiar plan' });
    expect(
      within(formulario).getByText('El cambio se aplicará a partir del 5 de diciembre de 2026.'),
    ).toBeInTheDocument();
    expect(within(formulario).getByRole('radio', { name: /Usual.*plan actual/ })).toBeChecked();
    await userEvent.click(within(formulario).getByRole('radio', { name: /Extraordinaria/ }));
    await userEvent.click(within(formulario).getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('Cambio de plan guardado. Te hemos enviado un email de confirmación.'),
    ).toBeInTheDocument();
    expect(enviados('/api/me/adoptions/1/plan')).toEqual([{ planId: 3 }]);
    expect(
      await within(rufo).findByText('Desde la próxima cuota: plan Extraordinaria (12,00 €/mes)'),
    ).toBeInTheDocument();
    expect(within(rufo).queryByRole('group', { name: 'Cambiar plan' })).not.toBeInTheDocument();
  });

  it('3a: elegir el plan actual anula el cambio programado', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/plans': { body: { data: plans } },
      '/api/me/adoptions': {
        body: { data: [activeAdoption({ nextPlan: { id: 3, name: 'Extraordinaria', monthlyAmount: '12.00' } })] },
      },
      '/api/me/adoptions/1/plan': { body: activeAdoption() },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    await userEvent.click(within(await abrirMenu(rufo)).getByRole('menuitem', { name: 'Cambiar plan' }));
    const formulario = within(rufo).getByRole('group', { name: 'Cambiar plan' });
    expect(within(formulario).getByRole('radio', { name: /Extraordinaria/ })).toBeChecked();
    await userEvent.click(within(formulario).getByRole('radio', { name: /Usual/ }));
    await userEvent.click(within(formulario).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Se mantiene tu plan actual.')).toBeInTheDocument();
    expect(enviados('/api/me/adoptions/1/plan')).toEqual([{ planId: 2 }]);
  });

  it('«Cancelar» cierra el desplegable sin guardar', async () => {
    const { pedidas } = mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/plans': { body: { data: plans } },
      '/api/me/adoptions': { body: { data: [activeAdoption()] } },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    await userEvent.click(within(await abrirMenu(rufo)).getByRole('menuitem', { name: 'Cambiar plan' }));
    await userEvent.click(within(rufo).getByRole('button', { name: 'Cancelar' }));
    expect(within(rufo).queryByRole('group', { name: 'Cambiar plan' })).not.toBeInTheDocument();
    expect(pedidas('/api/me/adoptions/1/plan')).toEqual([]);
  });

  it('1a: pausada o con la baja solicitada no ofrece cambiar de plan', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/adoptions': {
        body: {
          data: [
            activeAdoption({ cancelRequested: true, endDate: '2026-12-04', nextBillingDate: null }),
            adoption({
              id: 7,
              status: 'paused',
              startDate: '2025-09-05',
              animal: { id: 11, name: 'Lupe', species: 'Buitre leonado', coverPhoto: null },
            }),
          ],
        },
      },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).queryByRole('button', { name: 'Más acciones de Rufo' })).not.toBeInTheDocument();
    const lupe = await tarjeta('Lupe');
    await userEvent.click(within(lupe).getByRole('button', { name: 'Más acciones de Lupe' }));
    const menu = within(lupe).getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Cambiar plan' })).not.toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Darme de baja' })).toBeInTheDocument();
  });
});

describe('CU-21 Darse de baja (Mis animales)', () => {
  it('1-6: explica hasta cuándo sigue activa, pide confirmación y muestra «Activa hasta…»', async () => {
    let actual = activeAdoption();
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/adoptions': () => ({ body: { data: [actual] } }),
      '/api/me/adoptions/1/cancel': () => {
        actual = activeAdoption({ cancelRequested: true, endDate: '2026-12-04', nextBillingDate: null });
        return { body: actual };
      },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    await userEvent.click(within(await abrirMenu(rufo)).getByRole('menuitem', { name: 'Darme de baja' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Darte de baja de Rufo' });
    expect(
      within(dialogo).getByText(
        'Tu adopción seguirá activa hasta el 4 de diciembre de 2026 y después no se te volverá a cobrar. No se hacen devoluciones parciales.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar la baja' }));

    expect(
      await screen.findByText('Hemos registrado tu baja. Te hemos enviado un email de confirmación.'),
    ).toBeInTheDocument();
    expect(enviados('/api/me/adoptions/1/cancel')).toEqual([{}]);
    expect(
      await within(rufo).findByText('Activa hasta el 4 de diciembre de 2026. No se te volverá a cobrar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('3a: cancelar la confirmación no cambia nada', async () => {
    const { pedidas } = mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/adoptions': { body: { data: [activeAdoption()] } },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    await userEvent.click(within(await abrirMenu(rufo)).getByRole('menuitem', { name: 'Darme de baja' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(pedidas('/api/me/adoptions/1/cancel')).toEqual([]);
  });

  it('1a: una pendiente se cancela sin cobros', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/adoptions': { body: { data: [adoption()] } },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    await userEvent.click(within(await abrirMenu(rufo)).getByRole('menuitem', { name: 'Darme de baja' }));
    expect(
      within(await screen.findByRole('dialog')).getByText(
        'La adopción se cancelará ahora. Como no has completado el pago, no se te cobrará nada.',
      ),
    ).toBeInTheDocument();
  });

  it('muestra el error de la API si la baja no se puede hacer', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/adoptions': { body: { data: [activeAdoption()] } },
      '/api/me/adoptions/1/cancel': errorApi(409, 'ADOPTION_CANCEL_ALREADY_REQUESTED', 'Mensaje del servidor'),
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    await userEvent.click(within(await abrirMenu(rufo)).getByRole('menuitem', { name: 'Darme de baja' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar la baja' }));
    expect(await screen.findByText('Ya habías solicitado la baja de esta adopción.')).toBeInTheDocument();
  });
});

describe('CU-49 Cambiar la forma de pago (Mis animales)', () => {
  it('la tarjeta dice la forma de pago y se cambia desde el menú «⋯»', async () => {
    let actual = activeAdoption();
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/adoptions': () => ({ body: { data: [actual] } }),
      '/api/me/adoptions/1/payment-mode': () => {
        actual = activeAdoption({ paymentMode: 'manual' });
        return { body: actual };
      },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).getByText('Pago automático cada mes')).toBeInTheDocument();
    await userEvent.click(within(await abrirMenu(rufo)).getByRole('menuitem', { name: 'Forma de pago' }));

    const formulario = within(rufo).getByRole('group', { name: 'Forma de pago' });
    expect(within(formulario).getByRole('radio', { name: /Automático/ })).toBeChecked();
    await userEvent.click(within(formulario).getByRole('radio', { name: /Manual/ }));
    await userEvent.click(within(formulario).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Forma de pago guardada.')).toBeInTheDocument();
    expect(enviados('/api/me/adoptions/1/payment-mode')).toEqual([{ paymentMode: 'manual' }]);
    expect(await within(rufo).findByText('Pago manual: te avisaremos de cada cuota')).toBeInTheDocument();
  });

  it('con la baja solicitada no se ofrece', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/adoptions': { body: { data: [activeAdoption({ cancelRequested: true, endDate: '2026-12-04' })] } },
    });
    renderRoute('/my-animals');
    // Sin acciones que ofrecer, la tarjeta no muestra el menú «⋯».
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).queryByRole('button', { name: 'Más acciones de Rufo' })).not.toBeInTheDocument();
    expect(within(rufo).queryByText('Pago automático cada mes')).not.toBeInTheDocument();
  });

  it('con pago manual y la cuota cerca, avisa del plazo y deja pagarla', async () => {
    mockApi({
      '/api/auth/me': { body: { user: sessionUser() } },
      '/api/me/adoptions': {
        body: { data: [activeAdoption({ paymentMode: 'manual', canPay: true, paymentDeadline: '2026-12-11' })] },
      },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(
      within(rufo).getByText(
        'La cuota de Rufo vence el 5 de diciembre de 2026. Puedes pagarla hasta el 11 de diciembre de 2026 sin que la adopción se pause.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(within(rufo).getByRole('button', { name: 'Pagar la cuota' }));
    expect(await screen.findByRole('dialog', { name: 'Pago simulado' })).toBeInTheDocument();
  });
});
