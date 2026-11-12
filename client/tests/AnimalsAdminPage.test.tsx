import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adminAnimal, adminSpecies, caretaker, page } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const animales = [
  adminAnimal(),
  adminAnimal({
    id: 14,
    name: 'Pipa',
    status: 'in_treatment',
    isPublished: false,
    isAdoptable: false,
    activeAdopters: 0,
  }),
  adminAnimal({ id: 12, name: 'Faro', status: 'deceased', isAdoptable: false, activeAdopters: 0 }),
];

function api() {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/species': { body: { data: adminSpecies } },
    '/api/admin/animals': { body: page(animales) },
  });
}

describe('CU-28 Gestionar animales: listado', () => {
  it('1: muestra todos los animales con su estado, publicación y adoptantes', async () => {
    api();
    renderRoute('/admin/animals');
    expect(await screen.findByRole('heading', { level: 1, name: 'Animales' })).toBeInTheDocument();
    const pipa = (await screen.findByRole('link', { name: 'Pipa' })).closest('tr') as HTMLElement;
    expect(within(pipa).getByText('En tratamiento')).toBeInTheDocument();
    expect(within(pipa).getByText('Oculto')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pipa' })).toHaveAttribute('href', '/admin/animals/14');
    const rufo = screen.getByRole('link', { name: 'Rufo' }).closest('tr') as HTMLElement;
    expect(within(rufo).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3 resultados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo animal' })).toHaveAttribute('href', '/admin/animals/new');
  });

  it('1: busca por nombre y filtra por especie, estado, publicado y adoptable', async () => {
    const { pedidas } = api();
    const { router } = renderRoute('/admin/animals');
    await screen.findByRole('link', { name: 'Rufo' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), 'ebano{Enter}');
    await userEvent.selectOptions(screen.getByLabelText('Especie'), 'Buitre leonado');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Fallecido');
    await userEvent.selectOptions(screen.getByLabelText('Publicado'), 'No');
    await userEvent.selectOptions(screen.getByLabelText('Adoptable'), 'Sí');
    await waitFor(() =>
      expect(router.state.location.search).toBe('?q=ebano&speciesId=1&status=deceased&published=false&adoptable=true'),
    );
    const ultima = pedidas('/api/admin/animals').at(-1)!;
    expect(Object.fromEntries(ultima.searchParams)).toMatchObject({
      q: 'ebano',
      speciesId: '1',
      status: 'deceased',
      published: 'false',
      adoptable: 'true',
    });
  });

  it('sin resultados, lo dice', async () => {
    mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/species': { body: { data: adminSpecies } },
      '/api/admin/animals': { body: page([]) },
    });
    renderRoute('/admin/animals?q=zzz');
    expect(await screen.findByText('No hay animales con estos filtros')).toBeInTheDocument();
  });
});
