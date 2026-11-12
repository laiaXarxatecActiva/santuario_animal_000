import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Checkbox, PasswordField, TextField } from '../src/components/FormFields';

describe('campos de formulario (DESIGN_SYSTEM §8.5)', () => {
  it('TextField: etiqueta visible, ayuda y error enlazados con aria-describedby', () => {
    render(<TextField label="Email" help="Lo usaremos para avisarte." error="Introduce un email válido." />);
    const campo = screen.getByLabelText('Email');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Lo usaremos para avisarte. Introduce un email válido.');
  });

  it('TextField sin error no está marcado como inválido', () => {
    render(<TextField label="Nombre" />);
    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
  });

  it('PasswordField permite mostrar y ocultar la contraseña', async () => {
    render(<PasswordField label="Contraseña" />);
    const campo = screen.getByLabelText('Contraseña');
    expect(campo).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campo).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(campo).toHaveAttribute('type', 'password');
  });

  it('Checkbox con su error', () => {
    render(<Checkbox label="Acepto" error="Tienes que aceptar." />);
    const casilla = screen.getByRole('checkbox', { name: 'Acepto' });
    expect(casilla).toHaveAttribute('aria-invalid', 'true');
    expect(casilla).toHaveAccessibleDescription('Tienes que aceptar.');
  });
});
