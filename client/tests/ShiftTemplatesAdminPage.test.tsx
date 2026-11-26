import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { elegirHora } from './helpers/select';
import { admin } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';
import { turnoMantenimiento, turnoManana, turnoTarde, zonas } from './helpers/work-fixtures';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

function api(extra: Record<string, Handler> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: admin() } },
    '/api/admin/shift-templates': (_u, p) =>
      p.method === 'POST'
        ? { status: 201, body: { ...turnoMantenimiento, id: 9, name: 'Noche' } }
        : { body: { data: [turnoManana, turnoMantenimiento, turnoTarde] } },
    '/api/admin/zones': () => ({ body: { data: zonas } }),
    ...extra,
  });
}

const fila = async (nombre: string) => (await screen.findByText(nombre)).closest('tr')!;

describe('CU-60 Plantillas de turno', () => {
  it('lista los turnos con su horario, sus días y lo que necesita cada zona', async () => {
    api();
    renderRoute('/admin/shift-templates');
    expect(await screen.findByRole('heading', { level: 1, name: 'Plantillas de turno' })).toBeInTheDocument();
    const manana = within(await fila('Mañana'));
    expect(manana.getByText('07:00–15:00')).toBeInTheDocument();
    expect(manana.getByText('Todos los días')).toBeInTheDocument();
    expect(manana.getByText('Clínica y recuperación (1), Cocina y almacén (1), Gran voladero (1)')).toBeInTheDocument();
    const mantenimiento = within(await fila('Mantenimiento'));
    expect(mantenimiento.getByText('Lun, Mar, Mié, Jue, Vie')).toBeInTheDocument();
    expect(mantenimiento.getByText('Sin mínimos')).toBeInTheDocument();
  });

  it('crea un turno con sus días y las personas que necesita cada zona', async () => {
    const { enviados } = api();
    renderRoute('/admin/shift-templates');
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo turno' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo turno' });
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Noche');
    await elegirHora(within(dialogo).getByRole('group', { name: 'Hora de inicio' }), '22:00');
    await elegirHora(within(dialogo).getByRole('group', { name: 'Hora de fin' }), '23:30');
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Viernes' }));
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Sábado' }));
    await userEvent.type(within(dialogo).getByLabelText('Personas en Clínica y recuperación'), '1');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(enviados('/api/admin/shift-templates').filter(Boolean)).toEqual([
        {
          name: 'Noche',
          startTime: '22:00',
          endTime: '23:30',
          weekdays: [5, 6],
          requirements: [{ zoneId: 4, minWorkers: 1 }],
          isActive: true,
        },
      ]),
    );
    expect(await screen.findByText('Turno guardado')).toBeInTheDocument();
  }, 20_000);

  it('comprueba el formulario antes de enviarlo', async () => {
    const { enviados } = api();
    renderRoute('/admin/shift-templates');
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo turno' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo turno' });
    await elegirHora(within(dialogo).getByRole('group', { name: 'Hora de inicio' }), '15:00');
    await elegirHora(within(dialogo).getByRole('group', { name: 'Hora de fin' }), '09:00');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialogo).findByText('Escribe el nombre del turno.')).toBeInTheDocument();
    expect(within(dialogo).getByText('La hora de fin debe ser posterior a la de inicio.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Elige al menos un día de la semana.')).toBeInTheDocument();
    expect(enviados('/api/admin/shift-templates')).toEqual([undefined]);
  });

  it('A1: un turno con personas asignadas no se borra', async () => {
    api({
      '/api/admin/shift-templates/1': () =>
        errorApi(
          409,
          'SHIFT_TEMPLATE_IN_USE',
          'Este turno tiene personas asignadas: desactívalo en lugar de borrarlo.',
        ),
    });
    renderRoute('/admin/shift-templates');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar Mañana' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Borrar' }));
    expect(
      await screen.findByText('Este turno tiene personas asignadas: desactívalo en lugar de borrarlo.'),
    ).toBeInTheDocument();
  });
});
