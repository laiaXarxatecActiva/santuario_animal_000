import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, caretaker, page } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';
import { incidencia, tarea, zonas } from './helpers/work-fixtures';

const ABIERTA = incidencia({
  id: 1,
  category: 'facilities',
  severity: 'medium',
  description: 'La malla del techo tiene un agujero.',
  zone: { id: 1, name: 'Gran voladero' },
  animal: null,
  reportedBy: { id: 4, name: 'Andrés Climent Mas' },
});

function api(
  usuario = caretaker(),
  extra: Record<string, (u: URL, p: Peticion) => { status?: number; body?: unknown }> = {},
) {
  return mockApi({
    '/api/auth/me': { body: { user: usuario } },
    '/api/admin/incidents': (u, p) =>
      p.method === 'POST'
        ? { status: 201, body: incidencia({ id: 9, status: 'open' }) }
        : { body: page(u.searchParams.get('status') === 'resolved' ? [] : [incidencia(), ABIERTA]) },
    '/api/admin/zones': { body: { data: zonas } },
    '/api/admin/animals': { body: page([]) },
    '/api/admin/users': { body: page([]) },
    '/api/admin/qualifications': { body: { data: [] } },
    ...extra,
  });
}

describe('CU-70 Incidencias', () => {
  it('el personal ve las abiertas y en curso, con su gravedad y estado', async () => {
    const { pedidas } = api();
    renderRoute('/admin/incidents');
    expect(await screen.findByRole('heading', { level: 1, name: 'Incidencias' })).toBeInTheDocument();
    const fila = (await screen.findByText('Pipa cojea de la pata derecha desde esta mañana.')).closest('tr')!;
    expect(within(fila).getByText('Alta')).toBeInTheDocument();
    expect(within(fila).getByText('Abierta')).toBeInTheDocument();
    expect(within(fila).getByText('Salud')).toBeInTheDocument();
    expect(within(fila).getByText('Cojera de Pipa')).toBeInTheDocument();
    expect(within(fila).getByRole('link', { name: 'Ver' })).toHaveAttribute('href', '/admin/incidents/2');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Resueltas');
    await waitFor(() => expect(pedidas('/api/admin/incidents').at(-1)?.searchParams.get('status')).toBe('resolved'));
    expect(await screen.findByText('No hay incidencias con estos filtros.')).toBeInTheDocument();
  });

  it('cualquier trabajador comunica una incidencia', async () => {
    const { enviados } = api();
    renderRoute('/admin/incidents');
    await userEvent.click(await screen.findByRole('button', { name: 'Comunicar incidencia' }));
    const ventana = screen.getByRole('dialog', { name: 'Comunicar incidencia' });
    await userEvent.click(within(ventana).getByRole('button', { name: 'Enviar' }));
    expect(await within(ventana).findByText('Escribe un título corto.')).toBeInTheDocument();
    expect(within(ventana).getByText('Describe lo que pasa.')).toBeInTheDocument();
    expect(within(ventana).getByText('Elige una zona o un animal.')).toBeInTheDocument();

    await userEvent.selectOptions(within(ventana).getByLabelText('Tipo'), 'Instalaciones');
    await userEvent.selectOptions(within(ventana).getByLabelText('Gravedad'), 'Alta');
    await userEvent.selectOptions(within(ventana).getByLabelText('Zona'), 'Gran voladero');
    await userEvent.type(within(ventana).getByLabelText('Título'), 'Puerta rota');
    await userEvent.type(within(ventana).getByLabelText('Qué pasa'), 'La puerta no cierra.');
    expect(within(ventana).getByText(/se avisan al momento/)).toBeInTheDocument();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Incidencia comunicada')).toBeInTheDocument();
    expect(enviados('/api/admin/incidents').filter(Boolean)).toEqual([
      {
        category: 'facilities',
        severity: 'high',
        title: 'Puerta rota',
        description: 'La puerta no cierra.',
        zoneId: 1,
        animalId: null,
      },
    ]);
  });
});

describe('CU-70 Foto de la incidencia', () => {
  it('la foto elegida se envía con la incidencia', async () => {
    const { fetchMock } = api();
    renderRoute('/admin/incidents');
    await userEvent.click(await screen.findByRole('button', { name: 'Comunicar incidencia' }));
    const ventana = screen.getByRole('dialog', { name: 'Comunicar incidencia' });
    await userEvent.selectOptions(within(ventana).getByLabelText('Zona'), 'Gran voladero');
    await userEvent.type(within(ventana).getByLabelText('Título'), 'Malla rota');
    await userEvent.type(within(ventana).getByLabelText('Qué pasa'), 'La malla está rota.');
    const archivo = new File([new Uint8Array(10)], 'malla.jpg', { type: 'image/jpeg' });
    await userEvent.upload(within(ventana).getByLabelText('Elegir foto'), archivo);
    expect(within(ventana).getByText('malla.jpg')).toBeInTheDocument();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Incidencia comunicada')).toBeInTheDocument();
    const envio = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === '/api/admin/incidents' && init?.method === 'POST',
    );
    const cuerpo = envio?.[1]?.body;
    expect(cuerpo).toBeInstanceOf(FormData);
    expect((cuerpo as FormData).get('files')).toBe(archivo);
  });
});

