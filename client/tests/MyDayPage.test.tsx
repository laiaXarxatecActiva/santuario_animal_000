import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MyDayTaskDto } from '@sanctuary/shared';
import { caretaker } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';
import { tareaDelDia } from './helpers/work-fixtures';

const TAREAS: MyDayTaskDto[] = [
  tareaDelDia({ id: 1, title: 'Revisión de la clínica', type: 'health_check', dueTime: '08:30', late: true }),
  tareaDelDia({
    id: 2,
    title: 'Reparar la puerta del almacén',
    type: 'maintenance',
    dueTime: '15:00',
    isOneOff: true,
    templateId: null,
    mine: true,
    assignedTo: { id: 3, name: 'Nuria Peris Gómez' },
  }),
  tareaDelDia({
    id: 3,
    title: 'Antiinflamatorio de Olmo',
    type: 'medication',
    dueTime: '09:00',
    qualification: { id: 1, name: 'Administrar medicación' },
    blockedReason: 'MISSING_QUALIFICATION',
    animals: [{ id: 4, name: 'Olmo' }],
  }),
  tareaDelDia({
    id: 4,
    title: 'Comida del gran voladero',
    dueTime: '09:00',
    status: 'completed',
    resolvedBy: { id: 3, name: 'Nuria Peris Gómez' },
    resolvedAt: '2026-11-23T08:12:00.000Z',
    blockedReason: 'NOT_PENDING',
  }),
];

function api(extra: Record<string, (u: URL, p: Peticion) => { status?: number; body?: unknown }> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/my-day': (u) => ({
      body: { date: u.searchParams.get('date') ?? '2026-11-23', tasks: u.searchParams.get('date') ? [] : TAREAS },
    }),
    ...extra,
  });
}

const tarjeta = async (titulo: string) => screen.findByRole('article', { name: new RegExp(titulo) });

describe('CU-56 Mi día', () => {
  it('1-2: separa las tareas asignadas a la persona de las demás del día, con sus insignias', async () => {
    api();
    renderRoute('/admin/my-day');
    expect(await screen.findByRole('heading', { level: 1, name: 'Mi día' })).toBeInTheDocument();
    const mias = await screen.findByRole('region', { name: 'Tus tareas' });
    const puerta = within(mias).getByRole('article', { name: /Reparar la puerta/ });
    // RN-40: las tuyas llevan el borde de color.
    expect(puerta).toHaveAttribute('data-mine');
    expect(within(mias).queryByText('Puntual')).not.toBeInTheDocument();
    const resto = screen.getByRole('region', { name: 'Sin asignar' });
    const revision = within(resto).getByRole('article', { name: /Revisión de la clínica/ });
    expect(revision).not.toHaveAttribute('data-mine');
    expect(within(revision).getByText('Atrasada')).toBeInTheDocument();
    expect(within(revision).getByText('Revisión de salud')).toBeInTheDocument();
    expect(within(revision).getByText('08:30')).toBeInTheDocument();
  });

  it('3: sin la cualificación, explica por qué no la puede marcar', async () => {
    api();
    renderRoute('/admin/my-day');
    const olmo = await tarjeta('Antiinflamatorio de Olmo');
    expect(within(olmo).getByText('Necesitas la cualificación «Administrar medicación».')).toBeInTheDocument();
    expect(within(olmo).queryByRole('button', { name: 'Hecha' })).not.toBeInTheDocument();
    expect(within(olmo).getByText('Olmo')).toBeInTheDocument();
  });

  it('4: cambia de día', async () => {
    const { pedidas } = api();
    renderRoute('/admin/my-day');
    await tarjeta('Revisión de la clínica');
    await userEvent.click(screen.getByRole('button', { name: 'Día siguiente' }));
    expect(await screen.findByText('No hay tareas para este día.')).toBeInTheDocument();
    expect(pedidas('/api/admin/my-day').map((u) => u.searchParams.get('date'))).toContain('2026-11-24');
  });
});

describe('CU-57 Completar una tarea', () => {
  it('1-2: con un toque se marca como hecha', async () => {
    const { enviados } = api({
      '/api/admin/tasks/1/complete': () => ({ body: tareaDelDia({ id: 1, status: 'completed' }) }),
    });
    renderRoute('/admin/my-day');
    await userEvent.click(within(await tarjeta('Revisión de la clínica')).getByRole('button', { name: 'Hecha' }));
    expect(await screen.findByText('Tarea marcada como hecha')).toBeInTheDocument();
    expect(enviados('/api/admin/tasks/1/complete')).toEqual([{}]);
  });

  it('3: con observaciones', async () => {
    const { enviados } = api({
      '/api/admin/tasks/1/complete': () => ({ body: tareaDelDia({ id: 1, status: 'completed' }) }),
    });
    renderRoute('/admin/my-day');
    await userEvent.click(within(await tarjeta('Revisión de la clínica')).getByRole('button', { name: 'Con nota' }));
    const dialogo = screen.getByRole('dialog', { name: 'Revisión de la clínica' });
    expect(within(dialogo).queryByText('Foto (opcional)')).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: 'Elegir foto' })).not.toBeInTheDocument();
    await userEvent.type(within(dialogo).getByLabelText('Observaciones (opcional)'), 'Olmo cojea un poco.');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Marcar como hecha' }));
    await waitFor(() =>
      expect(enviados('/api/admin/tasks/1/complete')).toEqual([{ observations: 'Olmo cojea un poco.' }]),
    );
  });

  it('A1: «No se ha podido hacer» exige el motivo', async () => {
    const { enviados } = api({
      '/api/admin/tasks/1/not-done': () => ({ body: tareaDelDia({ id: 1, status: 'not_done' }) }),
    });
    renderRoute('/admin/my-day');
    await userEvent.click(
      within(await tarjeta('Revisión de la clínica')).getByRole('button', { name: 'No se ha podido hacer' }),
    );
    const dialogo = screen.getByRole('dialog', { name: 'Revisión de la clínica' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialogo).findByText('Explica por qué no se ha podido hacer.')).toBeInTheDocument();
    expect(enviados('/api/admin/tasks/1/not-done')).toEqual([]);
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'La veterinaria lo tenía en consulta.');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(enviados('/api/admin/tasks/1/not-done')).toEqual([{ reason: 'La veterinaria lo tenía en consulta.' }]),
    );
  });

  it('A2: quien la resolvió ve quién y cuándo, y puede deshacerlo', async () => {
    const { enviados } = api({
      '/api/admin/tasks/4/reopen': () => ({ body: tareaDelDia({ id: 4 }) }),
    });
    renderRoute('/admin/my-day');
    const comida = await tarjeta('Comida del gran voladero');
    expect(within(comida).getByText('Hecha')).toBeInTheDocument();
    expect(within(comida).getByText(/Nuria Peris Gómez/)).toBeInTheDocument();
    await userEvent.click(within(comida).getByRole('button', { name: 'Deshacer' }));
    await waitFor(() => expect(enviados('/api/admin/tasks/4/reopen')).toHaveLength(1));
  });
});
