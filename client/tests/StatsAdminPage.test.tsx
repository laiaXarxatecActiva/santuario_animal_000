import type { AdminStatsDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const estadisticas = (overrides: Partial<AdminStatsDto> = {}): AdminStatsDto => ({
  range: { from: '2026-10', to: '2026-11' },
  revenueByMonth: [
    { month: '2026-10', fees: '86.00', donations: '30.00' },
    { month: '2026-11', fees: '91.00', donations: '347.40' },
  ],
  adoptionsByMonth: [
    { month: '2026-10', started: 2, ended: 1 },
    { month: '2026-11', started: 3, ended: 0 },
  ],
  mostAdopted: [
    { animal: { id: 1, name: 'Rufo' }, activeAdoptions: 3 },
    { animal: { id: 2, name: 'Greta' }, activeAdoptions: 1 },
  ],
  withoutAdopters: [{ id: 14, name: 'Pipa', species: 'Buitre negro' }],
  activeByPlan: [
    { plan: { id: 2, name: 'Usual' }, count: 5 },
    { plan: { id: 3, name: 'Extraordinaria' }, count: 2 },
  ],
  ...overrides,
});

const escritorio = { animalsByStatus: {}, activeAdoptions: 0, pendingAdoptions: 0, updateAlerts: [] };

function api(user = admin(), stats = estadisticas()) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/stats': { body: stats },
    '/api/admin/dashboard': { body: escritorio },
  });
}

const tarjeta = async (titulo: string) =>
  (await screen.findByRole('heading', { level: 2, name: titulo })).closest('section') as HTMLElement;

describe('CU-41 Consultar estadísticas', () => {
  it('el enlace «Estadísticas» del menú solo lo ve el administrador', async () => {
    api();
    const vista = renderRoute('/admin');
    // El apartado «Administración» empieza cerrado en el escritorio.
    await userEvent.click(await screen.findByRole('button', { name: 'Administración' }));
    expect(await screen.findByRole('link', { name: 'Estadísticas' })).toHaveAttribute('href', '/admin/stats');
    vista.unmount();

    api(caretaker());
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Estadísticas' })).not.toBeInTheDocument();
  });

  it('3: ingresos por mes con cuotas y donaciones por separado', async () => {
    api();
    renderRoute('/admin/stats');
    expect(await screen.findByRole('heading', { level: 1, name: 'Estadísticas' })).toBeInTheDocument();
    const ingresos = await tarjeta('Ingresos por mes');
    expect(within(ingresos).getByRole('img', { name: /Ingresos por mes: 2 meses/ })).toBeInTheDocument();
    const tabla = within(ingresos).getByRole('table', { hidden: true });
    expect(within(tabla).getByText('347,40 €')).toBeInTheDocument();
    // Leyenda: el color nunca es la única pista.
    expect(
      within(ingresos)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Cuotas', 'Donaciones']);
  });

  it('3: adopciones nuevas y bajas por mes', async () => {
    api();
    renderRoute('/admin/stats');
    const adopciones = await tarjeta('Adopciones nuevas y bajas');
    expect(
      within(adopciones)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Nuevas', 'Bajas']);
    expect(within(adopciones).getByRole('img', { name: /Adopciones nuevas y bajas: 2 meses/ })).toBeInTheDocument();
  });

  it('3: más adoptados, sin adoptantes (con enlace a su ficha) y reparto por plan', async () => {
    api();
    renderRoute('/admin/stats');
    const mas = await tarjeta('Animales más adoptados');
    expect(within(mas).getAllByRole('listitem')[0]).toHaveTextContent('Rufo3');
    const sin = await tarjeta('Animales sin adoptantes');
    expect(within(sin).getByRole('link', { name: 'Pipa' })).toHaveAttribute('href', '/admin/animals/14');
    expect(within(sin).getByText('Buitre negro')).toBeInTheDocument();
    const planes = await tarjeta('Adopciones activas por plan');
    expect(within(planes).getAllByRole('listitem')[1]).toHaveTextContent('Extraordinaria2');
  });

  it('2: el rango se elige con «Desde» y «Hasta» y se pide a la API', async () => {
    const { pedidas } = api();
    renderRoute('/admin/stats');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.type(screen.getByLabelText('Desde'), '2026-01-01');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-06-30');
    await waitFor(() => {
      const ultima = pedidas('/api/admin/stats').at(-1);
      expect(ultima?.searchParams.get('from')).toBe('2026-01-01');
      expect(ultima?.searchParams.get('to')).toBe('2026-06-30');
    });
  });

  it('3a: sin datos en el rango, cada gráfico lo indica', async () => {
    api(
      admin(),
      estadisticas({
        revenueByMonth: [{ month: '2001-01', fees: '0.00', donations: '0.00' }],
        adoptionsByMonth: [{ month: '2001-01', started: 0, ended: 0 }],
      }),
    );
    renderRoute('/admin/stats');
    expect(await screen.findAllByText('No hay datos en este rango')).toHaveLength(2);
  });

  it('todos con adoptantes: mensaje en lugar de la lista', async () => {
    api(admin(), estadisticas({ withoutAdopters: [] }));
    renderRoute('/admin/stats');
    const sin = await tarjeta('Animales sin adoptantes');
    expect(within(sin).getByText('Todos los animales tienen al menos un adoptante.')).toBeInTheDocument();
  });
});
