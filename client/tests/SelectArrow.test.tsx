import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SelectArrow } from '../src/components/SelectArrow';

function Ejemplo() {
  const [valor, setValor] = useState('a');
  return (
    <SelectArrow>
      <select aria-label="Orden" value={valor} onChange={(e) => setValor(e.target.value)}>
        <option value="a">Primero</option>
        <option value="b">Segundo</option>
      </select>
    </SelectArrow>
  );
}

describe('desplegable con la flecha del sistema de diseño (DESIGN_SYSTEM §8.5)', () => {
  it('muestra el icono chevron-down, oculto para los lectores de pantalla', () => {
    const { container } = render(<Ejemplo />);
    const flecha = container.querySelector('svg[data-icon="chevron-down"]');
    expect(flecha).not.toBeNull();
    expect(flecha).toHaveAttribute('aria-hidden', 'true');
  });

  it('el desplegable nativo sigue funcionando', async () => {
    render(<Ejemplo />);
    const selector = screen.getByRole('combobox', { name: 'Orden' });
    await userEvent.selectOptions(selector, 'Segundo');
    expect(selector).toHaveValue('b');
  });
});
