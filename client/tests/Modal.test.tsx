import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../src/components/Modal';

describe('Modal (DESIGN_SYSTEM §8.4)', () => {
  it('abierta, muestra el título y el contenido como diálogo', () => {
    render(
      <Modal open title="Pago simulado" onClose={() => {}}>
        <p>Contenido</p>
      </Modal>,
    );
    const dialogo = screen.getByRole('dialog', { name: 'Pago simulado' });
    expect(dialogo).toHaveAttribute('open');
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('cerrada, no se ve', () => {
    render(
      <Modal open={false} title="Pago simulado" onClose={() => {}}>
        <p>Contenido</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('el botón ✕ la cierra', async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Pago simulado" onClose={onClose}>
        <p>Contenido</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('si no se puede cerrar, no hay botón ✕', () => {
    render(
      <Modal open title="Pago simulado" onClose={() => {}} closable={false}>
        <p>Contenido</p>
      </Modal>,
    );
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
  });
});
