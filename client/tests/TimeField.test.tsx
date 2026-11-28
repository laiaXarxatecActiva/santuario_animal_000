import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TimeField, TimesField } from '../src/components/TimeField';
import { anadirHora, elegirHora } from './helpers/select';

function UnaHora({ inicial = '' }: { inicial?: string }) {
  const [hora, setHora] = useState(inicial);
  return (
    <>
      <TimeField label="Hora" value={hora} onChange={setHora} error={hora ? undefined : 'Elige la hora.'} />
      <output>{hora || 'vacía'}</output>
    </>
  );
}

function VariasHoras({ inicial = [] }: { inicial?: string[] }) {
  const [horas, setHoras] = useState(inicial);
  return (
    <>
      <TimesField label="Horas de la tarea" value={horas} onChange={setHoras} />
      <output>{horas.join(' ') || 'ninguna'}</output>
    </>
  );
}

describe('TimeField: el campo de hora del navegador (DESIGN_SYSTEM §8.5)', () => {
  it('es un <input type="time"> con su etiqueta: en móvil abre el selector del sistema', async () => {
    render(<UnaHora />);
    const campo = screen.getByLabelText('Hora');
    expect(campo).toHaveAttribute('type', 'time');
    expect(campo).toHaveAccessibleDescription('Elige la hora.');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    await elegirHora(campo, '09:30');
    expect(screen.getByRole('status')).toHaveTextContent('09:30');
  });

  it('admite cualquier minuto y muestra la hora guardada', async () => {
    render(<UnaHora inicial="08:07" />);
    const campo = screen.getByLabelText('Hora');
    expect(campo).toHaveValue('08:07');
    await elegirHora(campo, '17:42');
    expect(screen.getByRole('status')).toHaveTextContent('17:42');
  });

  it('vaciarlo deja sin hora', async () => {
    render(<UnaHora inicial="08:00" />);
    await userEvent.clear(screen.getByLabelText('Hora'));
    expect(screen.getByRole('status')).toHaveTextContent('vacía');
  });
});

describe('TimesField: varias horas', () => {
  it('añade horas en orden, sin repetirlas, y las quita', async () => {
    render(<VariasHoras inicial={['17:00']} />);
    const grupo = screen.getByRole('group', { name: 'Horas de la tarea' });
    expect(within(grupo).getByLabelText('Nueva hora')).toHaveAttribute('type', 'time');
    expect(within(grupo).getByRole('button', { name: 'Añadir hora' })).toBeDisabled();
    await anadirHora(grupo, '09:00');
    await anadirHora(grupo, '17:00');
    expect(screen.getByRole('status')).toHaveTextContent('09:00 17:00');
    // Tras añadir, el campo se vacía para la siguiente.
    expect(within(grupo).getByLabelText('Nueva hora')).toHaveValue('');
    await userEvent.click(within(grupo).getByRole('button', { name: 'Quitar 17:00' }));
    expect(screen.getByRole('status')).toHaveTextContent('09:00');
  });

  it('Intro en «Nueva hora» la añade sin enviar el formulario', async () => {
    let enviado = false;
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviado = true;
        }}
      >
        <VariasHoras />
      </form>,
    );
    const campo = within(screen.getByRole('group', { name: 'Horas de la tarea' })).getByLabelText('Nueva hora');
    await elegirHora(campo, '08:15');
    await userEvent.type(campo, '{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('08:15');
    expect(enviado).toBe(false);
  });
});
