import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker, page } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';
import { asignacion, notaDeRelevo, zonas } from './helpers/work-fixtures';
import { opcionesDe } from './helpers/select';

function api(extra: Record<string, (u: URL, p: Peticion) => { status?: number; body?: unknown }> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/my-day': () => ({ body: { date: '2026-11-23', tasks: [], shifts: [asignacion()] } }),
    '/api/admin/handover-notes': (_u, p) =>
      p.method === 'POST'
        ? {
            status: 201,
            body: notaDeRelevo({
              id: 9,
              author: { id: 3, name: 'Nuria Peris Gil' },
              body: (p.body as { body: string }).body,
              mine: true,
              isRead: true,
            }),
          }
        : {
            body: {
              data: [
                notaDeRelevo(),
                notaDeRelevo({
                  id: 3,
                  zone: { id: 3, name: 'Voladero de alimoches' },
                  body: 'Lupe se lo ha comido todo.',
                  isRead: true,
                }),
              ],
            },
          },
    '/api/admin/zones': { body: { data: zonas } },
    '/api/admin/animals': { body: page([]) },
    ...extra,
  });
}

const relevo = async () => within(await screen.findByRole('region', { name: 'Notas de relevo' }));

describe('CU-71 Notas de relevo en «Mi día»', () => {
  it('muestra las notas de mis zonas y marca como leída la que no lo está', async () => {
    const { fetchMock } = api({
      '/api/admin/handover-notes/1/read': () => ({ body: notaDeRelevo({ isRead: true }) }),
    });
    renderRoute('/admin/my-day');
    const notas = await relevo();
    const nota = (await notas.findByText(/dejad la luz baja/)).closest('article')!;
    expect(within(nota).getByText(/Carmen Boix Vidal · Clínica y recuperación/)).toBeInTheDocument();
    expect(within(nota).getByText('Nueva')).toBeInTheDocument();
    await userEvent.click(within(nota).getByRole('button', { name: 'Marcar como leída' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/handover-notes/1/read',
      expect.objectContaining({ method: 'PUT' }),
    );
    const leida = notas.getByText('Lupe se lo ha comido todo.').closest('article')!;
    expect(within(leida).queryByRole('button', { name: 'Marcar como leída' })).toBeNull();
  });

  it('deja una nota en una zona de su turno', async () => {
    const { enviados } = api();
    renderRoute('/admin/my-day');
    await userEvent.click(await (await relevo()).findByRole('button', { name: 'Dejar una nota' }));
    const ventana = screen.getByRole('dialog', { name: 'Dejar una nota de relevo' });
    const zona = within(ventana).getByLabelText('Zona');
    // Solo las zonas de su turno de hoy.
    expect(opcionesDe(zona)).toEqual(['Clínica y recuperación', 'Voladero de alimoches']);
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await within(ventana).findByText('Escribe la nota.')).toBeInTheDocument();
    await userEvent.type(within(ventana).getByLabelText('Nota'), 'Pipa no ha querido comer.');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Nota guardada')).toBeInTheDocument();
    expect(enviados('/api/admin/handover-notes').filter(Boolean)).toEqual([
      { zoneId: 4, body: 'Pipa no ha querido comer.' },
    ]);
  });

  it('sin turno hoy no puede dejar notas', async () => {
    api({ '/api/admin/my-day': () => ({ body: { date: '2026-11-23', tasks: [], shifts: [] } }) });
    renderRoute('/admin/my-day');
    expect((await relevo()).queryByRole('button', { name: 'Dejar una nota' })).toBeNull();
  });
});

describe('CU-70 «Comunicar incidencia» solo está en «Incidencias»', () => {
  it('«Mi día» no tiene el botón', async () => {
    api();
    renderRoute('/admin/my-day');
    await relevo();
    expect(screen.queryByRole('button', { name: 'Comunicar incidencia' })).not.toBeInTheDocument();
  });
});
