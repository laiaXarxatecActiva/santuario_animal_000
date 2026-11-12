import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PublicHeader } from '../src/components/PublicHeader';

const pintar = (ruta = '/') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <PublicHeader />
    </MemoryRouter>,
  );

describe('PublicHeader', () => {
  it('muestra los enlaces del visitante y marca el activo', () => {
    pintar('/animals');
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Animales' })[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: 'Cómo funciona' })[0]).toHaveAttribute('href', '/how-it-works');
    expect(screen.getAllByRole('link', { name: 'Entrar' })[0]).toHaveAttribute('href', '/login');
  });

  it('el menú de hamburguesa se abre y se cierra con Esc', async () => {
    pintar();
    const boton = screen.getByRole('button', { name: 'Abrir el menú' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(boton);
    expect(screen.getByRole('button', { name: 'Cerrar el menú' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Abrir el menú' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('el menú se cierra al elegir un enlace', async () => {
    pintar();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir el menú' }));
    const menu = document.getElementById(
      screen.getByRole('button', { name: 'Cerrar el menú' }).getAttribute('aria-controls') ?? '',
    );
    const enlace = [...(menu?.querySelectorAll('a') ?? [])].find((a) => a.textContent === 'Animales');
    await userEvent.click(enlace!);
    expect(screen.getByRole('button', { name: 'Abrir el menú' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('el botón de tema está siempre visible, fuera del menú', () => {
    pintar();
    expect(screen.getByRole('button', { name: 'Activar modo oscuro' })).toBeVisible();
  });
});