describe('CU-70 Ficha de una incidencia', () => {
  it('el cuidador la ve y puede resolverla, pero no crear una tarea', async () => {
    api(caretaker(), { '/api/admin/incidents/2': () => ({ body: incidencia() }) });
    renderRoute('/admin/incidents/2');
    expect(await screen.findByRole('heading', { level: 1, name: 'Incidencia n.º 2' })).toBeInTheDocument();
    expect(screen.getByText('Pipa cojea de la pata derecha desde esta mañana.')).toBeInTheDocument();
    expect(screen.getByText(/Comunicada por Nuria Peris Gil/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolver' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear tarea' })).not.toBeInTheDocument();
  });

  it('el administrador la resuelve explicando cómo', async () => {
    const { enviados } = api(admin(), {
      '/api/admin/incidents/2': () => ({ body: incidencia() }),
      '/api/admin/incidents/2/status': (_u, p) => ({
        body: incidencia({
          status: 'resolved',
          resolution: (p.body as { note: string }).note,
          resolvedBy: { id: 1, name: 'Marta Soler Ferrer' },
          resolvedAt: '2026-11-23T12:00:00.000Z',
        }),
      }),
    });
    renderRoute('/admin/incidents/2');
    await userEvent.click(await screen.findByRole('button', { name: 'Resolver' }));
    const ventana = screen.getByRole('dialog', { name: 'Resolver la incidencia' });
    await userEvent.click(within(ventana).getByRole('button', { name: 'Marcar como resuelta' }));
    expect(await within(ventana).findByText('Explica cómo se ha resuelto.')).toBeInTheDocument();
    await userEvent.type(
      within(ventana).getByLabelText('¿Cómo se ha resuelto?'),
      'La ha visto la veterinaria: un golpe.',
    );
    await userEvent.click(within(ventana).getByRole('button', { name: 'Marcar como resuelta' }));
    expect(await screen.findByText('Incidencia resuelta')).toBeInTheDocument();
    expect(enviados('/api/admin/incidents/2/status').filter(Boolean)).toEqual([
      { status: 'resolved', note: 'La ha visto la veterinaria: un golpe.' },
    ]);
  });

  it('el administrador crea una tarea a partir de ella, con el animal y la zona ya puestos', async () => {
    const { enviados } = api(admin(), {
      '/api/admin/incidents/2': () => ({ body: incidencia() }),
      '/api/admin/animals': () => ({
        body: page([{ id: 14, name: 'Pipa', status: 'in_treatment' }]),
      }),
      '/api/admin/incidents/2/task': () => ({
        status: 201,
        body: { incident: incidencia({ status: 'in_progress', taskId: 77 }), task: tarea({ id: 77 }) },
      }),
    });
    renderRoute('/admin/incidents/2');
    await userEvent.click(await screen.findByRole('button', { name: 'Crear tarea' }));
    const ventana = screen.getByRole('dialog', { name: 'Tarea de la incidencia n.º 2' });
    expect(within(ventana).getByLabelText('Título')).toHaveValue('Cojera de Pipa');
    await userEvent.type(within(ventana).getByLabelText('Hora'), '16:00');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Tarea creada')).toBeInTheDocument();
    expect(enviados('/api/admin/incidents/2/task')).toEqual([
      expect.objectContaining({ zoneId: 4, animalIds: [14], dueTime: '16:00', type: 'health_check' }),
    ]);
  });

  it('una resuelta muestra cómo se resolvió y se puede reabrir; ya no hay «Cambiar el estado»', async () => {
    const resuelta = incidencia({
      status: 'resolved',
      resolution: 'Vendaje y reposo.',
      resolvedBy: { id: 1, name: 'Marta Soler Ferrer' },
      resolvedAt: '2026-11-23T12:00:00.000Z',
    });
    const { enviados } = api(caretaker(), {
      '/api/admin/incidents/2': () => ({ body: resuelta }),
      '/api/admin/incidents/2/status': () => ({ body: incidencia() }),
    });
    renderRoute('/admin/incidents/2');
    const resolucion = within(await screen.findByRole('region', { name: 'Resolución' }));
    expect(resolucion.getByText('Vendaje y reposo.')).toBeInTheDocument();
    expect(resolucion.getByText(/Resuelta por Marta Soler Ferrer/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambiar el estado' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    expect(await screen.findByText('Incidencia reabierta')).toBeInTheDocument();
    expect(enviados('/api/admin/incidents/2/status').filter(Boolean)).toEqual([{ status: 'open' }]);
  });

  it('muestra la descripción bajo «Qué pasa»', async () => {
    api(caretaker(), { '/api/admin/incidents/2': () => ({ body: incidencia() }) });
    renderRoute('/admin/incidents/2');
    expect(await screen.findByRole('heading', { level: 2, name: 'Cojera de Pipa' })).toBeInTheDocument();
    const descripcion = within(await screen.findByRole('region', { name: 'Qué pasa' }));
    expect(descripcion.getByText('Pipa cojea de la pata derecha desde esta mañana.')).toBeInTheDocument();
  });

  it('una que no existe', async () => {
    api(caretaker(), { '/api/admin/incidents/99': () => errorApi(404, 'NOT_FOUND', 'Esta incidencia no existe.') });
    renderRoute('/admin/incidents/99');
    expect(await screen.findByText('Esta incidencia no existe.')).toBeInTheDocument();
  });
});
