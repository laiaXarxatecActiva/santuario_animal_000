import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AnimalCard } from '../src/components/AnimalCard';
import { card } from './helpers/fixtures';

const pintar = (overrides: Parameters<typeof card>[0] = {}) =>
  render(
    <MemoryRouter>
      <AnimalCard animal={card(overrides)} />
    </MemoryRouter>,
  );

describe('AnimalCard', () => {
  it('toda la tarjeta es un único enlace a la ficha, con el nombre', () => {
    pintar();
    const enlace = screen.getByRole('link');
    expect(enlace).toHaveAttribute('href', '/animals/1');
    expect(enlace).toHaveAccessibleName(/Rufo/);
    expect(screen.getByRole('heading', { name: 'Rufo' })).toBeInTheDocument();
  });

  it('muestra especie, sexo, adoptantes y la miniatura con su texto alternativo', () => {
    pintar();
    expect(screen.getByText('Buitre leonado · Macho')).toBeInTheDocument();
    expect(screen.getByText('2 adoptantes')).toBeInTheDocument();
    const foto = screen.getByRole('img', { name: /posado en una rampa/ });
    expect(foto).toHaveAttribute('src', '/uploads/animals/1/thumb_cover.jpg');
    expect(foto).toHaveAttribute('loading', 'lazy');
  });

  it('singular y sin adoptantes', () => {
    pintar({ adopterCount: 1 });
    expect(screen.getByText('1 adoptante')).toBeInTheDocument();
    pintar({ id: 2, adopterCount: 0 });
    expect(screen.getByText('Sin adoptantes todavía')).toBeInTheDocument();
  });

  it('insignias de «En tratamiento» y «No disponible para adoptar»', () => {
    pintar({ status: 'in_treatment', isAdoptable: false });
    expect(screen.getByText('En tratamiento')).toBeInTheDocument();
    expect(screen.getByText('No disponible para adoptar')).toBeInTheDocument();
  });
});
