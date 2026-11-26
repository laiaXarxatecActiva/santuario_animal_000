import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { Checkbox, PasswordField, SelectField, TextField } from '../src/components/FormFields';
import { elegirOpcion } from './helpers/select';

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

  it('SelectField lleva la flecha chevron-down del sistema de diseño', () => {
    const { container } = render(
      <SelectField label="Especie">
        <option value="1">Buitre leonado</option>
      </SelectField>,
    );
    expect(screen.getByRole('combobox', { name: 'Especie' })).toBeInTheDocument();
    expect(container.querySelector('svg[data-icon="chevron-down"]')).not.toBeNull();
  });
});

const ESPECIES = (
  <>
    <option value="">Elige una especie</option>
    <option value="1">Buitre leonado</option>
    <option value="2" disabled>
      Buitre negro
    </option>
    <option value="3">Alimoche común</option>
  </>
);

function Formulario({ onSubmit }: { onSubmit: (datos: { especie: string }) => void }) {
  const { register, handleSubmit } = useForm<{ especie: string }>({ defaultValues: { especie: '3' } });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SelectField label="Especie" {...register('especie')}>
        {ESPECIES}
      </SelectField>
      <button type="submit">Guardar</button>
    </form>
  );
}

function Controlado() {
  const [valor, setValor] = useState('');
  return (
    <>
      <SelectField label="Especie" value={valor} onChange={(e) => setValor(e.target.value)}>
        {ESPECIES}
      </SelectField>
      <p data-testid="valor">{valor}</p>
    </>
  );
}

describe('SelectField usa el mismo desplegable que los filtros de Animales (DESIGN_SYSTEM §8.5)', () => {
  it('es un combobox con la lista propia (no la del navegador) y muestra la opción elegida', async () => {
    render(<Controlado />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    expect(campo.tagName).toBe('BUTTON');
    expect(campo).toHaveAttribute('aria-haspopup', 'listbox');
    expect(campo).toHaveTextContent('Elige una especie');
    await userEvent.click(campo);
    const lista = screen.getByRole('listbox', { name: 'Especie' });
    expect(lista).toHaveClass('dropdown-panel');
    expect(
      within(lista)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Elige una especie', 'Buitre leonado', 'Buitre negro', 'Alimoche común']);
    // El <select> que guarda el valor no se ve ni se puede enfocar.
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('controlado: al elegir avisa con el valor nuevo y lo muestra', async () => {
    render(<Controlado />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    await elegirOpcion(campo, 'Buitre leonado');
    expect(screen.getByTestId('valor')).toHaveTextContent('1');
    expect(campo).toHaveTextContent('Buitre leonado');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('con react-hook-form: empieza con el valor por defecto y envía el elegido', async () => {
    const enviados: { especie: string }[] = [];
    render(<Formulario onSubmit={(d) => enviados.push(d)} />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    expect(campo).toHaveTextContent('Alimoche común');
    await elegirOpcion(campo, 'Buitre leonado');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enviados).toEqual([{ especie: '1' }]));
  });

  it('se maneja con el teclado y salta las opciones desactivadas', async () => {
    render(<Controlado />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    campo.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // Abre en la elegida; ↓ va a «Buitre leonado» y otra ↓ salta «Buitre negro».
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByTestId('valor')).toHaveTextContent('3');
    expect(campo).toHaveFocus();
  });

  it('una opción desactivada no se puede elegir', async () => {
    render(<Controlado />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    await userEvent.click(campo);
    const negro = screen.getByRole('option', { name: 'Buitre negro' });
    expect(negro).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(negro);
    expect(screen.getByTestId('valor')).toBeEmptyDOMElement();
  });

  it('error y ayuda enlazados al campo, y el campo desactivado no se abre', async () => {
    const { rerender } = render(
      <SelectField label="Especie" help="La del animal." error="Elige una especie.">
        {ESPECIES}
      </SelectField>,
    );
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('La del animal. Elige una especie.');

    rerender(
      <SelectField label="Especie" disabled>
        {ESPECIES}
      </SelectField>,
    );
    expect(campo).toBeDisabled();
    await userEvent.click(campo);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
