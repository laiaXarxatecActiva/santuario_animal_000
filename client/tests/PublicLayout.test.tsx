import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const HOW = '/how-it-works';
const planes = { '/api/plans': { body: { data: [] } } };

describe('PublicLayout', () => {
  it('RN-21: avisa al adoptante con el email sin verificar y permite reenviarlo', async () => {
    mockApi({
      ...planes,
      '/api/auth/me': { body: { user: sessionUser({ emailVerified: false }) } },
      '/api/auth/resend-verification': { status: 204 },
    });
    renderRoute(HOW);
    expect(await screen.findByText('Verifica tu email para poder adoptar.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar email' }));
    expect(await screen.findByText('Te hemos enviado un nuevo email de verificación.')).toBeInTheDocument();
  });

  it('no avisa con el email verificado ni a los visitantes', async () => {
    mockApi({ ...planes, '/api/auth/me': { body: { user: sessionUser() } } });
    renderRoute(HOW);
    await screen.findByRole('button', { name: 'Menú de Lucía' });
    expect(screen.queryByText('Verifica tu email para poder adoptar.')).not.toBeInTheDocument();
  });

  it('el aviso que llega con la navegación se puede cerrar', async () => {
    mockApi(planes);
    const { router } = renderRoute('/');
    await router.navigate(HOW, { state: { flash: { type: 'info', message: 'Hola' } } });
    expect(await screen.findByText('Hola')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText('Hola')).not.toBeInTheDocument();
  });
});
