import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminSpecies, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';

function api(
  user = caretaker(),
  extra: Record<string, (u: URL, p: Peticion) => { status?: number; body?: unknown }> = {},
) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/species': { body: { data: adminSpecies } },
    ...extra,
  });
}

const fila = async (nombre: string) => (await screen.findByRole('cell', { name: nombre })).closest('tr') as HTMLElement;

describe('CU-30 Gestionar especies', () => {
  it('2: lista las especies con el nombre científico y el número de animales', async () => {
    api();
    renderRoute('/admin/species');
    expect(await screen.findByRole('heading', { level: 1, name: 'Especies' })).toBeInTheDocument();
    const leonado = await fila('Buitre leonado');
    expect(within(leonado).getByText('Gyps fulvus')).toBeInTheDocument();
    expect(within(leonado).getByText('9')).toBeInTheDocument();
  });

  it('3-4: crea una especie', async () => {
    const { enviados } = api(caretaker(), {
      '/api/admin/species': (_u, p) =>
        p.method === 'POST'
          ? {
              status: 201,
              body: { id: 6, name: 'Buitre moteado', scientificName: null, description: null, animalCount: 0 },
            }
          : { body: { data: adminSpecies } },
    });
    renderRoute('/admin/species');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva especie' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva especie' });
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Buitre moteado');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Especie guardada')).toBeInTheDocument();
    expect(enviados('/api/admin/species').filter(Boolean)).toEqual([
      { name: 'Buitre moteado', scientificName: '', description: '' },
    ]);
  });

  it('4a: nombre repetido muestra el error en el campo', async () => {
    api(caretaker(), {
      '/api/admin/species': (_u, p) =>
        p.method === 'POST'
          ? errorApi(409, 'SPECIES_ALREADY_EXISTS', 'Esta especie ya existe.', [
              { field: 'name', message: 'Esta especie ya existe.' },
            ])
          : { body: { data: adminSpecies } },
    });
    renderRoute('/admin/species');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva especie' }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'buitre leonado');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Esta especie ya existe.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
  });

  it('3: edita una especie con sus datos cargados', async () => {
    const { enviados } = api(caretaker(), {
      '/api/admin/species/1': () => ({ body: { ...adminSpecies[1], description: 'Nuevo texto' } }),
    });
    renderRoute('/admin/species');
    await userEvent.click(within(await fila('Buitre leonado')).getByRole('button', { name: 'Editar Buitre leonado' }));
    const descripcion = screen.getByLabelText('Descripción (opcional)');
    expect(descripcion).toHaveValue('El más común.');
    await userEvent.clear(descripcion);
    await userEvent.type(descripcion, 'Nuevo texto');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(enviados('/api/admin/species/1')).toEqual([
        { name: 'Buitre leonado', scientificName: 'Gyps fulvus', description: 'Nuevo texto' },
      ]),
    );
  });

  it('A1: el cuidador no ve el botón de borrar', async () => {
    api();
    renderRoute('/admin/species');
    await fila('Lince ibérico');
    expect(screen.queryByRole('button', { name: /^Borrar/ })).not.toBeInTheDocument();
  });

  it('A1: el administrador borra una especie sin animales tras confirmar', async () => {
    const { pedidas } = api(admin(), { '/api/admin/species/5': () => ({ status: 204 }) });
    renderRoute('/admin/species');
    await userEvent.click(within(await fila('Lince ibérico')).getByRole('button', { name: 'Borrar Lince ibérico' }));
    const dialogo = screen.getByRole('dialog', { name: '¿Borrar la especie Lince ibérico?' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText('Especie borrada')).toBeInTheDocument();
    expect(pedidas('/api/admin/species/5')).toHaveLength(1);
  });

  it('A1: con animales, avisa de cuántos hay y no la borra', async () => {
    api(admin());
    renderRoute('/admin/species');
    await userEvent.click(within(await fila('Buitre leonado')).getByRole('button', { name: 'Borrar Buitre leonado' }));
    expect(screen.getByText('Hay 9 animales de esta especie.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
