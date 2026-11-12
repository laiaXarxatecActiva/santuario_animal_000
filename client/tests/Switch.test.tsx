import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Switch } from '../src/components/Switch';

describe('Switch', () => {
  it('es un interruptor accesible con el estado escrito al lado', async () => {
    render(<Switch label="Recibir emails" defaultChecked />);
    const interruptor = screen.getByRole('switch', { name: 'Recibir emails' });
    expect(interruptor).toBeChecked();
    expect(screen.getByText('Sí')).toBeInTheDocument();
    await userEvent.click(interruptor);
    expect(interruptor).not.toBeChecked();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('muestra la ayuda enlazada al interruptor', () => {
    render(<Switch label="Mostrar mi nombre" help="Solo tu nombre de pila." />);
    expect(screen.getByRole('switch', { name: 'Mostrar mi nombre' })).toHaveAccessibleDescription(
      'Solo tu nombre de pila.',
    );
  });
});
