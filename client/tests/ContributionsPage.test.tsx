import type { ContributionsResponse } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const respuesta = (cambios: Partial<ContributionsResponse> = {}): ContributionsResponse => ({
  payments: [
    {
      id: 301,
      adoptionId: 1,
      animal: { id: 1, name: 'Rufo' },
      amount: '5.00',
      periodStart: '2026-11-05',
      periodEnd: '2026-12-04',
      date: '2026-11-05T09:15:00.000Z',
      status: 'completed',
      method: 'simulated',
      reference: 'SIM-A0001-20261105',
    },
    {
      id: 302,
      adoptionId: 7,
      animal: { id: 11, name: 'Lupe' },
      amount: '5.00',
      periodStart: '2026-10-25',
      periodEnd: '2026-11-24',
      date: '2026-10-25T02:00:00.000Z',
      status: 'failed',
      method: 'simulated',
      reference: 'SIM-A0007-20261025-F1',
    },
  ],
  donations: [
    {
      id: 1,
      amount: '20.00',
      date: '2026-06-17T19:00:00.000Z',
      status: 'completed',
      method: 'simulated',
      reference: 'SIM-D0001',
      isAnonymous: false,
    },
  ],
  totals: {
    allTime: '152.00',
    years: [
      { year: 2026, total: '87.00' },
      { year: 2025, total: '65.00' },
    ],
  },
  ...cambios,
});

const conSesion = { '/api/auth/me': { body: { user: sessionUser() } } };

describe('CU-19 Consultar mis aportaciones', () => {
  it('1-3: totales, cuotas con su estado y recibo solo para las cobradas', async () => {
    mockApi({ ...conSesion, '/api/me/contributions': { body: respuesta() } });
    renderRoute('/my-contributions');
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis aportaciones' })).toBeInTheDocument();
    expect(await screen.findByText('87,00 €')).toBeInTheDocument();
    expect(screen.getByText('Aportado en 2026')).toBeInTheDocument();
    expect(screen.getByText('152,00 €')).toBeInTheDocument();
    expect(screen.getByText('Desde que empezaste')).toBeInTheDocument();

    const cuotas = screen.getByRole('tabpanel', { name: 'Cuotas' });
    const filas = within(cuotas).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(2);
    expect(
      within(filas[0] as HTMLElement).getByText('Cuota de Rufo · del 5 nov 2026 al 4 dic 2026'),
    ).toBeInTheDocument();
    expect(within(filas[0] as HTMLElement).getByText('Cobrado')).toBeInTheDocument();
    expect(within(filas[0] as HTMLElement).getByRole('link', { name: 'Recibo' })).toHaveAttribute(
      'href',
      '/my-contributions/receipts/payment/301',
    );
    expect(within(filas[1] as HTMLElement).getByText('Fallido')).toBeInTheDocument();
    expect(within(filas[1] as HTMLElement).queryByRole('link', { name: 'Recibo' })).not.toBeInTheDocument();
  });

  it('pestaña Donaciones', async () => {
    mockApi({ ...conSesion, '/api/me/contributions': { body: respuesta() } });
    renderRoute('/my-contributions');
    await userEvent.click(await screen.findByRole('tab', { name: 'Donaciones' }));
    const donaciones = screen.getByRole('tabpanel', { name: 'Donaciones' });
    expect(within(donaciones).getByText('Donación')).toBeInTheDocument();
    expect(within(donaciones).getByText('SIM-D0001')).toBeInTheDocument();
    expect(within(donaciones).getByRole('link', { name: 'Recibo' })).toHaveAttribute(
      'href',
      '/my-contributions/receipts/donation/1',
    );
  });

  it('el filtro por año pide solo ese año', async () => {
    const { pedidas } = mockApi({ ...conSesion, '/api/me/contributions': { body: respuesta() } });
    renderRoute('/my-contributions');
    await userEvent.selectOptions(await screen.findByLabelText('Año'), '2025');
    await waitFor(() =>
      expect(pedidas('/api/me/contributions').map((u) => u.searchParams.get('year'))).toContain('2025'),
    );
    expect(screen.getByText('Aportado en 2025')).toBeInTheDocument();
    expect(screen.getByText('65,00 €')).toBeInTheDocument();
  });

  it('2a: sin aportaciones', async () => {
    mockApi({
      ...conSesion,
      '/api/me/contributions': { body: { payments: [], donations: [], totals: { allTime: '0.00', years: [] } } },
    });
    renderRoute('/my-contributions');
    expect(await screen.findByText('Todavía no hay aportaciones')).toBeInTheDocument();
  });
});

describe('CU-19 Recibo imprimible', () => {
  it('5: muestra el recibo de una cuota y permite imprimirlo', async () => {
    mockApi({
      ...conSesion,
      '/api/me/payments/301/receipt': {
        body: {
          kind: 'payment',
          id: 301,
          reference: 'SIM-A0001-20261105',
          amount: '5.00',
          method: 'simulated',
          status: 'completed',
          paidAt: '2026-11-05T09:15:00.000Z',
          refundedAt: null,
          animalName: 'Rufo',
          planName: 'Usual',
          periodStart: '2026-11-05',
          periodEnd: '2026-12-04',
          payer: { fullName: 'Lucía Martínez Navarro', email: 'lucia.martinez@correo.test' },
        },
      },
    });
    renderRoute('/my-contributions/receipts/payment/301');
    expect(await screen.findByRole('heading', { level: 1, name: 'Recibo' })).toBeInTheDocument();
    for (const texto of [
      'Lucía Martínez Navarro',
      'lucia.martinez@correo.test',
      'Cuota de Rufo · Plan Usual · del 5 nov 2026 al 4 dic 2026',
      '5,00 €',
      'SIM-A0001-20261105',
      'Pago simulado: no se ha realizado ningún cargo real.',
    ]) {
      expect(screen.getByText(texto)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeInTheDocument();
  });

  it('4b: un recibo devuelto indica la fecha de la devolución', async () => {
    mockApi({
      ...conSesion,
      '/api/me/donations/9/receipt': {
        body: {
          kind: 'donation',
          id: 9,
          reference: 'SIM-D0009',
          amount: '30.00',
          method: 'simulated',
          status: 'refunded',
          paidAt: '2026-11-05T13:00:00.000Z',
          refundedAt: '2026-11-06T08:30:00.000Z',
          animalName: null,
          planName: null,
          periodStart: null,
          periodEnd: null,
          payer: { fullName: 'Sergio Llorens Puig', email: 'sergio.llorens@correo.test' },
        },
      },
    });
    renderRoute('/my-contributions/receipts/donation/9');
    expect(await screen.findByText('Devuelto el 6 de noviembre de 2026')).toBeInTheDocument();
    expect(screen.getByText('Donación')).toBeInTheDocument();
  });

  it('un recibo que no existe muestra un aviso', async () => {
    mockApi({ ...conSesion });
    renderRoute('/my-contributions/receipts/payment/999');
    expect(await screen.findByText('No hemos podido cargar este recibo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a mis aportaciones' })).toHaveAttribute(
      'href',
      '/my-contributions',
    );
  });
});
