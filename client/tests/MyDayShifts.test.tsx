import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';
import { asignacion } from './helpers/work-fixtures';

function api(turno = asignacion(), extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/my-day': (u) => ({
      body: {
        date: u.searchParams.get('date') ?? '2026-11-23',
        tasks: [],
        shifts: u.searchParams.get('date') ? [] : [turno],
      },
    }),
    ...extra,
  });
}

const tuTurno = async () => within(await screen.findByRole('region', { name: 'Tu turno' }));

describe('CU-63 Fichar desde «Mi día»', () => {
  it('muestra el turno de hoy con sus zonas y ficha la entrada', async () => {
    const { fetchMock } = api(asignacion(), {
      '/api/admin/shift-assignments/501/check-in': () => ({
        body: asignacion({ checkedInAt: '2026-11-23T06:58:00.000Z' }),
      }),
    });
    renderRoute('/admin/my-day');
    const turno = await tuTurno();
    expect(turno.getByRole('article', { name: 'Mañana, 07:00–15:00' })).toBeInTheDocument();
    expect(turno.getByText('Clínica y recuperación, Voladero de alimoches')).toBeInTheDocument();
    await userEvent.click(turno.getByRole('button', { name: 'Fichar entrada' }));
    expect(await screen.findByText('Entrada fichada')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([u, init]) => String(u).endsWith('/api/admin/shift-assignments/501/check-in') && init?.method === 'POST',
      ),
    ).toBe(true);
  });

  it('con la entrada fichada, ofrece la salida', async () => {
    api(asignacion({ checkedInAt: '2026-11-23T06:58:00.000Z' }));
    renderRoute('/admin/my-day');
    const turno = await tuTurno();
    expect(turno.getByText('Entrada: 07:58')).toBeInTheDocument();
    expect(turno.getByRole('button', { name: 'Fichar salida' })).toBeInTheDocument();
    expect(turno.queryByRole('button', { name: 'Fichar entrada' })).not.toBeInTheDocument();
  });

  it('con la salida fichada, ya no hay botones', async () => {
    api(asignacion({ checkedInAt: '2026-11-23T06:58:00.000Z', checkedOutAt: '2026-11-23T14:05:00.000Z' }));
    renderRoute('/admin/my-day');
    const turno = await tuTurno();
    expect(turno.getByText('Salida: 15:05')).toBeInTheDocument();
    expect(turno.queryByRole('button')).not.toBeInTheDocument();
  });

  it('muestra el error del servidor', async () => {
    api(asignacion(), {
      '/api/admin/shift-assignments/501/check-in': () =>
        errorApi(422, 'SHIFT_NOT_TODAY', 'Solo se puede fichar el día del turno.'),
    });
    renderRoute('/admin/my-day');
    await userEvent.click((await tuTurno()).getByRole('button', { name: 'Fichar entrada' }));
    expect(await screen.findByText('Solo se puede fichar el día del turno.')).toBeInTheDocument();
  });

  it('sin turno ese día, no aparece', async () => {
    api();
    renderRoute('/admin/my-day');
    await userEvent.click(await screen.findByRole('button', { name: 'Día siguiente' }));
    expect(await screen.findByText('No hay tareas para este día.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tu turno' })).not.toBeInTheDocument();
  });
});
