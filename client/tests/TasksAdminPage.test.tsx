import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminUsers, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';
import { cualificaciones, tarea, zonas } from './helpers/work-fixtures';
import { elegirHora, elegirOpcion } from './helpers/select';

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
    expect(within(puerta).queryByText('Puntual')).not.toBeInTheDocument();
  });

  it('CU-70: una tarea de incidencia hecha se ve «Resuelta»; la normal, «Hecha», y la no realizada no cambia', async () => {
    api({
      '/api/admin/tasks': () => ({
        body: {
          data: [
            tarea({ id: 4, title: 'Tapar la gotera', status: 'completed', isOneOff: true, incidentId: 2 }),
            tarea({ id: 5, title: 'Vendar la pata', status: 'not_done', isOneOff: true, incidentId: 3 }),
            tarea({ id: 6, title: 'Limpiar el voladero', status: 'completed' }),
          ],
        },
      }),
    });
    renderRoute('/admin/tasks');
    const gotera = await fila('Tapar la gotera');
    expect(within(gotera).getByText('Resuelta')).toBeInTheDocument();
    expect(within(gotera).queryByText('Hecha')).not.toBeInTheDocument();
    expect(within(await fila('Vendar la pata')).getByText('No realizada')).toBeInTheDocument();
    const normal = await fila('Limpiar el voladero');
    expect(within(normal).getByText('Hecha')).toBeInTheDocument();
    expect(within(normal).queryByText('Resuelta')).not.toBeInTheDocument();
  });

  it('RN-40: separa las tareas del administrador («Tuyas», que se hacen en «Mi día») de las del resto del personal', async () => {
    api({
      '/api/admin/tasks': () => ({
        body: {
          data: [
            ...TAREAS,
            tarea({ id: 7, title: 'Revisar la báscula', assignedTo: { id: 1, name: 'Marta Soler Ferrer' } }),
          ],
        },
      }),
    });
    renderRoute('/admin/tasks');
    const tuyas = within(await screen.findByRole('region', { name: 'Tuyas' }));
    expect(tuyas.getByRole('cell', { name: 'Revisar la báscula' })).toBeInTheDocument();
    expect(tuyas.queryByRole('cell', { name: 'Reparar la puerta del almacén' })).not.toBeInTheDocument();
    expect(tuyas.getByRole('link', { name: 'Hacerlas en «Mi día»' })).toHaveAttribute('href', '/admin/my-day');
    const resto = within(screen.getByRole('region', { name: 'Del resto del personal' }));
    expect(resto.getByRole('cell', { name: 'Reparar la puerta del almacén' })).toBeInTheDocument();
    expect(resto.getByRole('cell', { name: 'Revisión de la clínica' })).toBeInTheDocument();
    expect(resto.queryByRole('cell', { name: 'Revisar la báscula' })).not.toBeInTheDocument();
  });

  it('RN-40: sin tareas propias no aparece el bloque «Tuyas»', async () => {
    api();
    renderRoute('/admin/tasks');
    expect(await screen.findByRole('region', { name: 'Del resto del personal' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tuyas' })).not.toBeInTheDocument();
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

  it('2: crea una tarea (sin plantilla)', async () => {
    const { enviados } = api({
      '/api/admin/tasks': (_u, p) =>
        p.method === 'POST'
          ? { status: 201, body: tarea({ id: 9, title: 'Cambiar la bombilla', isOneOff: true }) }
          : { body: { data: TAREAS } },
    });
    renderRoute('/admin/tasks');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva tarea' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva tarea' });
    await elegirOpcion(within(dialogo).getByLabelText('Tipo'), 'Mantenimiento');
    await userEvent.type(within(dialogo).getByLabelText('Título'), 'Cambiar la bombilla');
    await elegirOpcion(within(dialogo).getByLabelText('Zona (opcional)'), 'Cocina y almacén');
    await userEvent.clear(within(dialogo).getByLabelText('Día'));
    await userEvent.type(within(dialogo).getByLabelText('Día'), '2026-11-24');
    await elegirHora(within(dialogo).getByLabelText('Hora'), '10:00');
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

  it('2: zona, animales y persona son opcionales: sin ninguno, se crea igual', async () => {
    const { enviados } = api({
      '/api/admin/tasks': (_u, p) =>
        p.method === 'POST'
          ? { status: 201, body: tarea({ id: 9, title: 'Revisar los extintores', zone: null }) }
          : { body: { data: TAREAS } },
    });
    renderRoute('/admin/tasks');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva tarea' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva tarea' });
    expect(within(dialogo).getByLabelText('Zona (opcional)')).toHaveTextContent('Sin zona');
    await elegirOpcion(within(dialogo).getByLabelText('Tipo'), 'Mantenimiento');
    await userEvent.type(within(dialogo).getByLabelText('Título'), 'Revisar los extintores');
    await elegirHora(within(dialogo).getByLabelText('Hora'), '18:30');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Tarea creada')).toBeInTheDocument();
    expect(enviados('/api/admin/tasks').filter(Boolean)[0]).toMatchObject({
      zoneId: null,
      animalIds: [],
      assignedTo: null,
      dueTime: '18:30',
    });
    expect(screen.queryByText('Elige una zona, un animal o una persona.')).not.toBeInTheDocument();
  });

  it('se ordenan por las creadas más recientemente (de cualquier día, con su fecha)', async () => {
    const { pedidas } = api({
      '/api/admin/tasks': (u) => ({
        body: {
          data:
            u.searchParams.get('sort') === '-createdAt'
              ? [tarea({ id: 12, title: 'Creada por error', dueDate: '2026-11-30', dueTime: '07:00' }), ...TAREAS]
              : TAREAS,
        },
      }),
    });
    renderRoute('/admin/tasks');
    await fila('Revisión de la clínica');
    await elegirOpcion(screen.getByLabelText('Ordenar'), 'Más recientes primero');
    const errada = await fila('Creada por error');
    expect(within(errada).getByText('30 nov 2026')).toBeInTheDocument();
    expect(within(errada).getByText('07:00')).toBeInTheDocument();
    expect(screen.getByText('Las 50 últimas creadas, de cualquier día.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Día')).not.toBeInTheDocument();
    await waitFor(() => {
      const ultima = pedidas('/api/admin/tasks').at(-1);
      expect(ultima?.searchParams.get('sort')).toBe('-createdAt');
      expect(ultima?.searchParams.get('date')).toBeNull();
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
    // Se lee como una frase: «Una tarea pasa a «Atrasada» si sigue sin hacerse [30] minutos después de su hora».
    expect(dialogo).toHaveTextContent('Una tarea pasa a «Atrasada» si sigue sin hacerse');
    expect(dialogo).toHaveTextContent('minutos después de su hora');
    const margen = await within(dialogo).findByLabelText('Minutos de margen antes de marcar una tarea como «Atrasada»');
    expect(margen).toHaveAccessibleDescription('Con 0, en cuanto pasa su hora.');
    // El número de comidas para avisar ya no está aquí: está en «Avisos».
    expect(within(dialogo).queryByText(/comiendo poco|Tomas/)).not.toBeInTheDocument();
    await waitFor(() => expect(margen).toHaveValue(30));
    await userEvent.clear(margen);
    await userEvent.type(margen, '45');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ajustes guardados')).toBeInTheDocument();
    expect(enviados('/api/admin/work-settings').filter(Boolean)).toEqual([{ lateMarginMinutes: 45 }]);
  });
});
