import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockApi, renderRoute } from './helpers/render';

describe('Sobre el santuario (SCREENS §3.6, Fase 1)', () => {
  it('cuenta la historia y la ubicación, y enlaza al catálogo', async () => {
    mockApi({});
    renderRoute('/about');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sobre el santuario' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Nuestra historia' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Dónde estamos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver animales' })).toHaveAttribute('href', '/animals');
  });

  it('el enlace «Contacto» del pie lleva a esta página', async () => {
    mockApi({});
    renderRoute('/how-it-works');
    expect(await screen.findByRole('link', { name: 'Contacto' })).toHaveAttribute('href', '/about');
  });
});
