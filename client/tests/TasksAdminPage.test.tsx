import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminUsers, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';
import { cualificaciones, tarea, zonas } from './helpers/work-fixtures';
import { elegirOpcion } from './helpers/select';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

const TAREAS = [
  tarea({ id: 1, title: 'Revisión de la clínica', type: 'health_check', dueTime: '08:30', late: true }),
  tarea({
    id: 2,
    title: 'Comida de la clínica',
    dueTime: '09:00',
    status: 'completed',
    resolvedBy: { id: 3, name: 'Nuria Peris Gómez' },
    resolvedAt: '2026-11-23T08:12:00.000Z',
    observations: 'Todo bien.',
  }),
  tarea({
    id: 3,
    title: 'Reparar la puerta del almacén',
    type: 'maintenance',
    dueTime: '15:00',
    isOneOff: true,
    templateId: null,
    zone: { id: 5, name: 'Cocina y almacén' },
    assignedTo: { id: 4, name: 'Andrés Ferrer Roig' },
  }),
];

function api(extra: Record<string, Handler> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: admin() } },
    '/api/admin/tasks': { body: { data: TAREAS } },
    '/api/admin/zones': { body: { data: zonas } },
    '/api/admin/qualifications': { body: { data: cualificaciones } },
    '/api/admin/work-settings': { body: { lateMarginMinutes: 30 } },
    '/api/admin/users': {
      body: { data: adminUsers, meta: { page: 1, pageSize: 100, total: adminUsers.length, totalPages: 1 } },
    },
    '/api/admin/animals': { body: { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } } },
    ...extra,
  });
}

const fila = async (titulo: string) => (await screen.findByRole('cell', { name: titulo })).closest('tr') as HTMLElement;

describe('CU-55 Tareas del día (administrador)', () => {
  it('1: lista las tareas del día con su estado, quién la resolvió y a quién está asignada', async () => {
    api();
    renderRoute('/admin/tasks');
    expect(await screen.findByRole('heading', { level: 1, name: 'Tareas del día' })).toBeInTheDocument();
    expect(within(await fila('Revisión de la clínica')).getByText('Atrasada')).toBeInTheDocument();
    const comida = await fila('Comida de la clínica');
    expect(within(comida).getByText('Hecha')).toBeInTheDocument();
    expect(within(comida).getByText(/Nuria Peris Gómez/)).toBeInTheDocument();
    expect(within(comida).getByText('Todo bien.')).toBeInTheDocument();
    const puerta = await fila('Reparar la puerta del almacén');
    expect(within(puerta).getByText('Andrés Ferrer Roig')).toBeInTheDocument();
    expect(within(puerta).getByText('Puntual')).toBeInTheDocument();
  });

  it('filtra por día, zona y estado', async () => {
    const { pedidas } = api();
    renderRoute('/admin/tasks');
    await fila('Revisión de la clínica');
    await elegirOpcion(screen.getByLabelText('Zona'), 'Gran voladero');
    await elegirOpcion(screen.getByLabelText('Estado'), 'Pendiente');
    await waitFor(() => {
      const ultima = pedidas('/api/admin/tasks').at(-1);
      expect(ultima?.searchParams.get('zoneId')).toBe('1');
      expect(ultima?.searchParams.get('status')).toBe('pending');
    });
  });

  it('2: crea una tarea puntual', async () => {
    const { enviados } = api({
      '/api/admin/tasks': (_u, p) =>
        p.method === 'POST'
          ? { status: 201, body: tarea({ id: 9, title: 'Cambiar la bombilla', isOneOff: true }) }
          : { body: { data: TAREAS } },
    });
    renderRoute('/admin/tasks');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva tarea puntual' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva tarea puntual' });
    await elegirOpcion(within(dialogo).getByLabelText('Tipo'), 'Mantenimiento');
    await userEvent.type(within(dialogo).getByLabelText('Título'), 'Cambiar la bombilla');
    await elegirOpcion(within(dialogo).getByLabelText('Zona'), 'Cocina y almacén');
    await userEvent.clear(within(dialogo).getByLabelText('Día'));
    await userEvent.type(within(dialogo).getByLabelText('Día'), '2026-11-24');
    await userEvent.type(within(dialogo).getByLabelText('Hora'), '10:00');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Tarea creada')).toBeInTheDocument();
    expect(enviados('/api/admin/tasks').filter(Boolean)[0]).toMatchObject({
      type: 'maintenance',
      title: 'Cambiar la bombilla',
      zoneId: 5,
      dueDate: '2026-11-24',
      dueTime: '10:00',
    });
  });

  it('3: reasigna una tarea pendiente; los errores del servidor salen en el campo', async () => {
    const { enviados } = api({
      '/api/admin/tasks/1/assignee': () =>
        errorApi(400, 'VALIDATION_ERROR', 'Datos no válidos.', [
          { field: 'userId', message: 'Esta persona no tiene la cualificación que exige la tarea.' },
        ]),
    });
    renderRoute('/admin/tasks');
    await userEvent.click(
      within(await fila('Revisión de la clínica')).getByRole('button', { name: 'Reasignar Revisión de la clínica' }),
    );
    const dialogo = screen.getByRole('dialog', { name: 'Reasignar: Revisión de la clínica' });
    const persona = within(dialogo).getByLabelText('Persona');
    expect(within(persona).queryByRole('option', { name: /Lucía/ })).not.toBeInTheDocument();
    await elegirOpcion(persona, 'Nuria Peris Gil');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(
      await within(dialogo).findByText('Esta persona no tiene la cualificación que exige la tarea.'),
    ).toBeInTheDocument();
    expect(enviados('/api/admin/tasks/1/assignee')).toEqual([{ userId: 3 }]);
  });

  it('4: solo las pendientes se pueden borrar o reasignar', async () => {
    api();
    renderRoute('/admin/tasks');
    const comida = await fila('Comida de la clínica');
    expect(within(comida).queryByRole('button', { name: /Borrar/ })).not.toBeInTheDocument();
    expect(within(comida).queryByRole('button', { name: /Reasignar/ })).not.toBeInTheDocument();
  });

  it('solo para administradores', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } } });
    renderRoute('/admin/tasks');
    expect(await screen.findByText('No tienes acceso a esta página')).toBeInTheDocument();
  });
});

describe('CU-73 Ajustes del trabajo diario', () => {
  it('cambia el margen para considerar atrasada una tarea', async () => {
    const { enviados } = api({
      '/api/admin/work-settings': (_u, p) => ({ body: { lateMarginMinutes: p.method === 'PUT' ? 45 : 30 } }),
    });
    renderRoute('/admin/tasks');
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustes' }));
    const dialogo = screen.getByRole('dialog', { name: 'Ajustes del trabajo diario' });
    const margen = await within(dialogo).findByLabelText('Margen para considerar atrasada una tarea (minutos)');
    await waitFor(() => expect(margen).toHaveValue(30));
    await userEvent.clear(margen);
    await userEvent.type(margen, '45');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ajustes guardados')).toBeInTheDocument();
    expect(enviados('/api/admin/work-settings').filter(Boolean)).toEqual([{ lateMarginMinutes: 45 }]);
  });
});
