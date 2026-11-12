import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute } from './helpers/render';

describe('Página no encontrada', () => {
  it('cualquier ruta desconocida muestra la 404 con la cabecera normal', () => {
    renderRoute('/donate');
    expect(screen.getByRole('heading', { level: 1, name: 'Esta página ha volado lejos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
  });
});
