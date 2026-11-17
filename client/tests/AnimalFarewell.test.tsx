import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adminAnimal, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

function api(animal = adminAnimal(), estado?: { status?: number; body?: unknown }) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/species': { body: { data: [] } },
    [`/api/admin/animals/${animal.id}`]: { body: animal },
    [`/api/admin/animals/${animal.id}/status`]: (_u, p) =>
      estado ?? { body: { ...animal, ...(p.body as object), isAdoptable: false, openAdoptions: 0 } },
  });
}

async function abrir(estado: 'Fallecido' | 'Trasladado') {
  renderRoute('/admin/animals/1');
  await userEvent.click(await screen.findByRole('button', { name: 'Cambiar estado' }));
  await userEvent.click(screen.getByRole('button', { name: estado }));
  return screen.getByRole('dialog');
}

describe('CU-33 Registrar el fallecimiento o traslado de un animal (SCREENS §5.3)', () => {
  it('3 y 3a: un fallecimiento con adoptantes pide el mensaje; sin él no se envía', async () => {
    const { enviados } = api();
    const dialogo = await abrir('Fallecido');
    const mensaje = within(dialogo).getByLabelText('Mensaje para los adoptantes');
    expect(mensaje).toBeRequired();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }));
    expect(await within(dialogo).findByText('Escribe el mensaje para los adoptantes.')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/status')).toEqual([]);
  });

  it('el traslado no pide mensaje: los adoptantes reciben un aviso', async () => {
    const { enviados } = api();
    const dialogo = await abrir('Trasladado');
    expect(within(dialogo).queryByLabelText('Mensaje para los adoptantes')).not.toBeInTheDocument();
    expect(within(dialogo).getByText(/recibirán un aviso/)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByText('Estado cambiado a «Trasladado»')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/status')).toEqual([{ status: 'transferred', date: expect.any(String) }]);
  });

  it('2a: sin adopciones abiertas no se pide mensaje', async () => {
    const { enviados } = api(adminAnimal({ openAdoptions: 0 }));
    const dialogo = await abrir('Fallecido');
    expect(within(dialogo).queryByLabelText('Mensaje para los adoptantes')).not.toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByText('Estado cambiado a «Fallecido»')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/status')).toEqual([{ status: 'deceased', date: expect.any(String) }]);
  });

  it('el error del servidor en el mensaje se muestra en el campo y el diálogo sigue abierto', async () => {
    api(
      adminAnimal(),
      errorApi(422, 'FAREWELL_MESSAGE_REQUIRED', 'Escribe el mensaje para los adoptantes.', [
        { field: 'message', message: 'Escribe el mensaje para los adoptantes.' },
      ]),
    );
    const dialogo = await abrir('Fallecido');
    await userEvent.type(within(dialogo).getByLabelText('Mensaje para los adoptantes'), '.');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar' }));
    expect(await within(dialogo).findByText('Escribe el mensaje para los adoptantes.')).toBeInTheDocument();
  });
});
