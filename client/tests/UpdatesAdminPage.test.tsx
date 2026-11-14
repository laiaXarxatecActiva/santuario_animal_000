import type { AdminUpdateListItemDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adminAnimal, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

const fila = (overrides: Partial<AdminUpdateListItemDto> = {}): AdminUpdateListItemDto => ({
  id: 2,
  animal: { id: 1, name: 'Rufo' },
  author: { id: 3, name: 'Nuria Peris Gil' },
  title: 'Revisión del ala',
  visibility: 'adopters',
  publishedAt: '2026-11-11T11:30:00.000Z',
  photoCount: 1,
  canEdit: true,
  ...overrides,
});

const lista = [
  fila(),
  fila({
    id: 3,
    animal: { id: 8, name: 'Sombra' },
    author: { id: 4, name: 'Andrés Climent Mas' },
    title: 'Sombra y el enriquecimiento',
    visibility: 'public',
    photoCount: 0,
    canEdit: false,
  }),
];

const pagina = (data: AdminUpdateListItemDto[]) => ({
  body: { data, meta: { page: 1, pageSize: 20, total: data.length, totalPages: 1 } },
});

function api(extra: Record<string, Handler> = {}, data = lista) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/updates': () => pagina(data),
    '/api/admin/animals': {
      body: {
        data: [adminAnimal(), adminAnimal({ id: 8, name: 'Sombra' })],
        meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
      },
    },
    ...extra,
  });
}

describe('CU-31 y CU-32: listado de actualizaciones del panel', () => {
  it('lista las actualizaciones con su fecha, animal, título, visibilidad y autor', async () => {
    api();
    renderRoute('/admin/updates');
    expect(await screen.findByRole('heading', { level: 1, name: 'Actualizaciones' })).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Menú del panel' });
    expect(within(menu).getByRole('link', { name: 'Actualizaciones' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Nueva actualización' })).toHaveAttribute('href', '/admin/updates/new');

    const filas = within(await screen.findByRole('table'))
      .getAllByRole('row')
      .slice(1);
    expect(filas).toHaveLength(2);
    expect(within(filas[0]!).getByText('11 de noviembre de 2026')).toBeInTheDocument();
    expect(within(filas[0]!).getByText('Rufo')).toBeInTheDocument();
    expect(within(filas[0]!).getByText('Revisión del ala')).toBeInTheDocument();
    expect(within(filas[0]!).getByText('Solo adoptantes')).toBeInTheDocument();
    expect(within(filas[0]!).getByText('Nuria Peris Gil')).toBeInTheDocument();
    expect(within(filas[1]!).getByText('Pública')).toBeInTheDocument();
  });

  it('CU-32 1a: las acciones solo aparecen en las que se pueden modificar', async () => {
    api();
    renderRoute('/admin/updates');
    expect(await screen.findByRole('link', { name: 'Editar Revisión del ala' })).toHaveAttribute(
      'href',
      '/admin/updates/2',
    );
    expect(screen.getByRole('button', { name: 'Borrar Revisión del ala' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar Sombra y el enriquecimiento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar Sombra y el enriquecimiento' })).not.toBeInTheDocument();
  });

  it('filtra por animal, visibilidad y autor', async () => {
    const { pedidas } = api();
    renderRoute('/admin/updates');
    await screen.findByRole('table');
    await userEvent.selectOptions(await screen.findByLabelText('Animal'), 'Rufo');
    await userEvent.selectOptions(screen.getByLabelText('Visibilidad'), 'Pública');
    await userEvent.selectOptions(screen.getByLabelText('Autor'), 'Las mías');
    await waitFor(() => {
      const ultima = pedidas('/api/admin/updates').at(-1)!;
      expect(ultima.searchParams.get('animalId')).toBe('1');
      expect(ultima.searchParams.get('visibility')).toBe('public');
      expect(ultima.searchParams.get('authorId')).toBe('3');
    });
  });

  it('CU-32 borrado: pide confirmación y borra', async () => {
    const { pedidas } = api({
      '/api/admin/updates/2': () => ({ status: 204 }),
    });
    renderRoute('/admin/updates');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar Revisión del ala' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Borrar «Revisión del ala»?' });
    expect(
      within(ventana).getByText('Se borrarán también sus fotos. Esta acción no se puede deshacer.'),
    ).toBeInTheDocument();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText('Actualización borrada.')).toBeInTheDocument();
    expect(pedidas('/api/admin/updates/2')).toHaveLength(1);
  });

  it('sin resultados muestra un mensaje', async () => {
    api({}, []);
    renderRoute('/admin/updates');
    expect(await screen.findByText('No hay actualizaciones con estos filtros.')).toBeInTheDocument();
  });
});
