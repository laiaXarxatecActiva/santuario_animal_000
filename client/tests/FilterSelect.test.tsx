import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FilterSelect } from '../src/components/FilterSelect';

const OPCIONES = [
  { value: '', label: 'Todas las especies' },
  { value: '1', label: 'Buitre leonado' },
  { value: '2', label: 'Buitre negro' },
];

function Ejemplo({ inicial = '' }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <FilterSelect label="Especie" value={valor} options={OPCIONES} onChange={setValor} />
      <p data-testid="valor">{valor}</p>
      <button type="button">Fuera</button>
    </>
  );
}

describe('desplegable de los filtros con el panel del selector de idioma (DESIGN_SYSTEM §8.5)', () => {
  it('es un combobox con el nombre de su etiqueta, que muestra la opción elegida', () => {
    render(<Ejemplo inicial="2" />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    expect(campo).toHaveTextContent('Buitre negro');
    expect(campo).toHaveAttribute('aria-haspopup', 'listbox');
    expect(campo).toHaveAttribute('aria-expanded', 'false');
  });

  it('el panel está oculto pero en la página, con la clase de la animación de los desplegables', () => {
    render(<Ejemplo />);
    expect(screen.queryByRole('listbox')).toBeNull();
    const panel = document.getElementById(screen.getByRole('combobox').getAttribute('aria-controls')!);
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveClass('dropdown-panel');
  });

  it('al pulsarlo abre la lista, con la opción elegida marcada y su icono check', async () => {
    render(<Ejemplo inicial="1" />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Especie' }));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    const lista = screen.getByRole('listbox', { name: 'Especie' });
    const opciones = within(lista).getAllByRole('option');
    expect(opciones.map((o) => o.textContent)).toEqual(['Todas las especies', 'Buitre leonado', 'Buitre negro']);
    expect(opciones.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(opciones[1]!.querySelector('svg[data-icon="check"]')).not.toBeNull();
    expect(opciones[0]!.querySelector('svg[data-icon="check"]')).toBeNull();
  });

  it('al elegir una opción cambia el valor, se cierra y el foco vuelve al botón', async () => {
    render(<Ejemplo />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    await userEvent.click(campo);
    await userEvent.click(screen.getByRole('option', { name: 'Buitre negro' }));
    expect(screen.getByTestId('valor')).toHaveTextContent('2');
    expect(campo).toHaveAttribute('aria-expanded', 'false');
    expect(campo).toHaveTextContent('Buitre negro');
    expect(campo).toHaveFocus();
  });

  it('se maneja con el teclado: flechas para moverse, Intro para elegir', async () => {
    render(<Ejemplo />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    campo.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(campo).toHaveAttribute('aria-expanded', 'true');
    // Empieza en la opción elegida («Todas las especies»).
    expect(campo.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Todas las especies' }).id,
    );
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(campo.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Buitre negro' }).id);
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(screen.getByTestId('valor')).toHaveTextContent('1');
    expect(campo).toHaveAttribute('aria-expanded', 'false');
  });

  it('Esc cierra sin cambiar el valor y deja el foco en el botón', async () => {
    render(<Ejemplo />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    await userEvent.click(campo);
    await userEvent.keyboard('{ArrowDown}{Escape}');
    expect(campo).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('valor')).toBeEmptyDOMElement();
    expect(campo).toHaveFocus();
  });

  it('se cierra al pulsar fuera', async () => {
    render(<Ejemplo />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Especie' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fuera' }));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });
});

const ESPECIES = [
  { value: '1', label: 'Buitre leonado' },
  { value: '2', label: 'Buitre negro' },
  { value: '3', label: 'Alimoche común' },
];

function EjemploVarias({ inicial = [] }: { inicial?: string[] }) {
  const [valores, setValores] = useState(inicial);
  return (
    <>
      <FilterSelect
        multiple
        label="Especie"
        allLabel="Todas las especies"
        summary={(n) => `${n} especies`}
        value={valores}
        options={ESPECIES}
        onChange={setValores}
      />
      <p data-testid="valores">{valores.join(',')}</p>
      <button type="button">Fuera</button>
    </>
  );
}

describe('desplegable de los filtros con varias opciones (CU-02)', () => {
  it('sin nada marcado muestra «Todas…»; con una, su nombre; con varias, el resumen', async () => {
    const { unmount } = render(<EjemploVarias />);
    expect(screen.getByRole('combobox', { name: 'Especie' })).toHaveTextContent('Todas las especies');
    unmount();
    const otra = render(<EjemploVarias inicial={['2']} />);
    expect(screen.getByRole('combobox', { name: 'Especie' })).toHaveTextContent('Buitre negro');
    otra.unmount();
    render(<EjemploVarias inicial={['1', '3']} />);
    expect(screen.getByRole('combobox', { name: 'Especie' })).toHaveTextContent('2 especies');
  });

  it('la lista admite varias, con «Todas…» primero y una casilla en cada opción', async () => {
    render(<EjemploVarias inicial={['1']} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Especie' }));
    const lista = screen.getByRole('listbox', { name: 'Especie' });
    expect(lista).toHaveAttribute('aria-multiselectable', 'true');
    const opciones = within(lista).getAllByRole('option');
    expect(opciones.map((o) => o.textContent)).toEqual([
      'Todas las especies',
      'Buitre leonado',
      'Buitre negro',
      'Alimoche común',
    ]);
    expect(opciones.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false']);
  });

  it('al pulsar opciones las marca y desmarca sin cerrar la lista', async () => {
    render(<EjemploVarias />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    await userEvent.click(campo);
    await userEvent.click(screen.getByRole('option', { name: 'Buitre negro' }));
    await userEvent.click(screen.getByRole('option', { name: 'Buitre leonado' }));
    expect(screen.getByTestId('valores')).toHaveTextContent('2,1');
    expect(campo).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('option', { name: 'Buitre negro' }));
    expect(screen.getByTestId('valores')).toHaveTextContent(/^1$/);
    expect(screen.getByRole('option', { name: 'Todas las especies' })).toHaveAttribute('aria-selected', 'false');
  });

  it('«Todas…» desmarca las demás', async () => {
    render(<EjemploVarias inicial={['1', '2']} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Especie' }));
    await userEvent.click(screen.getByRole('option', { name: 'Todas las especies' }));
    expect(screen.getByTestId('valores')).toBeEmptyDOMElement();
    expect(screen.getByRole('option', { name: 'Todas las especies' })).toHaveAttribute('aria-selected', 'true');
  });

  it('con el teclado, Intro marca la opción activa y Esc cierra', async () => {
    render(<EjemploVarias />);
    const campo = screen.getByRole('combobox', { name: 'Especie' });
    campo.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByTestId('valores')).toHaveTextContent('2');
    expect(campo).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(campo).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('valores')).toHaveTextContent('2');
  });
});
