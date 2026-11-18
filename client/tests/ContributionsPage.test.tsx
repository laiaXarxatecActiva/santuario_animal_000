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
    // CU-19 5 (Fase 3): el recibo es un PDF que se puede ver (e imprimir) o descargar.
    const ver = within(filas[0] as HTMLElement).getByRole('link', { name: /^Ver el recibo/ });
    expect(ver).toHaveAttribute('href', '/api/me/payments/301/receipt.pdf');
    expect(ver).toHaveAttribute('target', '_blank');
    const descargar = within(filas[0] as HTMLElement).getByRole('link', { name: /^Descargar el recibo/ });
    expect(descargar).toHaveAttribute('href', '/api/me/payments/301/receipt.pdf?download=1');
    expect(descargar).toHaveAttribute('download');
    expect(within(filas[1] as HTMLElement).getByText('Fallido')).toBeInTheDocument();
    expect(within(filas[1] as HTMLElement).queryByRole('link', { name: /recibo/ })).not.toBeInTheDocument();
  });

  it('pestaña Donaciones', async () => {
    mockApi({ ...conSesion, '/api/me/contributions': { body: respuesta() } });
    renderRoute('/my-contributions');
    await userEvent.click(await screen.findByRole('tab', { name: 'Donaciones' }));
    const donaciones = screen.getByRole('tabpanel', { name: 'Donaciones' });
    expect(within(donaciones).getByText('Donación')).toBeInTheDocument();
    expect(within(donaciones).getByText('SIM-D0001')).toBeInTheDocument();
    expect(within(donaciones).getByRole('link', { name: /^Ver el recibo/ })).toHaveAttribute(
      'href',
      '/api/me/donations/1/receipt.pdf',
    );
    expect(within(donaciones).getByRole('link', { name: /^Descargar el recibo/ })).toHaveAttribute(
      'href',
      '/api/me/donations/1/receipt.pdf?download=1',
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

describe('CU-19 Recibo en PDF (Fase 3)', () => {
  it('los enlaces llevan el nombre accesible con la referencia', async () => {
    mockApi({ ...conSesion, '/api/me/contributions': { body: respuesta() } });
    renderRoute('/my-contributions');
    expect(await screen.findByRole('link', { name: 'Ver el recibo SIM-A0001-20261105 (PDF)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Descargar el recibo SIM-A0001-20261105 (PDF)' })).toBeInTheDocument();
  });

  it('la antigua página HTML del recibo ya no existe', async () => {
    mockApi({ ...conSesion });
    renderRoute('/my-contributions/receipts/payment/301');
    expect(await screen.findByRole('heading', { level: 1, name: 'Esta página ha volado lejos' })).toBeInTheDocument();
  });
});
