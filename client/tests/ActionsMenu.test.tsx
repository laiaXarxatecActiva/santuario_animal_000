import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionsMenu } from '../src/components/ActionsMenu';

describe('ActionsMenu (DESIGN_SYSTEM §8.9)', () => {
  it('abre el menú, ejecuta la opción elegida y se cierra', async () => {
    const elegir = vi.fn();
    render(<ActionsMenu label="Más acciones de Rufo" items={[{ label: 'Cambiar plan', onSelect: elegir }]} />);
    const boton = screen.getByRole('button', { name: 'Más acciones de Rufo' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cambiar plan' }));
    expect(elegir).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Esc lo cierra y devuelve el foco al botón; pulsar fuera también lo cierra', async () => {
    render(
      <>
        <ActionsMenu label="Más acciones" items={[{ label: 'Opción', onSelect: () => {} }]} />
        <p>fuera</p>
      </>,
    );
    const boton = screen.getByRole('button', { name: 'Más acciones' });
    await userEvent.click(boton);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
    await userEvent.click(boton);
    await userEvent.click(screen.getByText('fuera'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('una opción puede ser un enlace de descarga, y al elegirla se cierra el menú', async () => {
    render(
      <ActionsMenu
        label="Más acciones"
        items={[
          { label: 'Forma de pago', onSelect: () => {} },
          { label: 'Descargar certificado', href: '/api/me/adoptions/1/certificate?download=1', download: true },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    const enlace = screen.getByRole('menuitem', { name: 'Descargar certificado' });
    expect(enlace.tagName).toBe('A');
    expect(enlace).toHaveAttribute('href', '/api/me/adoptions/1/certificate?download=1');
    expect(enlace).toHaveAttribute('download');
    enlace.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(enlace);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('sin opciones no se muestra', () => {
    render(<ActionsMenu label="Más acciones" items={[]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('el panel lleva la animación de los desplegables y se queda oculto al cerrarse para poder animarlo', async () => {
    render(<ActionsMenu label="Más acciones" items={[{ label: 'Opción', onSelect: () => {} }]} />);
    const boton = screen.getByRole('button', { name: 'Más acciones' });
    const panel = document.getElementById(boton.getAttribute('aria-controls') ?? '');
    expect(panel).toHaveAttribute('hidden');
    await userEvent.click(boton);
    expect(screen.getByRole('menu')).toHaveClass('dropdown-panel');
  });
});
