import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { plans } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

describe('CU-04 Consultar cómo funciona la adopción simbólica', () => {
  it('explica que es simbólica y muestra los planes con los importes de la base de datos', async () => {
    mockApi({ '/api/plans': { body: { data: plans } } });
    renderRoute('/how-it-works');
    expect(screen.getByRole('heading', { level: 1, name: 'Cómo funciona la adopción simbólica' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('El animal sigue viviendo en el santuario');
    const usual = (await screen.findByRole('heading', { name: 'Usual' })).closest('li')!;
    expect(within(usual).getByText(/^5,00\s€ al mes$/)).toBeInTheDocument();
    expect(within(usual).getByText('La más habitual')).toBeInTheDocument();
    expect(screen.getAllByText('La más habitual')).toHaveLength(1);
  });

  it('responde a las preguntas frecuentes y enlaza al catálogo', () => {
    mockApi({ '/api/plans': { body: { data: plans } } });
    renderRoute('/how-it-works');
    expect(screen.getByText('¿Un animal puede tener varios adoptantes?')).toBeInTheDocument();
    expect(screen.getByText('¿Puedo cambiar de plan?')).toBeInTheDocument();
    expect(screen.getByText('¿Cómo me doy de baja?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver animales' })).toHaveAttribute('href', '/animals');
  });

  it('si no se pueden cargar los planes, el resto de la página sigue visible', async () => {
    mockApi({ '/api/plans': { status: 500, body: {} } });
    renderRoute('/how-it-works');
    expect(await screen.findByRole('alert')).toHaveTextContent('No hemos podido cargar los planes');
    expect(screen.getByText('¿Puedo cambiar de plan?')).toBeInTheDocument();
  });
});
