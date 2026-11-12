import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminAnimal, adminSpecies, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

function api(
  opciones: {
    user?: ReturnType<typeof caretaker>;
    animal?: ReturnType<typeof adminAnimal>;
    extra?: Record<string, Handler>;
  } = {},
) {
  const animal = opciones.animal ?? adminAnimal();
  return mockApi({
    '/api/auth/me': { body: { user: opciones.user ?? caretaker() } },
    '/api/admin/species': { body: { data: adminSpecies } },
    [`/api/admin/animals/${animal.id}`]: (_u, p) =>
      p.method === 'GET' ? { body: animal } : { body: { ...animal, ...(p.body as object) } },
    ...opciones.extra,
  });
}

describe('CU-28 Gestionar animales: alta', () => {
  it('1-3: rellena el formulario, crea el animal y abre su ficha', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/species': { body: { data: adminSpecies } },
      '/api/admin/animals': { status: 201, body: adminAnimal({ id: 16, name: 'Lucero' }) },
      '/api/admin/animals/16': { body: adminAnimal({ id: 16, name: 'Lucero' }) },
    });
    const { router } = renderRoute('/admin/animals/new');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nuevo animal' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lucero');
    await userEvent.selectOptions(await screen.findByLabelText('Especie'), 'Alimoche común');
    await userEvent.selectOptions(screen.getByLabelText('Sexo'), 'Hembra');
    await userEvent.type(screen.getByLabelText('Fecha de llegada'), '2026-11-01');
    await userEvent.type(screen.getByLabelText('Historia del rescate (opcional)'), 'Apareció agotada.');
    await userEvent.click(screen.getByRole('switch', { name: 'Publicado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear animal' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/animals/16'));
    expect(await screen.findByText('Animal creado')).toBeInTheDocument();
    expect(enviados('/api/admin/animals')[0]).toMatchObject({
      name: 'Lucero',
      speciesId: 3,
      sex: 'female',
      arrivalDate: '2026-11-01',
      approxBirthDate: null,
      breed: null,
      rescueStory: 'Apareció agotada.',
      isPublished: true,
      isAdoptable: true,
    });
  });

  it('2a: nacimiento posterior a la llegada da error en el campo', async () => {
    const { pedidas } = mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/species': { body: { data: adminSpecies } },
    });
    renderRoute('/admin/animals/new');
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Lucero');
    await userEvent.selectOptions(await screen.findByLabelText('Especie'), 'Alimoche común');
    await userEvent.type(screen.getByLabelText('Fecha de nacimiento aproximada (opcional)'), '2026-11-05');
    await userEvent.type(screen.getByLabelText('Fecha de llegada'), '2026-11-01');
    await userEvent.click(screen.getByRole('button', { name: 'Crear animal' }));
    expect(
      await screen.findByText('La fecha de nacimiento no puede ser posterior a la de llegada.'),
    ).toBeInTheDocument();
    expect(pedidas('/api/admin/animals')).toHaveLength(0);
  });
});

describe('CU-28 Gestionar animales: ficha y edición', () => {
  it('2: muestra los datos y guarda los cambios', async () => {
    const { enviados } = api();
    renderRoute('/admin/animals/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Rufo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Datos' })).toHaveAttribute('aria-current', 'page');
    const caracter = await screen.findByLabelText('Carácter (opcional)');
    expect(caracter).toHaveValue('Tranquilo.');
    await userEvent.clear(caracter);
    await userEvent.type(caracter, 'Muy tranquilo.');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1').at(-1)).toMatchObject({ temperament: 'Muy tranquilo.', speciesId: 1 });
  });

  it('enlace a la web pública si está publicado', async () => {
    api();
    renderRoute('/admin/animals/1');
    expect(await screen.findByRole('link', { name: /Ver en la web/ })).toHaveAttribute('href', '/animals/1');
  });

  it('2b: un animal archivado no puede admitir adopciones', async () => {
    api({ animal: adminAnimal({ id: 12, name: 'Faro', status: 'deceased', isAdoptable: false }) });
    renderRoute('/admin/animals/12');
    expect(await screen.findByRole('switch', { name: 'Admite adopciones' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cambiar estado' })).not.toBeInTheDocument();
  });

  it('un animal que no existe', async () => {
    mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/animals/99': errorApi(404, 'NOT_FOUND', 'Este animal no existe.'),
    });
    renderRoute('/admin/animals/99');
    expect(await screen.findByText('Este animal no existe')).toBeInTheDocument();
  });
});

describe('CU-28 Gestionar animales: estado', () => {
  it('A2: cambio directo a «En tratamiento»', async () => {
    const { enviados } = api({
      extra: { '/api/admin/animals/1/status': () => ({ body: adminAnimal({ status: 'in_treatment' }) }) },
    });
    renderRoute('/admin/animals/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar estado' }));
    await userEvent.click(screen.getByRole('button', { name: 'En tratamiento' }));
    expect(await screen.findByText('Estado cambiado a «En tratamiento»')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/status')).toEqual([{ status: 'in_treatment' }]);
  });

  it('A3: fallecido pide confirmación, la fecha y avisa de las adopciones que se cierran', async () => {
    const { enviados } = api({
      extra: {
        '/api/admin/animals/1/status': () => ({
          body: adminAnimal({ status: 'deceased', isAdoptable: false, openAdoptions: 0 }),
        }),
      },
    });
    renderRoute('/admin/animals/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar estado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fallecido' }));
    const dialogo = screen.getByRole('dialog', { name: '¿Registrar el fallecimiento de Rufo?' });
    expect(within(dialogo).getByText(/Se cerrarán sus 2 adopciones abiertas/)).toBeInTheDocument();
    const fecha = within(dialogo).getByLabelText('Fecha');
    await userEvent.clear(fecha);
    await userEvent.type(fecha, '2026-11-10');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByText('Estado cambiado a «Fallecido»')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/status')).toEqual([{ status: 'deceased', date: '2026-11-10' }]);
  });
});

describe('CU-28 A4 Borrar un animal', () => {
  it('el cuidador no puede borrar', async () => {
    api({ animal: adminAnimal({ hasAdoptionHistory: false }) });
    renderRoute('/admin/animals/1');
    await screen.findByRole('heading', { level: 1, name: 'Rufo' });
    expect(screen.queryByRole('button', { name: 'Borrar animal' })).not.toBeInTheDocument();
  });

  it('RN-17: con historial de adopciones se explica que hay que archivarlo', async () => {
    api({ user: admin() });
    renderRoute('/admin/animals/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar animal' }));
    expect(
      screen.getByText('Este animal tiene historial de adopciones; archívalo cambiando su estado.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sin historial, borra tras confirmar y vuelve al listado', async () => {
    const animal = adminAnimal({
      id: 15,
      name: 'Roca',
      hasAdoptionHistory: false,
      activeAdopters: 0,
      openAdoptions: 0,
    });
    const { pedidas } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/species': { body: { data: adminSpecies } },
      '/api/admin/animals/15': (_u, p) => (p.method === 'DELETE' ? { status: 204 } : { body: animal }),
      '/api/admin/animals': { body: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } },
    });
    const { router } = renderRoute('/admin/animals/15');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar animal' }));
    const dialogo = screen.getByRole('dialog', { name: '¿Borrar a Roca?' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/animals'));
    expect(await screen.findByText('Roca se ha borrado')).toBeInTheDocument();
    expect(pedidas('/api/admin/animals/15').length).toBeGreaterThan(0);
  });
});
