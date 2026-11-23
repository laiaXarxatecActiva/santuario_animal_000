import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';
import { cualificaciones, zonas } from './helpers/work-fixtures';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

function api(extra: Record<string, Handler> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: admin() } },
    '/api/admin/zones': { body: { data: zonas } },
    '/api/admin/qualifications': { body: { data: cualificaciones } },
    ...extra,
  });
}

const fila = async (nombre: string) => (await screen.findByRole('cell', { name: nombre })).closest('tr') as HTMLElement;

describe('CU-52 Gestionar zonas', () => {
  it('2: lista las zonas con sus animales y las desactivadas marcadas', async () => {
    api();
    renderRoute('/admin/zones');
    expect(await screen.findByRole('heading', { level: 1, name: 'Zonas y cualificaciones' })).toBeInTheDocument();
    expect(within(await fila('Gran voladero')).getByText('7')).toBeInTheDocument();
    expect(within(await fila('Voladero viejo')).getByText('Desactivada')).toBeInTheDocument();
  });

  it('3: crea una zona', async () => {
    const { enviados } = api({
      '/api/admin/zones': (_u, p) =>
        p.method === 'POST'
          ? { status: 201, body: { id: 7, name: 'Cuarentena', description: null, isActive: true, animalCount: 0 } }
          : { body: { data: zonas } },
    });
    renderRoute('/admin/zones');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva zona' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva zona' });
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Cuarentena');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Zona guardada')).toBeInTheDocument();
    expect(enviados('/api/admin/zones').filter(Boolean)).toEqual([
      { name: 'Cuarentena', description: '', isActive: true },
    ]);
  });

  it('A1: una zona en uso no se borra: se explica que se puede desactivar', async () => {
    api({
      '/api/admin/zones/1': () =>
        errorApi(409, 'ZONE_IN_USE', 'Esta zona tiene animales, tareas o turnos: desactívala en lugar de borrarla.'),
    });
    renderRoute('/admin/zones');
    await userEvent.click(within(await fila('Gran voladero')).getByRole('button', { name: 'Borrar Gran voladero' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Borrar' }));
    expect(
      await screen.findByText('Esta zona tiene animales, tareas o turnos: desactívala en lugar de borrarla.'),
    ).toBeInTheDocument();
  });

  it('solo para administradores', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } } });
    renderRoute('/admin/zones');
    expect(await screen.findByText('No tienes acceso a esta página')).toBeInTheDocument();
  });
});

describe('CU-53 Gestionar cualificaciones', () => {
  it('2: lista las cualificaciones con cuántos trabajadores la tienen', async () => {
    api();
    renderRoute('/admin/zones');
    expect(within(await fila('Administrar medicación')).getByText('2')).toBeInTheDocument();
  });

  it('3: crea una cualificación', async () => {
    const { enviados } = api({
      '/api/admin/qualifications': (_u, p) =>
        p.method === 'POST'
          ? { status: 201, body: { id: 5, name: 'Carretilla', description: null, workerCount: 0 } }
          : { body: { data: cualificaciones } },
    });
    renderRoute('/admin/zones');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva cualificación' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva cualificación' });
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Carretilla');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Cualificación guardada')).toBeInTheDocument();
    await waitFor(() =>
      expect(enviados('/api/admin/qualifications').filter(Boolean)).toEqual([{ name: 'Carretilla', description: '' }]),
    );
  });
});
