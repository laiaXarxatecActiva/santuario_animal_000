import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { activeAdoption, adoption, historyEvent, historyPage, payment, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';
import { rellenarTarjeta } from './helpers/tarjeta';

const conSesion = (user = sessionUser()) => ({ body: { user } });
const conAdopciones = (data: unknown[]) => ({
  '/api/auth/me': conSesion(),
  '/api/me/adoptions': { body: { data } },
});

const tarjeta = async (nombre: string) =>
  (await screen.findByRole('heading', { level: 2, name: nombre })).closest('article') as HTMLElement;

describe('CU-15 Consultar «Mis animales»', () => {
  it('sin sesión, pide iniciar sesión y vuelve después', async () => {
    mockApi({});
    const { router } = renderRoute('/my-animals');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fmy-animals');
  });

  it('un trabajador no tiene acceso', async () => {
    mockApi({ '/api/auth/me': conSesion(sessionUser({ role: 'caretaker' })) });
    renderRoute('/my-animals');
    expect(await screen.findByText('No tienes acceso a esta página')).toBeInTheDocument();
  });

  it('2a: sin adopciones, invita a ver los animales', async () => {
    mockApi(conAdopciones([]));
    renderRoute('/my-animals');
    expect(await screen.findByText('Todavía no has adoptado a ningún animal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver animales' })).toHaveAttribute('href', '/animals');
  });

  it('2: muestra el plan, el estado, el inicio y la próxima noticia prevista', async () => {
    mockApi(conAdopciones([activeAdoption()]));
    renderRoute('/my-animals');
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis animales' })).toBeInTheDocument();
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).getByText('Activa')).toBeInTheDocument();
    expect(within(rufo).getByText('Buitre leonado')).toBeInTheDocument();
    expect(within(rufo).getByText('Plan Usual · 5,00 €/mes · desde el 5 de septiembre de 2025')).toBeInTheDocument();
    expect(within(rufo).getByText('Próxima noticia prevista: hacia el 24 de noviembre de 2026')).toBeInTheDocument();
    expect(within(rufo).getByRole('link', { name: 'Ver la ficha de Rufo' })).toHaveAttribute('href', '/my-animals/1');
  });

  it('2: indica el cambio de plan programado', async () => {
    mockApi(conAdopciones([activeAdoption({ nextPlan: { id: 3, name: 'Extraordinaria', monthlyAmount: '12.00' } })]));
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).getByText('Desde la próxima cuota: plan Extraordinaria (12,00 €/mes)')).toBeInTheDocument();
  });

  it('2b: con la baja solicitada, indica hasta cuándo sigue activa', async () => {
    mockApi(conAdopciones([activeAdoption({ cancelRequested: true, endDate: '2026-11-29', nextBillingDate: null })]));
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(
      within(rufo).getByText('Activa hasta el 29 de noviembre de 2026. No se te volverá a cobrar.'),
    ).toBeInTheDocument();
  });

  it('CU-14: una adopción pendiente se puede pagar desde aquí', async () => {
    let actual = adoption();
    const { enviados } = mockApi({
      '/api/auth/me': conSesion(),
      '/api/me/adoptions': () => ({ body: { data: [actual] } }),
      '/api/me/adoptions/40/pay': () => {
        actual = activeAdoption({ id: 40 });
        return { body: { adoption: actual, payment: payment() } };
      },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).getByText('Pendiente de pago')).toBeInTheDocument();
    expect(within(rufo).getByText('Tu adopción de Rufo está pendiente de pago.')).toBeInTheDocument();
    await userEvent.click(within(rufo).getByRole('button', { name: 'Pagar ahora' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Pago simulado' });
    await rellenarTarjeta();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago correcto' }));
    expect(await screen.findByText('¡Ya adoptas a Rufo! Te hemos enviado un email de bienvenida.')).toBeInTheDocument();
    expect(enviados('/api/me/adoptions/40/pay')).toEqual([{ simulatedOutcome: 'success' }]);
    expect(await within(await tarjeta('Rufo')).findByText('Activa')).toBeInTheDocument();
  });

  it('CU-14 3a: si el pago falla, lo explica en un aviso emergente y deja reintentar', async () => {
    mockApi({
      ...conAdopciones([adoption({ status: 'paused', startDate: '2025-09-05' })]),
      '/api/me/adoptions/40/pay': {
        body: { adoption: adoption({ status: 'paused' }), payment: payment({ status: 'failed' }) },
      },
    });
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).getByText('Pausada')).toBeInTheDocument();
    expect(within(rufo).getByText('No hemos podido cobrar la última cuota de Rufo.')).toBeInTheDocument();
    await userEvent.click(within(rufo).getByRole('button', { name: 'Pagar ahora' }));
    await rellenarTarjeta();
    await userEvent.click(await screen.findByRole('button', { name: 'Simular pago fallido' }));
    const aviso = await screen.findByRole('dialog', { name: 'Pago rechazado' });
    expect(within(aviso).getByText(/El pago no se ha completado/)).toBeInTheDocument();
    await userEvent.click(within(aviso).getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(rufo).getByRole('button', { name: 'Pagar ahora' })).toBeInTheDocument();
  });

  it('CU-14 1a: una pendiente caducada no ofrece pagar', async () => {
    mockApi(conAdopciones([adoption({ canPay: false })]));
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).getByText(/El plazo para pagar esta adopción ha terminado/)).toBeInTheDocument();
    expect(within(rufo).queryByRole('button', { name: 'Pagar ahora' })).not.toBeInTheDocument();
  });

  it('3 y 2c: las cerradas no son tarjetas; su cierre se cuenta en el historial con delicadeza', async () => {
    mockApi({
      ...conAdopciones([
        activeAdoption(),
        adoption({
          id: 3,
          status: 'finished',
          animal: { id: 12, name: 'Faro', species: 'Alimoche', coverPhoto: null },
          startDate: '2026-01-09',
          endDate: '2026-10-23',
          endReason: 'animal_deceased',
          canPay: false,
        }),
      ]),
      '/api/me/history': {
        body: historyPage([
          historyEvent({
            id: 'ended-3',
            type: 'ended',
            date: '2026-10-23',
            animal: { id: 12, name: 'Faro' },
            amount: null,
            periodStart: null,
            endStatus: 'finished',
            endReason: 'animal_deceased',
          }),
        ]),
      },
    });
    renderRoute('/my-animals');
    await tarjeta('Rufo');
    expect(screen.queryByRole('heading', { level: 2, name: 'Faro' })).not.toBeInTheDocument();
    // El historial empieza plegado: se despliega pulsando «Historial».
    const titulo = screen.getByRole('heading', { level: 2, name: 'Historial' });
    await userEvent.click(titulo);
    const historial = titulo.closest('section') as HTMLElement;
    expect(await within(historial).findByText('Terminó la adopción de Faro. Faro nos ha dejado.')).toBeInTheDocument();
    expect(within(historial).getByText('23 oct 2026')).toBeInTheDocument();
    expect(within(historial).getByRole('link', { name: '¿Quieres continuar con otro animal?' })).toHaveAttribute(
      'href',
      '/animals',
    );
  });

  it('muestra un error con «Reintentar» si no se pueden cargar', async () => {
    mockApi({ '/api/auth/me': conSesion(), '/api/me/adoptions': { status: 500, body: {} } });
    renderRoute('/my-animals');
    expect(await screen.findByText('No hemos podido cargar tus adopciones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('CU-15 La foto de la tarjeta abre la ficha del animal', () => {
  it('pulsar la foto de Rufo abre su ficha, sin añadir un segundo enlace para el teclado', async () => {
    mockApi(conAdopciones([activeAdoption()]));
    const { router } = renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    const enlaceFoto = rufo.querySelector('a[href="/my-animals/1"][aria-hidden="true"]');
    expect(enlaceFoto).not.toBeNull();
    expect(enlaceFoto).toHaveAttribute('tabindex', '-1');
    // Para lectores de pantalla y teclado, el enlace a la ficha sigue siendo el botón.
    expect(within(rufo).getByRole('link', { name: 'Ver la ficha de Rufo' })).toHaveAttribute('href', '/my-animals/1');

    await userEvent.click(enlaceFoto?.querySelector('img') as HTMLElement);
    await waitFor(() => expect(router.state.location.pathname).toBe('/my-animals/1'));
  });
});
