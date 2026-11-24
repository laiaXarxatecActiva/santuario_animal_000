import type { TodayDto } from '@sanctuary/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';
import { asignacion, incidencia, tarea } from './helpers/work-fixtures';

const HOY: TodayDto = {
  date: '2026-11-23',
  tasks: { total: 12, completed: 7, notDone: 1, pending: 4, late: 1 },
  lateTasks: [tarea({ id: 30, title: 'Limpieza de la clínica', dueTime: '12:00', late: true })],
  notDoneTasks: [tarea({ id: 31, title: 'Limpieza de la cocina', status: 'not_done' })],
  missedDoses: [
    tarea({
      id: 40,
      title: 'Doxiciclina · 100 mg',
      type: 'medication',
      dueTime: '10:00',
      animals: [{ id: 10, name: 'Carbón' }],
      medicationPlanId: 1,
    }),
  ],
  incidents: { open: 1, inProgress: 1, latest: [incidencia()] },
  gaps: [
    {
      date: '2026-11-23',
      shift: { id: 2, name: 'Tarde', startTime: '15:00', endTime: '22:00' },
      zone: { id: 1, name: 'Gran voladero' },
      required: 2,
      assigned: 1,
    },
  ],
  shifts: [
    { assignment: asignacion(), missingCheckIn: true },
    {
      assignment: asignacion({
        id: 502,
        user: { id: 4, name: 'Andrés Climent Mas' },
        checkedInAt: '2026-11-23T05:58:00.000Z',
      }),
      missingCheckIn: false,
    },
  ],
  lowIntake: [{ animal: { id: 10, name: 'Carbón' }, streak: 2 }],
  vetVisits: [
    {
      id: 1,
      animalId: 14,
      animal: { id: 14, name: 'Pipa' },
      date: '2026-11-23',
      time: '11:00',
      reason: 'Revisión de la cuarentena.',
      veterinarian: 'Dr. Víctor Albiol',
      status: 'scheduled',
      vetRecordId: null,
      taskId: 50,
    },
  ],
};

const region = async (nombre: string) => within(await screen.findByRole('region', { name: nombre }));

describe('CU-72 Panel «Hoy»', () => {
  it('reúne lo del día con enlaces a cada pantalla', async () => {
    mockApi({ '/api/auth/me': { body: { user: admin() } }, '/api/admin/today': { body: HOY } });
    renderRoute('/admin/today');
    expect(await screen.findByRole('heading', { level: 1, name: 'Hoy en el santuario' })).toBeInTheDocument();
    expect(
      (await region('Tareas de hoy')).getByText('7 hechas, 1 no realizadas y 4 pendientes de 12'),
    ).toBeInTheDocument();
    expect((await region('Tareas de hoy')).getByRole('link', { name: 'Ver las tareas del día' })).toHaveAttribute(
      'href',
      '/admin/tasks',
    );
    expect((await region('Atrasadas')).getByText('Limpieza de la clínica')).toBeInTheDocument();
    expect((await region('No realizadas')).getByText('Limpieza de la cocina')).toBeInTheDocument();
    const dosis = await region('Medicación no dada');
    expect(dosis.getByText(/Doxiciclina · 100 mg/)).toBeInTheDocument();
    expect(dosis.getByRole('link', { name: 'Carbón' })).toHaveAttribute('href', '/admin/animals/10/care');
    const incidencias = await region('Incidencias');
    expect(incidencias.getByText('Abiertas: 1 · En curso: 1')).toBeInTheDocument();
    expect(incidencias.getByRole('link', { name: 'Cojera de Pipa' })).toHaveAttribute('href', '/admin/incidents/2');
    const turnos = await region('Turnos de hoy');
    expect(within(turnos.getByText('Nuria Peris Gil').closest('li')!).getByText('Sin fichar')).toBeInTheDocument();
    expect(within(turnos.getByText('Andrés Climent Mas').closest('li')!).queryByText('Sin fichar')).toBeNull();
    expect((await region('Zonas sin cubrir')).getByText(/Gran voladero · Tarde: 1 de 2/)).toBeInTheDocument();
    expect((await region('Animales que comen poco')).getByText(/2 tomas/)).toBeInTheDocument();
    expect((await region('Visitas veterinarias de hoy')).getByText(/11:00 · Pipa/)).toBeInTheDocument();
  });

  it('sin nada pendiente, lo dice en cada bloque', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/today': {
        body: {
          ...HOY,
          lateTasks: [],
          notDoneTasks: [],
          missedDoses: [],
          incidents: { open: 0, inProgress: 0, latest: [] },
          gaps: [],
          lowIntake: [],
          vetVisits: [],
        },
      },
    });
    renderRoute('/admin/today');
    expect((await region('Medicación no dada')).getByText('Ninguna.')).toBeInTheDocument();
    expect((await region('Zonas sin cubrir')).getByText('Ninguna.')).toBeInTheDocument();
  });

  it('solo el administrador, y el escritorio enlaza a «Hoy»', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } } });
    renderRoute('/admin/today');
    expect(await screen.findByText('No tienes acceso a esta página')).toBeInTheDocument();
  });

  it('el menú del administrador lleva a «Hoy», «Incidencias» y «Avisos»', async () => {
    mockApi({ '/api/auth/me': { body: { user: admin() } }, '/api/admin/today': { body: HOY } });
    renderRoute('/admin/today');
    const menu = await screen.findByRole('navigation', { name: 'Menú del panel' });
    expect(within(menu).getByRole('link', { name: 'Hoy' })).toHaveAttribute('href', '/admin/today');
    expect(within(menu).getByRole('link', { name: 'Incidencias' })).toHaveAttribute('href', '/admin/incidents');
    expect(within(menu).getByRole('link', { name: 'Avisos por email' })).toHaveAttribute(
      'href',
      '/admin/alert-settings',
    );
    await userEvent.click(within(menu).getByRole('link', { name: 'Incidencias' }));
  });
});
