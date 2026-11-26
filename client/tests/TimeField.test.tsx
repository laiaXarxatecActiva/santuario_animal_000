import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TimeField, TimesField } from '../src/components/TimeField';
import { anadirHora, elegirHora, opcionesDe } from './helpers/select';

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

describe('TimeField: la hora se elige, no se escribe (DESIGN_SYSTEM §8.5)', () => {
  it('dos desplegables, horas de 00 a 23 y minutos de 5 en 5', async () => {
    render(<UnaHora />);
    const grupo = screen.getByRole('group', { name: 'Hora' });
    expect(opcionesDe(within(grupo).getByLabelText('Horas'))).toHaveLength(25);
    expect(opcionesDe(within(grupo).getByLabelText('Minutos'))).toEqual([
      '--',
      ...['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'],
    ]);
    expect(screen.getByText('Elige la hora.')).toBeInTheDocument();
    await elegirHora(grupo, '09:30');
    expect(screen.getByRole('status')).toHaveTextContent('09:30');
  });

  it('elegida solo la hora, los minutos pasan a 00', async () => {
    render(<UnaHora />);
    await userEvent.click(within(screen.getByRole('group', { name: 'Hora' })).getByLabelText('Horas'));
    await userEvent.click(screen.getByRole('option', { name: '17' }));
    expect(screen.getByRole('status')).toHaveTextContent('17:00');
  });

  it('una hora guardada que no es de 5 en 5 no se pierde', () => {
    render(<UnaHora inicial="08:07" />);
    const minutos = within(screen.getByRole('group', { name: 'Hora' })).getByLabelText('Minutos');
    expect(opcionesDe(minutos)).toContain('07');
    expect(minutos).toHaveTextContent('07');
  });
});

describe('TimesField: varias horas', () => {
  it('añade horas en orden, sin repetirlas, y las quita', async () => {
    render(<VariasHoras inicial={['17:00']} />);
    const grupo = screen.getByRole('group', { name: 'Horas de la tarea' });
    await anadirHora(grupo, '09:00');
    await anadirHora(grupo, '17:00');
    expect(screen.getByRole('status')).toHaveTextContent('09:00 17:00');
    await userEvent.click(within(grupo).getByRole('button', { name: 'Quitar 17:00' }));
    expect(screen.getByRole('status')).toHaveTextContent('09:00');
  });
});
