import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { card, leonado, negro, page } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const especies = { body: { data: [negro, leonado] } };

describe('CU-02 Consultar el catálogo de animales', () => {
  it('muestra las tarjetas y el total', async () => {
    mockApi({
      '/api/species': especies,
      '/api/animals': { body: page([card(), card({ id: 2, name: 'Greta', sex: 'female' })], { total: 2 }) },
    });
    renderRoute('/animals');
    expect(screen.getByRole('heading', { level: 1, name: 'Animales' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Greta/ })).toBeInTheDocument();
    expect(screen.getByText('2 animales')).toBeInTheDocument();
  });

  it('pide a la API los filtros de la URL, con el rango de edad convertido', async () => {
    const { pedidas } = mockApi({ '/api/species': especies, '/api/animals': { body: page([]) } });
    renderRoute('/animals?speciesId=2&age=adult&adoptable=true&sort=name');
    await waitFor(() => expect(pedidas('/api/animals')).toHaveLength(1));
    const params = Object.fromEntries(pedidas('/api/animals')[0]!.searchParams);
    expect(params).toEqual({
      speciesId: '2',
      minAge: '5',
      maxAge: '15',
      adoptable: 'true',
      sort: 'name',
      page: '1',
      pageSize: '12',
    });
  });

  it('al elegir un filtro lo refleja en la URL y vuelve a la primera página', async () => {
    mockApi({ '/api/species': especies, '/api/animals': { body: page([card()]) } });
    const { router } = renderRoute('/animals?page=2');
    await screen.findByRole('option', { name: 'Buitre negro' });
    await userEvent.selectOptions(screen.getByLabelText('Especie'), 'Buitre negro');
    await waitFor(() => expect(router.state.location.search).toBe('?speciesId=2'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Disponibles para adoptar' }));
    await waitFor(() => expect(router.state.location.search).toBe('?speciesId=2&adoptable=true'));
  });

  it('muestra los filtros activos y permite quitarlos uno a uno', async () => {
    mockApi({ '/api/species': especies, '/api/animals': { body: page([card()]) } });
    const { router } = renderRoute('/animals?speciesId=2&sex=female');
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar el filtro Buitre negro' }));
    await waitFor(() => expect(router.state.location.search).toBe('?sex=female'));
  });

  it('busca por nombre', async () => {
    mockApi({ '/api/species': especies, '/api/animals': { body: page([card()]) } });
    const { router } = renderRoute('/animals');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), 'ru');
    await waitFor(() => expect(router.state.location.search).toBe('?q=ru'));
  });

  it('cambia el orden', async () => {
    mockApi({ '/api/species': especies, '/api/animals': { body: page([card()]) } });
    const { router } = renderRoute('/animals');
    await userEvent.selectOptions(screen.getByLabelText('Ordenar'), 'Menos adoptantes');
    await waitFor(() => expect(router.state.location.search).toBe('?sort=adopterCount'));
  });

  it('4a: sin resultados ofrece limpiar los filtros', async () => {
    mockApi({ '/api/species': especies, '/api/animals': { body: page([]) } });
    const { router } = renderRoute('/animals?q=nadie');
    expect(await screen.findByText('No hay animales con estos filtros')).toBeInTheDocument();
    const limpiar = screen.getAllByRole('button', { name: 'Limpiar filtros' });
    await userEvent.click(limpiar[limpiar.length - 1]!);
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('pagina y muestra la página que devuelve la API (4b)', async () => {
    mockApi({
      '/api/species': especies,
      '/api/animals': { body: page([card()], { page: 3, total: 30, totalPages: 3 }) },
    });
    const { router } = renderRoute('/animals?page=9');
    expect(await screen.findByText('Página 3 de 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
  });

  it('si falla la carga muestra el error y permite reintentar', async () => {
    let fallar = true;
    const { pedidas } = mockApi({
      '/api/species': especies,
      '/api/animals': () => (fallar ? { status: 500, body: {} } : { body: page([card()]) }),
    });
    renderRoute('/animals');
    expect(await screen.findByRole('alert')).toHaveTextContent('No hemos podido cargar los animales');
    fallar = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('link', { name: /Rufo/ })).toBeInTheDocument();
    expect(pedidas('/api/animals')).toHaveLength(2);
  });
});
