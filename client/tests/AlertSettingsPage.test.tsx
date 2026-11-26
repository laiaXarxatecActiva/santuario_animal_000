import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { elegirHora } from './helpers/select';
import { admin, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const AJUSTES = {
  emailAlertTypes: ['coverage_gap', 'low_intake', 'medication_missed', 'incident_reported'],
  dailySummaryEnabled: false,
  dailySummaryTime: '20:00',
};

describe('CU-73 y CU-74 Avisos por email y resumen diario', () => {
  it('el administrador elige qué avisos van por email y activa el resumen', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/alert-settings': (_u, p) => ({ body: p.method === 'PUT' ? p.body : AJUSTES }),
    });
    renderRoute('/admin/alert-settings');
    expect(await screen.findByRole('heading', { level: 1, name: 'Avisos por email' })).toBeInTheDocument();
    const visita = await screen.findByRole('checkbox', { name: 'Visita veterinaria de hoy' });
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Incidencia grave' })).toBeChecked());
    expect(visita).not.toBeChecked();
    expect(screen.getByText(/La campana avisa siempre/)).toBeInTheDocument();

    await userEvent.click(visita);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Turno sin personal suficiente' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Enviar el resumen del día' }));
    // La hora se elige en dos desplegables: no se puede escribir mal.
    await elegirHora(screen.getByRole('group', { name: 'Hora del resumen' }), '19:30');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ajustes guardados')).toBeInTheDocument();
    expect(enviados('/api/admin/alert-settings').filter(Boolean)).toEqual([
      {
        emailAlertTypes: ['low_intake', 'medication_missed', 'vet_visit_today', 'incident_reported'],
        dailySummaryEnabled: true,
        dailySummaryTime: '19:30',
      },
    ]);
  });

  it('solo para administradores', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } } });
    renderRoute('/admin/alert-settings');
    expect(await screen.findByText('No tienes acceso a esta página')).toBeInTheDocument();
  });
});
