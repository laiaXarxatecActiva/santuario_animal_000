import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminAnimal } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';
import { cualificaciones, plantilla, zonas } from './helpers/work-fixtures';
import { anadirHora, elegirOpcion } from './helpers/select';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

const PLANTILLAS = [
  plantilla(),
  plantilla({
    id: 1,
    title: 'Comida del gran voladero',
    zone: { id: 1, name: 'Gran voladero' },
    times: ['09:00'],
    recurrence: 'weekdays',
    weekdays: [1, 3, 5],
  }),
  plantilla({
    id: 9,
    type: 'enrichment',
    title: 'Enriquecimiento',
    times: ['13:00'],
    recurrence: 'every_n_days',
    intervalDays: 3,
    hasHistory: false,
    isActive: false,
  }),
];

const ANIMALES = [adminAnimal({ id: 4, name: 'Olmo' }), adminAnimal({ id: 13, name: 'Faro', status: 'transferred' })];

function api(extra: Record<string, Handler> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: admin() } },
    '/api/admin/task-templates': { body: { data: PLANTILLAS } },
    '/api/admin/zones': { body: { data: zonas } },
    '/api/admin/qualifications': { body: { data: cualificaciones } },
    '/api/admin/animals': { body: { data: ANIMALES, meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 } } },
    ...extra,
  });
}

const fila = async (titulo: string) => (await screen.findByRole('cell', { name: titulo })).closest('tr') as HTMLElement;

describe('CU-54 Gestionar plantillas de tareas', () => {
  it('2: lista las plantillas con su tipo, su zona y cuándo se repiten', async () => {
    api();
    renderRoute('/admin/task-templates');
    expect(await screen.findByRole('heading', { level: 1, name: 'Plantillas de tareas' })).toBeInTheDocument();
    const clinica = await fila('Comida de la clínica');
    expect(within(clinica).getByText('Alimentación')).toBeInTheDocument();
    expect(within(clinica).getByText('Clínica y recuperación')).toBeInTheDocument();
    expect(within(clinica).getByText('Cada día · 09:00, 17:00')).toBeInTheDocument();
    expect(within(await fila('Comida del gran voladero')).getByText('Lun, Mié, Vie · 09:00')).toBeInTheDocument();
    const enriquecimiento = await fila('Enriquecimiento');
    expect(within(enriquecimiento).getByText('Cada 3 días · 13:00')).toBeInTheDocument();
    expect(within(enriquecimiento).getByText('Desactivada')).toBeInTheDocument();
  });

  it('3-4: crea una plantilla semanal', async () => {
    const { enviados } = api({
      '/api/admin/task-templates': (_u, p) =>
        p.method === 'POST'
          ? { status: 201, body: plantilla({ id: 12, title: 'Barrer la cocina' }) }
          : { body: { data: PLANTILLAS } },
    });
    renderRoute('/admin/task-templates');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva plantilla' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva plantilla' });
    await elegirOpcion(within(dialogo).getByLabelText('Tipo'), 'Limpieza');
    await userEvent.type(within(dialogo).getByLabelText('Título'), 'Barrer la cocina');
    await elegirOpcion(within(dialogo).getByLabelText('Zona'), 'Cocina y almacén');
    const horas = within(dialogo).getByRole('group', { name: 'Horas' });
    await anadirHora(horas, '16:00');
    await anadirHora(horas, '08:00');
    await elegirOpcion(within(dialogo).getByLabelText('Se repite'), 'Algunos días de la semana');
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Lunes' }));
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Jueves' }));
    await userEvent.clear(within(dialogo).getByLabelText('Desde'));
    await userEvent.type(within(dialogo).getByLabelText('Desde'), '2026-12-01');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Plantilla guardada')).toBeInTheDocument();
    expect(enviados('/api/admin/task-templates').filter(Boolean)[0]).toMatchObject({
      type: 'cleaning',
      title: 'Barrer la cocina',
      zoneId: 5,
      animalIds: [],
      times: ['08:00', '16:00'],
      recurrence: 'weekdays',
      weekdays: [1, 4],
      startDate: '2026-12-01',
      isActive: true,
    });
  });

  it('4a: comprueba las horas y los días antes de enviar', async () => {
    const { enviados } = api();
    renderRoute('/admin/task-templates');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva plantilla' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva plantilla' });
    await userEvent.type(within(dialogo).getByLabelText('Título'), 'Algo');
    await elegirOpcion(within(dialogo).getByLabelText('Se repite'), 'Algunos días de la semana');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialogo).findByText('Añade al menos una hora.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Elige al menos un día de la semana.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Elige una zona o al menos un animal.')).toBeInTheDocument();
    expect(enviados('/api/admin/task-templates').filter(Boolean)).toEqual([]);
  });

  it('los animales que ya no están en el santuario no se pueden elegir', async () => {
    api();
    renderRoute('/admin/task-templates');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva plantilla' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva plantilla' });
    expect(await within(dialogo).findByRole('checkbox', { name: 'Olmo' })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('checkbox', { name: 'Faro' })).not.toBeInTheDocument();
  });

  it('5: al editar, avisa de que se regeneran las tareas pendientes', async () => {
    const { enviados } = api({
      '/api/admin/task-templates/4': (_u, p) => ({ body: p.method === 'PUT' ? plantilla() : plantilla() }),
    });
    renderRoute('/admin/task-templates');
    await userEvent.click(
      within(await fila('Comida de la clínica')).getByRole('button', { name: 'Editar Comida de la clínica' }),
    );
    const dialogo = screen.getByRole('dialog', { name: 'Editar plantilla' });
    expect(
      within(dialogo).getByText('Al guardar, las tareas pendientes de hoy en adelante se vuelven a generar.'),
    ).toBeInTheDocument();
    const horas = within(dialogo).getByRole('group', { name: 'Horas' });
    expect(
      within(horas)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['09:00', '17:00']);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enviados('/api/admin/task-templates/4').filter(Boolean)).toHaveLength(1));
  });

  it('6: una plantilla con historial no se borra; una sin historial, sí', async () => {
    const { pedidas } = api({ '/api/admin/task-templates/9': () => ({ status: 204 }) });
    renderRoute('/admin/task-templates');
    await userEvent.click(
      within(await fila('Comida de la clínica')).getByRole('button', { name: 'Borrar Comida de la clínica' }),
    );
    expect(
      screen.getByText('Esta plantilla ya tiene tareas resueltas: desactívala en lugar de borrarla.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(
      within(await fila('Enriquecimiento')).getByRole('button', { name: 'Borrar Enriquecimiento' }),
    );
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText('Plantilla borrada')).toBeInTheDocument();
    expect(pedidas('/api/admin/task-templates/9')).toHaveLength(1);
  });
});
