import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminUsers, page } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';
import { asignacion, ausencia } from './helpers/work-fixtures';
import { elegirOpcion } from './helpers/select';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

const nueva = ausencia({
  id: 7,
  user: { id: 3, name: 'Nuria Peris Gil' },
  startDate: '2026-11-24',
  endDate: '2026-11-25',
  type: 'sick_leave',
});

function api(extra: Record<string, Handler> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: admin() } },
    '/api/admin/absences': (_u, p) =>
      p.method === 'POST'
        ? {
            status: 201,
            body: {
              absence: nueva,
              removedAssignments: [asignacion({ id: 510, date: '2026-11-25' })],
              keptAssignments: [asignacion({ id: 509, date: '2026-11-24', checkedInAt: '2026-11-24T06:58:00.000Z' })],
            },
          }
        : { body: { data: [ausencia()] } },
    '/api/admin/users': () => ({ body: page(adminUsers) }),
    ...extra,
  });
}

describe('CU-62 Ausencias', () => {
  it('1: lista las ausencias con su motivo', async () => {
    api();
    renderRoute('/admin/absences');
    expect(await screen.findByRole('heading', { level: 1, name: 'Ausencias' })).toBeInTheDocument();
    const fila = within((await screen.findByText('Carmen Boix Vidal')).closest('tr')!);
    expect(fila.getByText('Vacaciones')).toBeInTheDocument();
    expect(fila.getByText(/26 nov 2026/)).toBeInTheDocument();
  });

  it('2-3: registra una ausencia y dice qué turnos ha quitado y cuáles se quedan', async () => {
    const { enviados } = api();
    renderRoute('/admin/absences');
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar ausencia' }));
    const dialogo = screen.getByRole('dialog', { name: 'Registrar ausencia' });
    await elegirOpcion(within(dialogo).getByLabelText('Persona'), 'Nuria Peris Gil');
    await userEvent.type(within(dialogo).getByLabelText('Primer día'), '2026-11-24');
    await userEvent.type(within(dialogo).getByLabelText('Último día'), '2026-11-25');
    await elegirOpcion(within(dialogo).getByLabelText('Motivo'), 'Baja médica');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(enviados('/api/admin/absences').filter(Boolean)).toEqual([
        { userId: 3, startDate: '2026-11-24', endDate: '2026-11-25', type: 'sick_leave', notes: '' },
      ]),
    );
    expect(await screen.findByText('Ausencia registrada.')).toBeInTheDocument();
    expect(screen.getByText('Se han quitado estos turnos, que hay que volver a cubrir:')).toBeInTheDocument();
    expect(screen.getByText('miércoles, 25 de noviembre · Mañana')).toBeInTheDocument();
    expect(screen.getByText('Ya había fichado estos turnos, que se mantienen:')).toBeInTheDocument();
    expect(screen.getByText('martes, 24 de noviembre · Mañana')).toBeInTheDocument();
  }, 20_000);

  it('A1: borra una ausencia', async () => {
    api({ '/api/admin/absences/2': () => ({ status: 204 }) });
    renderRoute('/admin/absences');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar la ausencia de Carmen Boix Vidal' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Borrar' }));
    expect(
      await screen.findByText('Ausencia borrada. Los turnos que se quitaron no vuelven solos.'),
    ).toBeInTheDocument();
  });
});
