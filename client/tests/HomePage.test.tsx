import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { card } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

describe('CU-01 Consultar la página de inicio', () => {
  it('muestra la presentación, el número de animales acogidos y los destacados', async () => {
    mockApi({
      '/api/home': {
        body: {
          shelteredCount: 12,
          featured: [card({ id: 6, name: 'Canelo', adopterCount: 0 }), card({ id: 5, name: 'Brisa' })],
        },
      },
    });
    renderRoute('/');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Un hogar para siempre para los buitres' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/animales acogidos/)).toHaveTextContent('12 animales acogidos');
    const destacados = screen.getByRole('region', { name: 'Conoce a quienes viven aquí' });
    expect(within(destacados).getByRole('link', { name: /Canelo/ })).toHaveAttribute('href', '/animals/6');
    expect(within(destacados).getByRole('link', { name: /Brisa/ })).toBeInTheDocument();
  });

  it('la foto destacada es la portada del primer destacado', async () => {
    mockApi({ '/api/home': { body: { shelteredCount: 1, featured: [card()] } } });
    renderRoute('/');
    const fotos = await screen.findAllByRole('img', { name: /posado en una rampa/ });
    expect(fotos[0]).toHaveAttribute('src', '/uploads/animals/1/cover.jpg');
  });

  it('tiene las dos llamadas a la acción', () => {
    mockApi({ '/api/home': { body: { shelteredCount: 0, featured: [] } } });
    renderRoute('/');
    expect(screen.getByRole('link', { name: 'Adopta a distancia' })).toHaveAttribute('href', '/animals');
    expect(screen.getByRole('link', { name: 'Haz una donación' })).toHaveAttribute('href', '/donate');
    expect(screen.getByRole('link', { name: 'Saber más' })).toHaveAttribute('href', '/how-it-works');
  });

  it('2a: sin animales publicados se oculta la sección de destacados', async () => {
    mockApi({ '/api/home': { body: { shelteredCount: 0, featured: [] } } });
    renderRoute('/');
    expect(await screen.findByText(/animales acogidos/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Conoce a quienes viven aquí' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Adopta a distancia' })).toBeInTheDocument();
  });
});
