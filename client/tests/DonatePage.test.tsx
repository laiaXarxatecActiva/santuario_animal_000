import type { DonationResultDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';

const resultado = (cambios: Partial<DonationResultDto> = {}): DonationResultDto => ({
  id: 50,
  status: 'completed',
  amount: '20.00',
  method: 'simulated',
  reference: 'SIM-20261117-ABCDEF',
  paidAt: '2026-11-17T10:00:00.000Z',
  failureReason: null,
  donorName: 'Marta',
  donorEmail: 'marta@correo.test',
  isAnonymous: false,
  ...cambios,
});

/** Responde a POST /api/donations con lo que pida el pago simulado. */
const donaciones = (_url: URL, peticion: Peticion) => {
  const cuerpo = peticion.body as { amount: string; simulatedOutcome: string };
  return {
    status: 201,
    body:
      cuerpo.simulatedOutcome === 'failure'
        ? resultado({ status: 'failed', paidAt: null, failureReason: 'Rechazado', amount: cuerpo.amount })
        : resultado({ amount: cuerpo.amount }),
  };
};

describe('CU-05 Hacer una donación', () => {
  it('1-7: elige un importe, paga en la ventana simulada y ve el agradecimiento con el recibo', async () => {
    const { enviados } = mockApi({ '/api/donations': donaciones });
    renderRoute('/donate');
    expect(await screen.findByRole('heading', { level: 1, name: 'Donar' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '20 €' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: '50 €' }));
    expect(screen.getByLabelText('Importe (€)')).toHaveValue('50');
    await userEvent.type(screen.getByLabelText('Nombre (opcional)'), 'Marta');
    await userEvent.type(screen.getByLabelText('Email (opcional)'), 'marta@correo.test');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Pago simulado' });
    expect(within(dialogo).getByText('Donación')).toBeInTheDocument();
    expect(within(dialogo).getByText('50,00 €')).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago correcto' }));

    expect(
      await screen.findByText('¡Gracias por tu donación! Te hemos enviado el recibo por email.'),
    ).toBeInTheDocument();
    expect(enviados('/api/donations')).toEqual([
      {
        amount: '50.00',
        donorName: 'Marta',
        donorEmail: 'marta@correo.test',
        isAnonymous: false,
        simulatedOutcome: 'success',
      },
    ]);
    expect(screen.getByText('SIM-20261117-ABCDEF')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir recibo' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('«Otra»: importe libre sin mínimo; 3a: un importe no válido da error en el campo', async () => {
    const { pedidas } = mockApi({ '/api/donations': donaciones });
    renderRoute('/donate');
    const importe = await screen.findByLabelText('Importe (€)');
    await userEvent.clear(importe);
    await userEvent.type(importe, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    expect(await screen.findByText('El importe debe ser mayor que 0.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Otra' })).toBeChecked();
    await userEvent.clear(importe);
    await userEvent.type(importe, '0,50');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    expect(within(await screen.findByRole('dialog')).getByText('0,50 €')).toBeInTheDocument();
    expect(pedidas('/api/donations')).toEqual([]);
  });

  it('7a: sin email, el recibo solo se ve en pantalla', async () => {
    mockApi({
      '/api/donations': (url, peticion) => {
        const r = donaciones(url, peticion);
        return { ...r, body: { ...r.body, donorName: null, donorEmail: null } };
      },
    });
    renderRoute('/donate');
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar con el pago' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Simular pago correcto' }));
    expect(
      await screen.findByText('¡Gracias por tu donación! Puedes imprimir el recibo desde esta página.'),
    ).toBeInTheDocument();
  });

  it('5a: si el pago falla, vuelve al formulario con los datos y deja reintentar', async () => {
    const { enviados } = mockApi({ '/api/donations': donaciones });
    renderRoute('/donate');
    await userEvent.type(await screen.findByLabelText('Mensaje (opcional)'), 'Para la comida');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Simular pago fallido' }));
    expect(await screen.findByText(/El pago no se ha completado/)).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje (opcional)')).toHaveValue('Para la comida');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Simular pago correcto' }));
    expect(await screen.findByText(/¡Gracias por tu donación!/)).toBeInTheDocument();
    expect(enviados('/api/donations').map((b: { simulatedOutcome: string }) => b.simulatedOutcome)).toEqual([
      'failure',
      'success',
    ]);
  });

  it('2: con sesión de adoptante, el nombre y el email vienen rellenos', async () => {
    mockApi({ '/api/auth/me': { body: { user: sessionUser() } } });
    renderRoute('/donate');
    await waitFor(() => expect(screen.getByLabelText('Email (opcional)')).toHaveValue('lucia.martinez@correo.test'));
    expect(screen.getByLabelText('Nombre (opcional)')).toHaveValue('Lucía Martínez Navarro');
  });

  it('6a: un trabajador puede donar, pero sin datos de su cuenta', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } } });
    renderRoute('/donate');
    expect(await screen.findByRole('heading', { level: 1, name: 'Donar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email (opcional)')).toHaveValue('');
  });
});
