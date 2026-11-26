import type { MyDayTaskDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';
import { tareaDelDia } from './helpers/work-fixtures';
import { elegirOpcion } from './helpers/select';

const TAREAS: MyDayTaskDto[] = [
  tareaDelDia({
    id: 1,
    title: 'Comida de la clínica',
    type: 'feeding',
    dueTime: '17:00',
    feedingAnimals: [
      { id: 10, name: 'Carbón' },
      { id: 4, name: 'Olmo' },
    ],
  }),
  tareaDelDia({
    id: 2,
    templateId: null,
    title: 'Revisión de la cuarentena',
    type: 'health_check',
    dueTime: '11:00',
    vetVisitId: 7,
    animals: [{ id: 14, name: 'Pipa' }],
  }),
  tareaDelDia({
    id: 3,
    templateId: null,
    title: 'Doxiciclina · 100 mg',
    type: 'medication',
    dueTime: '10:00',
    medicationPlanId: 1,
    animals: [{ id: 10, name: 'Carbón' }],
  }),
];

function api(extra: Record<string, (u: URL, p: Peticion) => { status?: number; body?: unknown }> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/my-day': () => ({ body: { date: '2026-11-23', tasks: TAREAS, shifts: [] } }),
    ...extra,
  });
}

const tarjeta = async (titulo: string) => screen.findByRole('article', { name: new RegExp(titulo) });

describe('CU-66 Anotar lo que ha comido cada animal', () => {
  it('«Hecha» en una comida pregunta cuánto ha comido cada animal («Todo» por defecto)', async () => {
    const { enviados } = api({
      '/api/admin/tasks/1/complete': () => ({ body: tareaDelDia({ id: 1, status: 'completed' }) }),
    });
    renderRoute('/admin/my-day');
    const comida = await tarjeta('Comida de la clínica');
    expect(within(comida).queryByRole('button', { name: /^Con nota/ })).not.toBeInTheDocument();
    await userEvent.click(within(comida).getByRole('button', { name: 'Hecha' }));
    const ventana = await screen.findByRole('dialog', { name: 'Comida de la clínica' });
    expect(within(ventana).getByLabelText('Olmo')).toHaveValue('all');
    expect(within(ventana).queryByRole('button', { name: 'Elegir foto' })).not.toBeInTheDocument();
    await elegirOpcion(within(ventana).getByLabelText('Carbón'), 'Nada');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Marcar como hecha' }));
    expect(await screen.findByText('Tarea marcada como hecha')).toBeInTheDocument();
    expect(enviados('/api/admin/tasks/1/complete')).toEqual([
      {
        intakes: [
          { animalId: 10, intake: 'none' },
          { animalId: 4, intake: 'all' },
        ],
      },
    ]);
  });
});

describe('CU-68 Registrar una visita veterinaria desde «Mi día»', () => {
  it('la visita se registra con el formulario del historial, con el motivo ya puesto', async () => {
    const { enviados } = api({
      '/api/admin/vet-visits/7/complete': () => ({ body: { id: 7, status: 'done' } }),
    });
    renderRoute('/admin/my-day');
    const tarjetaVisita = await tarjeta('Revisión de la cuarentena');
    expect(within(tarjetaVisita).getByText('Visita veterinaria')).toBeInTheDocument();
    expect(within(tarjetaVisita).queryByRole('button', { name: 'Hecha' })).not.toBeInTheDocument();
    await userEvent.click(within(tarjetaVisita).getByRole('button', { name: 'Registrar la visita' }));
    const ventana = await screen.findByRole('dialog', { name: 'Registrar la visita' });
    expect(within(ventana).getByLabelText('Descripción')).toHaveValue('Revisión de la cuarentena');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Visita registrada en el historial veterinario')).toBeInTheDocument();
    await waitFor(() =>
      expect(enviados('/api/admin/vet-visits/7/complete')).toEqual([
        expect.objectContaining({ type: 'checkup', description: 'Revisión de la cuarentena' }),
      ]),
    );
  });
});

describe('CU-69 Las dosis de una pauta en «Mi día»', () => {
  it('no son puntuales y se completan con un toque', async () => {
    api();
    renderRoute('/admin/my-day');
    const dosis = await tarjeta('Doxiciclina');
    expect(within(dosis).queryByText('Puntual')).not.toBeInTheDocument();
    expect(within(dosis).getByRole('button', { name: 'Hecha' })).toBeInTheDocument();
  });
});
