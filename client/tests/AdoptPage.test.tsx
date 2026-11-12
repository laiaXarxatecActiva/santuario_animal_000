import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adoption, animal, payment, plans, sessionUser } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';
import { ADOPTER_HOME } from '../src/utils/redirect';

const conSesion = (user = sessionUser()) => ({ body: { user } });

/** API de un adoptante verificado que aún no adopta a Rufo. */
function apiAdoptante(extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    '/api/auth/me': conSesion(),
    '/api/animals/1': { body: animal() },
    '/api/plans': { body: { data: plans } },
    '/api/me/adoptions': { body: { data: [] } },
    ...extra,
  });
}

async function continuar() {
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar con el pago' }));
  return screen.findByRole('dialog', { name: 'Pago simulado' });
}

describe('CU-13 Adoptar un animal', () => {
  it('sin sesión, pide iniciar sesión y vuelve después', async () => {
    mockApi({ '/api/animals/1': { body: animal() }, '/api/plans': { body: { data: plans } } });
    const { router } = renderRoute('/adopt/1');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fadopt%2F1');
  });

  it('muestra el aviso de adopción simbólica, los planes con Usual marcado y el resumen', async () => {
    const { pedidas } = apiAdoptante();
    renderRoute('/adopt/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Adoptar a Rufo' })).toBeInTheDocument();
    expect(
      await screen.findByText(/Es una adopción simbólica: Rufo seguirá viviendo en el santuario/),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Usual/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Simbólica/ })).not.toBeChecked();
    expect(screen.getByText('Rufo · Plan Usual')).toBeInTheDocument();
    expect(screen.getByText('5,00 € al mes. Primer cobro hoy.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/animals/1');
    expect(pedidas('/api/me/adoptions')[0]?.searchParams.get('animalId')).toBe('1');
  });

  it('al cambiar de plan se actualiza el resumen', async () => {
    apiAdoptante();
    renderRoute('/adopt/1');
    await userEvent.click(await screen.findByRole('radio', { name: /Extraordinaria/ }));
    expect(screen.getByText('Rufo · Plan Extraordinaria')).toBeInTheDocument();
    expect(screen.getByText('12,00 € al mes. Primer cobro hoy.')).toBeInTheDocument();
  });

  it('crea la adopción con el plan elegido y abre el pago simulado', async () => {
    const { enviados } = apiAdoptante({
      '/api/adoptions': { status: 201, body: adoption({ plan: { id: 1, name: 'Simbólica', monthlyAmount: '1.00' } }) },
    });
    renderRoute('/adopt/1');
    await userEvent.click(await screen.findByRole('radio', { name: /Simbólica/ }));
    const dialogo = await continuar();
    expect(enviados('/api/adoptions')).toEqual([{ animalId: 1, planId: 1 }]);
    expect(within(dialogo).getByText('Adopción de Rufo · Plan Simbólica')).toBeInTheDocument();
    expect(within(dialogo).getByText('1,00 €')).toBeInTheDocument();
    expect(within(dialogo).getByText('Pago simulado: no se realizará ningún cargo real.')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Simular pago correcto' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Simular pago fallido' })).toBeInTheDocument();
  });

  it('con el pago correcto, va a su inicio con el aviso de bienvenida', async () => {
    const { enviados } = apiAdoptante({
      '/api/adoptions': { status: 201, body: adoption() },
      '/api/me/adoptions/40/pay': {
        body: { adoption: adoption({ status: 'active', canPay: false }), payment: payment() },
      },
    });
    const { router } = renderRoute('/adopt/1');
    const dialogo = await continuar();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago correcto' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(ADOPTER_HOME));
    expect(enviados('/api/me/adoptions/40/pay')).toEqual([{ simulatedOutcome: 'success' }]);
    expect(await screen.findByText('¡Ya adoptas a Rufo! Te hemos enviado un email de bienvenida.')).toBeInTheDocument();
  });

  it('con el pago fallido, se queda en la página con el error y puede reintentar (6a)', async () => {
    let intentos = 0;
    apiAdoptante({
      '/api/adoptions': { status: 201, body: adoption() },
      '/api/me/adoptions/40/pay': (_url: URL, { body }: Peticion) => {
        intentos += 1;
        const ok = (body as { simulatedOutcome: string }).simulatedOutcome === 'success';
        return {
          body: {
            adoption: adoption(ok ? { status: 'active', canPay: false } : {}),
            payment: payment(ok ? {} : { status: 'failed', failureReason: 'Pago rechazado por la pasarela simulada.' }),
          },
        };
      },
    });
    const { router } = renderRoute('/adopt/1');
    const dialogo = await continuar();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago fallido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El pago no se ha completado. Puedes intentarlo de nuevo ahora o desde «Mis animales» durante 7 días.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/adopt/1');

    await userEvent.click(screen.getByRole('button', { name: 'Pagar ahora' }));
    const otra = await screen.findByRole('dialog', { name: 'Pago simulado' });
    await userEvent.click(within(otra).getByRole('button', { name: 'Simular pago correcto' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(ADOPTER_HOME));
    expect(intentos).toBe(2);
  });

  it('un trabajador ve que no puede adoptar (2a)', async () => {
    mockApi({
      '/api/auth/me': conSesion(sessionUser({ role: 'caretaker' })),
      '/api/animals/1': { body: animal() },
      '/api/plans': { body: { data: plans } },
    });
    renderRoute('/adopt/1');
    expect(await screen.findByText('Las cuentas de trabajador no pueden adoptar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar con el pago' })).not.toBeInTheDocument();
  });

  it('con el email sin verificar, pide verificarlo con el botón de reenviar (2b), sin repetir el aviso', async () => {
    mockApi({
      '/api/auth/me': conSesion(sessionUser({ emailVerified: false })),
      '/api/animals/1': { body: animal() },
      '/api/plans': { body: { data: plans } },
    });
    renderRoute('/adopt/1');
    expect(await screen.findByText('Verifica tu email para adoptar.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reenviar email' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Continuar con el pago' })).not.toBeInTheDocument();
  });

  it('si ya tiene una adopción pendiente, ofrece pagarla (5a)', async () => {
    apiAdoptante({
      '/api/me/adoptions': { body: { data: [adoption()] } },
      '/api/me/adoptions/40/pay': {
        body: { adoption: adoption({ status: 'active', canPay: false }), payment: payment() },
      },
    });
    const { router } = renderRoute('/adopt/1');
    expect(await screen.findByText('Tu adopción de Rufo está pendiente de pago.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar con el pago' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pagar ahora' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Pago simulado' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago correcto' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(ADOPTER_HOME));
  });

  it('si ya lo adopta, lo dice sin ofrecer el pago (5a)', async () => {
    apiAdoptante({
      '/api/me/adoptions': { body: { data: [adoption({ status: 'active', canPay: false })] } },
    });
    renderRoute('/adopt/1');
    expect(await screen.findByText('Ya tienes una adopción en curso de Rufo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagar ahora' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver la ficha de Rufo' })).toHaveAttribute('href', '/animals/1');
  });

  it('las adopciones ya cerradas no cuentan', async () => {
    apiAdoptante({
      '/api/me/adoptions': { body: { data: [adoption({ status: 'cancelled', canPay: false })] } },
    });
    renderRoute('/adopt/1');
    expect(await screen.findByRole('button', { name: 'Continuar con el pago' })).toBeInTheDocument();
  });

  it('si el animal no admite adopciones, lo explica y no muestra el formulario', async () => {
    apiAdoptante({ '/api/animals/1': { body: animal({ isAdoptable: false }) } });
    renderRoute('/adopt/1');
    expect(await screen.findByText('Este animal ya no admite adopciones.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar con el pago' })).not.toBeInTheDocument();
  });

  it('si el animal no existe, muestra «no disponible»', async () => {
    apiAdoptante({ '/api/animals/1': errorApi(404, 'NOT_FOUND', 'No encontrado.') });
    renderRoute('/adopt/1');
    expect(await screen.findByRole('heading', { name: 'Este animal no está disponible' })).toBeInTheDocument();
  });

  it('si el animal deja de ser adoptable mientras tanto, lo dice (5b)', async () => {
    apiAdoptante({
      '/api/adoptions': errorApi(422, 'ANIMAL_NOT_ADOPTABLE', 'Este animal no admite adopciones.'),
    });
    renderRoute('/adopt/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar con el pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Este animal ya no admite adopciones.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('si el plan ya no está activo, recarga los planes y pide elegir otro (5c)', async () => {
    let peticionesPlanes = 0;
    apiAdoptante({
      '/api/plans': () => {
        peticionesPlanes += 1;
        return { body: { data: plans } };
      },
      '/api/adoptions': errorApi(422, 'PLAN_NOT_AVAILABLE', 'Ese plan no está disponible.'),
    });
    renderRoute('/adopt/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar con el pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Este plan ya no está disponible. Elige otro.');
    await waitFor(() => expect(peticionesPlanes).toBe(2));
  });
});
