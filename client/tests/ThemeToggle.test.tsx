import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from '../src/components/ThemeToggle';

describe('ThemeToggle', () => {
  it('cambia entre modo claro y oscuro y lo recuerda', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    render(<ThemeToggle />);
    const boton = screen.getByRole('button', { name: 'Activar modo oscuro' });
    expect(boton).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(boton);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Activar modo claro' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('parte del tema que ya ha aplicado index.html', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Activar modo claro' })).toBeInTheDocument();
  });
});
