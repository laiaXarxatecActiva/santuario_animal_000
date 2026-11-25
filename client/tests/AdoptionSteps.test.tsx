import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdoptionSteps } from '../src/components/AdoptionSteps';

describe('CU-01 / CU-04 Los tres pasos de la adopción simbólica', () => {
  it('muestra los tres pasos en una lista ordenada', () => {
    render(<AdoptionSteps />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: /Elige un animal/ })).toBeInTheDocument();
  });

  it('pone una flecha larga a la derecha entre el 1 y el 2 y entre el 2 y el 3, oculta a los lectores de pantalla', () => {
    render(<AdoptionSteps />);
    const pasos = screen.getAllByRole('listitem');
    const flechas = pasos.map((paso) => paso.querySelectorAll('svg[data-icon="right-long"]'));
    expect(flechas.map((f) => f.length)).toEqual([0, 1, 1]);
    for (const [flecha] of flechas.slice(1)) {
      expect(flecha!.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('con detailed explica cada paso', () => {
    render(<AdoptionSteps detailed />);
    expect(screen.getByText('Mira el catálogo y elige al buitre que quieras acompañar.')).toBeInTheDocument();
  });
});
