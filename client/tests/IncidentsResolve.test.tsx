import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker, page } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';
import { incidencia, zonas } from './helpers/work-fixtures';
import { elegirOpcion, opcionesDe } from './helpers/select';

const ABIERTA = incidencia({ id: 1, severity: 'medium', status: 'open', description: 'La malla tiene un agujero.' });
const EN_CURSO = incidencia({ id: 2, status: 'in_progress' });
const RESUELTA = incidencia({
  id: 3,
  severity: 'low',
  status: 'resolved',
  description: 'El termómetro no marca bien.',
  resolution: 'Termómetro cambiado por uno nuevo.',
  resolvedBy: { id: 1, name: 'Marta Soler Ferrer' },
  resolvedAt: '2026-11-21T10:00:00.000Z',
});

function api() {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/incidents': (u: URL) => ({
      body: page(u.searchParams.get('status') === 'resolved' ? [RESUELTA] : [EN_CURSO, ABIERTA]),
    }),
    '/api/admin/incidents/summary': { body: { open: 1, inProgress: 1 } },
    '/api/admin/zones': { body: { data: zonas } },
    '/api/admin/incidents/1/status': (_u: URL, p: Peticion) => ({
      body: { ...ABIERTA, status: (p.body as { status: string }).status },
    }),
    '/api/admin/incidents/2/status': (_u: URL, p: Peticion) => ({
      body: { ...EN_CURSO, status: 'resolved', resolution: (p.body as { note: string }).note },
    }),
    '/api/admin/incidents/3/status': () => ({ body: { ...RESUELTA, status: 'open', resolution: null } }),
  });
}

const fila = async (texto: string | RegExp) => within((await screen.findByText(texto)).closest('tr')!);

describe('CU-70 Revisar y resolver incidencias desde el listado', () => {
  it('el cuidador resuelve una pendiente explicando cómo', async () => {
    const { enviados } = api();
    renderRoute('/admin/incidents');
    await userEvent.click((await fila(/Pipa cojea/)).getByRole('button', { name: 'Resolver' }));
    const ventana = screen.getByRole('dialog', { name: 'Resolver la incidencia' });
    expect(within(ventana).getByText('Cojera de Pipa')).toBeInTheDocument();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Marcar como resuelta' }));
    expect(await within(ventana).findByText('Explica cómo se ha resuelto.')).toBeInTheDocument();
    await userEvent.type(within(ventana).getByLabelText('¿Cómo se ha resuelto?'), 'La ha visto la veterinaria.');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Marcar como resuelta' }));
    expect(await screen.findByText('Incidencia resuelta')).toBeInTheDocument();
    expect(enviados('/api/admin/incidents/2/status').filter(Boolean)).toEqual([
      { status: 'resolved', note: 'La ha visto la veterinaria.' },
    ]);
  });

  it('no hay «Empezar»: una pendiente solo se resuelve', async () => {
    api();
    renderRoute('/admin/incidents');
    const abierta = await fila('La malla tiene un agujero.');
    expect(abierta.queryByRole('button', { name: 'Empezar' })).not.toBeInTheDocument();
    expect(abierta.getByRole('button', { name: 'Resolver' })).toBeInTheDocument();
    expect(abierta.getByRole('link', { name: 'Ver' })).toHaveAttribute('href', '/admin/incidents/1');
  });

  it('en «Resueltas» se ve cómo y quién la resolvió, y se puede reabrir', async () => {
    const { enviados } = api();
    renderRoute('/admin/incidents');
    await elegirOpcion(await screen.findByLabelText('Estado'), 'Resueltas');
    const resuelta = await fila('El termómetro no marca bien.');
    expect(resuelta.getByText('Termómetro cambiado por uno nuevo.')).toBeInTheDocument();
    expect(resuelta.getByText(/Marta Soler Ferrer/)).toBeInTheDocument();
    expect(resuelta.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument();
    await userEvent.click(resuelta.getByRole('button', { name: 'Reabrir' }));
    expect(await screen.findByText('Incidencia reabierta')).toBeInTheDocument();
    expect(enviados('/api/admin/incidents/3/status').filter(Boolean)).toEqual([{ status: 'open' }]);
  });

  it('el filtro y el menú dicen cuántas quedan pendientes', async () => {
    api();
    renderRoute('/admin/incidents');
    const estado = await screen.findByLabelText('Estado');
    await waitFor(() => expect(opcionesDe(estado)).toContain('Pendientes (2)'));
    const menu = within(screen.getByRole('navigation', { name: 'Menú del panel' }));
    const enlace = menu.getByRole('link', { name: 'Incidencias' });
    expect(enlace).toHaveAccessibleDescription('2 pendientes');
    expect(within(enlace).getByText('2')).toBeInTheDocument();
  });
});
