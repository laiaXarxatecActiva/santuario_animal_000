import type { AdminAdoptionDetailDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminAdoptionDetail } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';

type Respuesta = { status?: number; body?: unknown };

/** GET devuelve `ficha`; PATCH, `tras` (o el error indicado). */
function api(ficha: AdminAdoptionDetailDto, tras: (body: unknown) => Respuesta = () => ({ body: ficha })) {
  return mockApi({
    '/api/auth/me': { body: { user: admin() } },
    [`/api/admin/adoptions/${ficha.id}`]: { body: ficha },
    [`/api/admin/adoptions/${ficha.id}/status`]: (_u: URL, p: Peticion) => tras(p.body),
  });
}
const enviadosA = (enviados: (ruta: string) => unknown[], id: number) =>
  enviados(`/api/admin/adoptions/${id}/status`).filter((b) => b !== undefined);

describe('CU-37 Gestionar adopciones: ficha', () => {
  it('3: muestra los datos, los pagos y las notas internas', async () => {
    api(adminAdoptionDetail());
    renderRoute('/admin/adoptions/4');
    expect(await screen.findByRole('heading', { level: 1, name: 'Rufo · Pablo García Esteve' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pablo García Esteve' })).toHaveAttribute('href', '/admin/users/7');
    expect(screen.getByText('Creada a mano por Marta Soler Ferrer')).toBeInTheDocument();
    const pagos = screen.getByRole('region', { name: 'Pagos' });
    expect(within(pagos).getByText('Efectivo')).toBeInTheDocument();
    expect(within(pagos).getByText('CASH-20260816-ABCDE12345')).toBeInTheDocument();
    expect(within(pagos).getByText('Cobrado')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notas internas' })).toHaveTextContent(
      'Alta en la jornada de puertas abiertas.',
    );
  });

  it('A1: pausar pide el motivo y lo envía', async () => {
    const { enviados } = api(adminAdoptionDetail(), () => ({ body: adminAdoptionDetail({ status: 'paused' }) }));
    renderRoute('/admin/adoptions/4');
    await userEvent.click(await screen.findByRole('button', { name: 'Pausar' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Pausar la adopción?' });
    expect(ventana).toHaveTextContent('Mientras esté pausada no se le cobrará.');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Pausar' }));
    expect(await within(ventana).findByText('Escribe el motivo.')).toBeInTheDocument();
    expect(enviadosA(enviados, 4)).toEqual([]);

    await userEvent.type(within(ventana).getByLabelText('Motivo (nota interna)'), 'Lo pidió por teléfono.');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Pausar' }));
    expect(await screen.findByText('Adopción pausada')).toBeInTheDocument();
    expect(enviadosA(enviados, 4)).toEqual([{ action: 'pause', notes: 'Lo pidió por teléfono.' }]);
  });

  it('A2: reanuda una pausada sin pedir motivo', async () => {
    const pausada = adminAdoptionDetail({ status: 'paused' });
    const { enviados } = api(pausada, () => ({ body: adminAdoptionDetail() }));
    renderRoute('/admin/adoptions/4');
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Reanudar' }));
    expect(await screen.findByText('Adopción reanudada')).toBeInTheDocument();
    expect(enviadosA(enviados, 4)).toEqual([{ action: 'resume' }]);
  });

  it('A3: cancelar avisa de que termina hoy y muestra el error del servidor', async () => {
    const { enviados } = api(adminAdoptionDetail(), () => errorApi(422, 'ADOPTION_ACTION_NOT_ALLOWED', 'x'));
    renderRoute('/admin/adoptions/4');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar adopción' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Cancelar la adopción?' });
    expect(ventana).toHaveTextContent('Termina hoy y no se le volverá a cobrar.');
    await userEvent.type(within(ventana).getByLabelText('Motivo (nota interna)'), 'Duplicada.');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Cancelar adopción' }));
    await waitFor(() => expect(enviadosA(enviados, 4)).toEqual([{ action: 'cancel', notes: 'Duplicada.' }]));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta acción no se puede hacer con la adopción en su estado actual.',
    );
  });

  it('una adopción cerrada no tiene acciones y muestra el motivo del cierre', async () => {
    api(adminAdoptionDetail({ status: 'cancelled', endReason: 'admin_cancelled', endDate: '2026-11-18' }));
    renderRoute('/admin/adoptions/4');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Cancelada por el santuario')).toBeInTheDocument();
    for (const nombre of ['Pausar', 'Reanudar', 'Cancelar adopción']) {
      expect(screen.queryByRole('button', { name: nombre })).not.toBeInTheDocument();
    }
  });

  it('si la adopción no existe, «No encontrada»', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/adoptions/99': errorApi(404, 'NOT_FOUND', 'Esta adopción no existe.'),
    });
    renderRoute('/admin/adoptions/99');
    expect(await screen.findByText('Esta adopción no existe')).toBeInTheDocument();
  });
});
