import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockApi, renderRoute } from './helpers/render';

describe('Política de privacidad (SCREENS §3.9)', () => {
  it('explica qué datos se guardan, que no se guardan datos de tarjeta y los derechos', async () => {
    mockApi({});
    renderRoute('/privacy');
    expect(await screen.findByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeInTheDocument();
    for (const seccion of [
      'Quién es el responsable',
      'Qué datos guardamos',
      'Para qué los usamos',
      'Cuánto tiempo los guardamos',
      'Con quién los compartimos',
      'Tus derechos',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: seccion })).toBeInTheDocument();
    }
    expect(screen.getByText(/Nunca guardamos datos de tarjetas/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: 'política de cookies' })).toHaveAttribute('href', '/cookies');
  });

  it('el enlace de la casilla del registro lleva a esta página', async () => {
    mockApi({});
    renderRoute('/register');
    expect(await screen.findByRole('link', { name: 'política de privacidad' })).toHaveAttribute('href', '/privacy');
  });
});
