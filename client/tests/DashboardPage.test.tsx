import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker, dashboard } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

const escritorio = (body = dashboard()) =>
  mockApi({ '/api/auth/me': { body: { user: caretaker() } }, '/api/admin/dashboard': { body } });

describe('CU-27 Consultar el escritorio del panel', () => {
  it('2: saluda y resume animales, adopciones activas y pendientes de pago', async () => {
    escritorio();
    renderRoute('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Nuria' })).toBeInTheDocument();
    const resumen = await screen.findByRole('list', { name: 'Resumen' });
    const tarjetas = within(resumen)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(tarjetas).toEqual(['15animales3 en tratamiento', '11adopciones activas', '2pendientes de pago']);
  });

  it('2: alertas de actualización en rojo y amarillo con enlace a publicar', async () => {
    escritorio();
    renderRoute('/admin');
    const turia = await screen.findByText('Turia lleva 16 días sin actualización (1 adoptante)');
    expect(turia.closest('[role="alert"]')).not.toBeNull();
    const ebano = screen.getByText('A Ébano le quedan 2 días para cumplir 14 sin actualización (1 adoptante)');
    expect(ebano.closest('[role="status"]')).not.toBeNull();
    const enlaces = screen.getAllByRole('link', { name: 'Publicar actualización' });
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
      '/admin/updates/new?animalId=3',
      '/admin/updates/new?animalId=9',
    ]);
    // Estas alertas no se pueden cerrar: desaparecen al publicar.
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument();
  });

  it('el plural de los adoptantes y del día que queda', async () => {
    escritorio(
      dashboard({
        updateAlerts: [{ animal: { id: 1, name: 'Rufo' }, daysWithoutUpdate: 13, level: 'warning', activeAdopters: 2 }],
      }),
    );
    renderRoute('/admin');
    expect(
      await screen.findByText('A Rufo le queda 1 día para cumplir 14 sin actualización (2 adoptantes)'),
    ).toBeInTheDocument();
  });

  it('2a: sin alertas, todos al día', async () => {
    escritorio(dashboard({ updateAlerts: [] }));
    renderRoute('/admin');
    expect(await screen.findByText('Todos los animales con adoptantes están al día')).toBeInTheDocument();
  });

  it('error al cargar: aviso con «Reintentar»', async () => {
    let fallos = 1;
    mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/dashboard': () =>
        fallos-- > 0 ? errorApi(500, 'INTERNAL_ERROR', 'Error') : { body: dashboard({ updateAlerts: [] }) },
    });
    renderRoute('/admin');
    expect(await screen.findByText('No hemos podido cargar el escritorio')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Todos los animales con adoptantes están al día')).toBeInTheDocument();
  });
});
