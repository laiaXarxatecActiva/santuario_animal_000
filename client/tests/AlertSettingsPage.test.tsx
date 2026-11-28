import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { elegirHora, elegirOpcion, opcionesDe } from './helpers/select';
import { admin, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const AJUSTES = {
  emailAlertTypes: ['coverage_gap', 'low_intake', 'medication_missed', 'incident_reported'],
  dailySummaryEnabled: false,
  dailySummaryTime: '20:00',
  lowIntakeMeals: 2,
};

describe('CU-73, CU-74 y CU-67 Avisos', () => {
  it('el administrador elige qué avisos van por email y activa el resumen', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/alert-settings': (_u, p) => ({ body: p.method === 'PUT' ? p.body : AJUSTES }),
    });
    renderRoute('/admin/alert-settings');
    expect(await screen.findByRole('heading', { level: 1, name: 'Avisos' })).toBeInTheDocument();
    const visita = await screen.findByRole('checkbox', { name: 'Visita veterinaria de hoy' });
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Incidencia grave' })).toBeChecked());
    expect(visita).not.toBeChecked();
    expect(screen.getByText(/La campana avisa siempre/)).toBeInTheDocument();

    await userEvent.click(visita);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Turno sin personal suficiente' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enviar el resumen del día' }));
    // La hora se elige en dos desplegables: no se puede escribir mal.
    await elegirHora(screen.getByLabelText('Hora del resumen'), '19:30');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ajustes guardados')).toBeInTheDocument();
    expect(enviados('/api/admin/alert-settings').filter(Boolean)).toEqual([
      {
        emailAlertTypes: ['low_intake', 'medication_missed', 'vet_visit_today', 'incident_reported'],
        dailySummaryEnabled: true,
        dailySummaryTime: '19:30',
        lowIntakeMeals: 2,
      },
    ]);
  });

  it('CU-67: «Avisar si un animal come poco en [2] comidas seguidas», con un desplegable del 1 al 10', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/alert-settings': (_u, p) => ({ body: p.method === 'PUT' ? p.body : AJUSTES }),
    });
    renderRoute('/admin/alert-settings');
    const apartado = (await screen.findByRole('group', { name: 'Animales que comen poco' })) as HTMLElement;
    expect(apartado).toHaveTextContent('Avisar si un animal come poco en');
    expect(apartado).toHaveTextContent('comidas seguidas');
    expect(apartado).toHaveTextContent('«Comer poco» es anotar «Menos de la mitad» o «Nada».');
    const comidas = screen.getByRole('combobox', { name: 'Comidas seguidas comiendo poco antes de avisar' });
    expect(comidas).toHaveTextContent('2');
    expect(comidas).toHaveAccessibleDescription(expect.stringContaining('«Comer poco» es anotar'));
    expect(opcionesDe(comidas)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

    await elegirOpcion(comidas, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ajustes guardados')).toBeInTheDocument();
    expect(enviados('/api/admin/alert-settings').filter(Boolean)).toEqual([
      expect.objectContaining({ lowIntakeMeals: 3 }),
    ]);
  });

  it('solo para administradores', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } } });
    renderRoute('/admin/alert-settings');
    expect(await screen.findByText('No tienes acceso a esta página')).toBeInTheDocument();
  });
});
