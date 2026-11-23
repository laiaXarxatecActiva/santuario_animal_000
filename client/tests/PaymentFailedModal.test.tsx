import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentFailedModal } from '../src/components/PaymentFailedModal';

const MENSAJE = 'El pago no se ha completado. Puedes intentarlo de nuevo.';

function abrir() {
  const onRetry = vi.fn();
  const onClose = vi.fn();
  render(<PaymentFailedModal open message={MENSAJE} onRetry={onRetry} onClose={onClose} />);
  return { onRetry, onClose, dialogo: screen.getByRole('dialog', { name: 'Pago rechazado' }) };
}

describe('CU-05, CU-13, CU-14 Aviso emergente del pago rechazado', () => {
  it('muestra el mensaje de la página como error', () => {
    const { dialogo } = abrir();
    expect(within(dialogo).getByRole('alert')).toHaveTextContent(MENSAJE);
  });

  it('«Volver a intentarlo» pide reintentar el pago', async () => {
    const { dialogo, onRetry, onClose } = abrir();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Volver a intentarlo' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('«Ahora no» y la ✕ la cierran', async () => {
    const { dialogo, onRetry, onClose } = abrir();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ahora no' }));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('cerrada, no se ve', () => {
    render(<PaymentFailedModal open={false} message={MENSAJE} onRetry={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
