import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sessionUser } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

async function rellenar({ privacidad = true, confirmacion = 'buitres-2026' } = {}) {
  await userEvent.type(await screen.findByLabelText('Nombre'), 'Ana');
  await userEvent.type(screen.getByLabelText('Apellidos'), 'Ferrer Soler');
  await userEvent.type(screen.getByLabelText('Email'), 'ana.ferrer@correo.test');
  await userEvent.type(screen.getByLabelText('Contraseña'), 'buitres-2026');
  await userEvent.type(screen.getByLabelText('Repite la contraseña'), confirmacion);
  if (privacidad) await userEvent.click(screen.getByRole('checkbox', { name: /política de privacidad/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}

const ana = sessionUser({ id: 16, firstName: 'Ana', email: 'ana.ferrer@correo.test', emailVerified: false });

describe('CU-07 Registrarse', () => {
  it('muestra el formulario con la ayuda de la contraseña y el enlace a la privacidad', async () => {
    mockApi({});
    renderRoute('/register');
    expect(await screen.findByRole('heading', { level: 1, name: 'Crear una cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription('Mínimo 8 caracteres.');
    expect(screen.getByRole('link', { name: 'política de privacidad' })).toHaveAttribute('href', '/privacy');
  });

  it('crea la cuenta, vuelve a la página de origen y avisa del email de verificación', async () => {
    const { enviados } = mockApi({ '/api/auth/register': { status: 201, body: { user: ana } } });
    const { router } = renderRoute('/register?next=/animals/3');
    await rellenar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/animals/3'));
    expect(enviados('/api/auth/register')).toEqual([
      {
        firstName: 'Ana',
        lastName: 'Ferrer Soler',
        email: 'ana.ferrer@correo.test',
        password: 'buitres-2026',
        passwordConfirm: 'buitres-2026',
        privacyAccepted: true,
      },
    ]);
    expect(await screen.findByText('Te hemos enviado un email para verificar tu cuenta.')).toBeInTheDocument();
  });

  it('3b y 3c: no envía nada si las contraseñas no coinciden o no se acepta la privacidad', async () => {
    const { pedidas } = mockApi({});
    renderRoute('/register');
    await rellenar({ privacidad: false, confirmacion: 'otra-cosa-distinta' });
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(screen.getByText('Tienes que aceptar la política de privacidad.')).toBeInTheDocument();
    expect(pedidas('/api/auth/register')).toHaveLength(0);
  });

  it('3a: el email ya está registrado, con enlaces para entrar o recuperar la contraseña', async () => {
    mockApi({ '/api/auth/register': errorApi(409, 'EMAIL_ALREADY_REGISTERED', 'x') });
    renderRoute('/register');
    await rellenar();
    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Ya existe una cuenta con este email.');
    expect(within(aviso).getByRole('link', { name: 'Inicia sesión' })).toHaveAttribute('href', '/login');
    expect(within(aviso).getByRole('link', { name: 'He olvidado mi contraseña' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('muestra junto a cada campo los errores de validación del servidor', async () => {
    mockApi({
      '/api/auth/register': errorApi(400, 'VALIDATION_ERROR', 'x', [
        { field: 'email', message: 'El email es demasiado largo.' },
      ]),
    });
    renderRoute('/register');
    await rellenar();
    expect(await screen.findByText('El email es demasiado largo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });
});
