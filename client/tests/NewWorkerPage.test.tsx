import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminUserDetail } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';
import { elegirOpcion } from './helpers/select';

const rosa = adminUserDetail({
  id: 20,
  firstName: 'Rosa',
  lastName: 'Gil Martí',
  email: 'rosa.gil@santuario.test',
  role: 'caretaker',
  invitationPending: true,
  lastLoginAt: null,
  adoptions: [],
});

async function rellenar() {
  await userEvent.type(await screen.findByLabelText('Nombre'), 'Rosa');
  await userEvent.type(screen.getByLabelText('Apellidos'), 'Gil Martí');
  await userEvent.type(screen.getByLabelText('Email'), 'rosa.gil@santuario.test');
  await userEvent.type(screen.getByLabelText('Teléfono (opcional)'), '612345678');
  await elegirOpcion(screen.getByLabelText('Rol'), 'Cuidador');
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}

describe('CU-36 Crear una cuenta de trabajador', () => {
  it('2-5: crea la cuenta y muestra la ficha con el aviso de la invitación', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/users': () => ({ status: 201, body: rosa }),
      '/api/admin/users/20': { body: rosa },
    });
    const { router } = renderRoute('/admin/users/new');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nuevo trabajador' })).toBeInTheDocument();
    await rellenar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/users/20'));
    expect(
      await screen.findByText('Cuenta creada. Hemos enviado una invitación a rosa.gil@santuario.test'),
    ).toBeInTheDocument();
    expect(enviados('/api/admin/users')).toEqual([
      {
        firstName: 'Rosa',
        lastName: 'Gil Martí',
        email: 'rosa.gil@santuario.test',
        phone: '612-34-56-78',
        role: 'caretaker',
      },
    ]);
  });

  it('3a: el email ya tiene cuenta: error en el campo', async () => {
    const mensaje = 'Ya existe una cuenta con este email.';
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/users': errorApi(409, 'EMAIL_ALREADY_REGISTERED', mensaje, [{ field: 'email', message: mensaje }]),
    });
    renderRoute('/admin/users/new');
    await rellenar();
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
  });

  it('valida los campos antes de enviar', async () => {
    const { pedidas } = mockApi({ '/api/auth/me': { body: { user: admin() } } });
    renderRoute('/admin/users/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Escribe el nombre.')).toBeInTheDocument();
    expect(screen.getByText('Elige el rol.')).toBeInTheDocument();
    expect(pedidas('/api/admin/users')).toHaveLength(0);
  });
});
