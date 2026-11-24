import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { admin, adminUsers, caretaker, page } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';
import { asignacion, ausencia, calendarioSemana, zonas } from './helpers/work-fixtures';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

function api(usuario = caretaker(), extra: Record<string, Handler> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: usuario } },
    '/api/admin/shifts': (u) => {
      const desde = u.searchParams.get('from');
      // Al cuidador no le llega el motivo de las ausencias de los demás.
      const ausencias = [usuario.role === 'admin' ? ausencia() : ausencia({ type: null })];
      return {
        body: desde
          ? calendarioSemana({ from: desde, to: '2026-12-06', assignments: [], absences: [], gaps: [] })
          : calendarioSemana({ absences: ausencias }),
      };
    },
    '/api/admin/zones': () => ({ body: { data: zonas } }),
    '/api/admin/users': () => ({ body: page(adminUsers) }),
    ...extra,
  });
}

const dia = (nombre: RegExp) => screen.findByRole('region', { name: nombre });

describe('CU-61 Calendario de turnos', () => {
  it('el cuidador ve quién está en cada turno, los huecos y quién está ausente (sin el motivo)', async () => {
    api();
    renderRoute('/admin/shifts');
    expect(await screen.findByRole('heading', { level: 1, name: 'Turnos' })).toBeInTheDocument();
    expect(await screen.findByText('Hay 2 huecos sin cubrir esta semana.')).toBeInTheDocument();

    const lunes = await dia(/lunes, 23/);
    const manana = within(lunes).getByRole('article', { name: 'Mañana, 07:00–15:00' });
    expect(within(manana).getByText('Nuria Peris Gil')).toBeInTheDocument();
    expect(within(manana).getByText('Clínica y recuperación, Voladero de alimoches')).toBeInTheDocument();
    expect(within(manana).getByText('Ha fichado')).toBeInTheDocument();
    expect(within(manana).getByText('Andrés Climent Mas')).toBeInTheDocument();
    expect(within(lunes).getByRole('article', { name: 'Tarde, 14:00–22:00' })).toBeInTheDocument();

    const jueves = await dia(/jueves, 26/);
    const tarde = within(jueves).getByRole('article', { name: 'Tarde, 14:00–22:00' });
    expect(within(tarde).getByText('Falta personal en Clínica y recuperación: 0 de 1')).toBeInTheDocument();
    expect(within(jueves).getByText('Ausente: Carmen Boix Vidal')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Copiar la semana anterior' })).not.toBeInTheDocument();
    expect(within(lunes).queryByRole('button', { name: /Asignar/ })).not.toBeInTheDocument();
  });

  it('cambia de semana', async () => {
    const { pedidas } = api();
    renderRoute('/admin/shifts');
    await dia(/lunes, 23/);
    await userEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    await dia(/lunes, 30/);
    expect(
      pedidas('/api/admin/shifts').map((u) => [u.searchParams.get('from'), u.searchParams.get('to')]),
    ).toContainEqual(['2026-11-30', '2026-12-06']);
  });

  it('abre la semana indicada en el enlace del aviso', async () => {
    const { pedidas } = api();
    renderRoute('/admin/shifts?week=2026-11-30');
    await dia(/lunes, 30/);
    expect(pedidas('/api/admin/shifts')[0]!.searchParams.get('from')).toBe('2026-11-30');
  });

  it('el administrador ve el motivo de la ausencia', async () => {
    api(admin());
    renderRoute('/admin/shifts');
    expect(within(await dia(/jueves, 26/)).getByText('Ausente: Carmen Boix Vidal (Vacaciones)')).toBeInTheDocument();
  });
});

describe('CU-61 Asignar turnos (administrador)', () => {
  it('asigna a una persona con las zonas que necesita el turno, ya marcadas', async () => {
    const { enviados } = api(admin(), {
      '/api/admin/shift-assignments': () => ({ status: 201, body: asignacion({ id: 600 }) }),
    });
    renderRoute('/admin/shifts');
    const jueves = await dia(/jueves, 26/);
    await userEvent.click(within(jueves).getByRole('button', { name: 'Asignar a alguien al turno de Tarde' }));
    const dialogo = screen.getByRole('dialog', { name: 'Asignar al turno de Tarde' });
    await userEvent.selectOptions(within(dialogo).getByLabelText('Persona'), 'Nuria Peris Gil');
    expect(within(dialogo).getByRole('checkbox', { name: 'Clínica y recuperación' })).toBeChecked();
    expect(within(dialogo).getByRole('checkbox', { name: 'Gran voladero' })).toBeChecked();
    expect(within(dialogo).getByRole('checkbox', { name: 'Cocina y almacén' })).not.toBeChecked();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Asignar' }));
    await waitFor(() =>
      expect(enviados('/api/admin/shift-assignments')).toEqual([
        { shiftTemplateId: 2, date: '2026-11-26', userId: 3, zoneIds: [1, 4] },
      ]),
    );
    expect(await screen.findByText('Turno asignado')).toBeInTheDocument();
  });

  it('2a: muestra el error del servidor junto a la persona', async () => {
    api(admin(), {
      '/api/admin/shift-assignments': () =>
        errorApi(400, 'VALIDATION_ERROR', 'Datos no válidos.', [
          { field: 'userId', message: 'Esta persona está ausente ese día.' },
        ]),
    });
    renderRoute('/admin/shifts');
    const jueves = await dia(/jueves, 26/);
    await userEvent.click(within(jueves).getByRole('button', { name: 'Asignar a alguien al turno de Tarde' }));
    const dialogo = screen.getByRole('dialog', { name: 'Asignar al turno de Tarde' });
    await userEvent.selectOptions(within(dialogo).getByLabelText('Persona'), 'Nuria Peris Gil');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Asignar' }));
    expect(await within(dialogo).findByText('Esta persona está ausente ese día.')).toBeInTheDocument();
  });

  it('quita a una persona del turno', async () => {
    const { fetchMock } = api(admin(), { '/api/admin/shift-assignments/502': () => ({ status: 204 }) });
    renderRoute('/admin/shifts');
    const lunes = await dia(/lunes, 23/);
    await userEvent.click(
      within(lunes).getByRole('button', { name: 'Quitar a Andrés Climent Mas del turno de Mañana' }),
    );
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Quitar' }));
    expect(await screen.findByText('Se ha quitado del turno')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([u, init]) => String(u).endsWith('/api/admin/shift-assignments/502') && init?.method === 'DELETE',
      ),
    ).toBe(true);
  });

  it('copia la semana anterior y explica lo que no ha copiado', async () => {
    const { enviados } = api(admin(), {
      '/api/admin/shift-assignments/copy-week': () => ({
        body: {
          created: 12,
          skipped: [
            {
              date: '2026-11-24',
              user: { id: 3, name: 'Nuria Peris Gil' },
              shift: { id: 1, name: 'Mañana', startTime: '07:00', endTime: '15:00' },
              reason: 'ABSENT',
            },
          ],
        },
      }),
    });
    renderRoute('/admin/shifts');
    await dia(/lunes, 23/);
    await userEvent.click(screen.getByRole('button', { name: 'Copiar la semana anterior' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Copiar' }));
    expect(await screen.findByText('Se han copiado 12 turnos.')).toBeInTheDocument();
    expect(screen.getByText(/Nuria Peris Gil · Mañana · martes, 24 de noviembre: está ausente/)).toBeInTheDocument();
    expect(enviados('/api/admin/shift-assignments/copy-week')).toEqual([{ weekStart: '2026-11-23' }]);
  });
});

describe('Menú del trabajo diario: turnos', () => {
  it('el cuidador ve «Turnos», pero no las plantillas de turno ni las ausencias', async () => {
    api();
    renderRoute('/admin/shifts');
    const menu = within(await screen.findByRole('navigation', { name: 'Menú del panel' }));
    expect(menu.getByRole('link', { name: 'Turnos' })).toHaveAttribute('href', '/admin/shifts');
    expect(menu.queryByRole('link', { name: 'Plantillas de turno' })).not.toBeInTheDocument();
    expect(menu.queryByRole('link', { name: 'Ausencias' })).not.toBeInTheDocument();
  });

  it('el administrador ve también las plantillas de turno y las ausencias', async () => {
    api(admin());
    renderRoute('/admin/shifts');
    const menu = within(await screen.findByRole('navigation', { name: 'Menú del panel' }));
    expect(menu.getByRole('link', { name: 'Plantillas de turno' })).toHaveAttribute('href', '/admin/shift-templates');
    expect(menu.getByRole('link', { name: 'Ausencias' })).toHaveAttribute('href', '/admin/absences');
  });
});

describe('Calendario de turnos más claro', () => {
  afterEach(() => vi.useRealTimers());

  it('marca el día de hoy', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T10:00:00Z'));
    api();
    renderRoute('/admin/shifts');
    const miercoles = await dia(/miércoles, 25/);
    expect(within(miercoles).getByText('Hoy')).toBeInTheDocument();
    expect(within(await dia(/lunes, 23/)).queryByText('Hoy')).not.toBeInTheDocument();
  });
});
