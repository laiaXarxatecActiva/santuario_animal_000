import type { MyShiftsDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';
import { asignacion } from './helpers/work-fixtures';

const fichados = (data: MyShiftsDto['data'], totalWorkedMinutes = 0): MyShiftsDto => ({
  from: '2026-10-27',
  to: '2026-11-23',
  data,
  totalWorkedMinutes,
});

const LISTA = fichados(
  [
    { ...asignacion({ id: 503, date: '2026-11-23' }), workedMinutes: null },
    {
      ...asignacion({
        id: 502,
        date: '2026-11-22',
        checkedInAt: '2026-11-22T05:58:00.000Z',
        checkedOutAt: '2026-11-22T14:05:00.000Z',
      }),
      workedMinutes: 487,
    },
    {
      ...asignacion({ id: 501, date: '2026-11-21', checkedInAt: '2026-11-21T06:00:00.000Z' }),
      workedMinutes: null,
    },
  ],
  487,
);

function api(lista = LISTA) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/my-shifts': { body: lista },
  });
}

describe('CU-63 Mis fichajes', () => {
  it('está en el menú de «Trabajo diario»', async () => {
    api();
    renderRoute('/admin/my-shifts');
    const menu = within(await screen.findByRole('navigation', { name: 'Menú del panel' }));
    expect(menu.getByRole('link', { name: 'Mis fichajes' })).toHaveAttribute('aria-current', 'page');
  });

  it('lista cada turno con la entrada, la salida y las horas, y el total', async () => {
    api();
    renderRoute('/admin/my-shifts');
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis fichajes' })).toBeInTheDocument();
    const filas = within(await screen.findByRole('table'))
      .getAllByRole('row')
      .slice(1);
    expect(filas).toHaveLength(3);
    const [hoy, ayer, anteayer] = filas.map((f) => within(f as HTMLElement));
    expect(hoy?.getAllByText('Sin fichar')).toHaveLength(2);
    expect(ayer?.getByText('06:58')).toBeInTheDocument();
    expect(ayer?.getByText('15:05')).toBeInTheDocument();
    expect(ayer?.getByText('8 h 7 min')).toBeInTheDocument();
    expect(anteayer?.getByText('07:00')).toBeInTheDocument();
    expect(anteayer?.getByText('Sin fichar')).toBeInTheDocument();
    expect(screen.getByText('Total: 8 h 7 min')).toBeInTheDocument();
  });

  it('filtra por fechas', async () => {
    const { pedidas } = api();
    renderRoute('/admin/my-shifts');
    await screen.findByRole('table');
    const desde = screen.getByLabelText('Desde');
    await userEvent.clear(desde);
    await userEvent.type(desde, '2026-11-01');
    await waitFor(() =>
      expect(pedidas('/api/admin/my-shifts').some((u) => u.searchParams.get('from') === '2026-11-01')).toBe(true),
    );
  });

  it('sin turnos en esas fechas, lo indica', async () => {
    api(fichados([]));
    renderRoute('/admin/my-shifts');
    expect(await screen.findByText('No tienes turnos en estas fechas.')).toBeInTheDocument();
  });
});
