import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, dashboard } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const panel = () =>
  mockApi({
    '/api/auth/me': { body: { user: admin() } },
    '/api/admin/dashboard': { body: dashboard() },
    '/api/admin/species': { body: { data: [] } },
  });

const menu = async () => within(await screen.findByRole('navigation', { name: 'Menú del panel' }));
const apartado = async (nombre: string) => (await menu()).getByRole('button', { name: nombre });

describe('Menú del panel plegable (SCREENS §5.1)', () => {
  it('en el escritorio, «Trabajo diario» empieza abierto y los otros dos, cerrados', async () => {
    panel();
    renderRoute('/admin');
    await screen.findByRole('heading', { level: 1, name: 'Hola, Marta' });
    expect(await apartado('Trabajo diario')).toHaveAttribute('aria-expanded', 'true');
    expect(await apartado('Animales')).toHaveAttribute('aria-expanded', 'false');
    expect(await apartado('Administración')).toHaveAttribute('aria-expanded', 'false');
    expect((await menu()).getByRole('link', { name: 'Mi día' })).toBeInTheDocument();
    expect((await menu()).queryByRole('link', { name: 'Especies' })).not.toBeInTheDocument();
    expect((await menu()).queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect((await menu()).getByRole('link', { name: 'Escritorio' })).toBeInTheDocument();
  });

  it('abre el apartado de la página en la que se está', async () => {
    panel();
    renderRoute('/admin/species');
    expect(await apartado('Animales')).toHaveAttribute('aria-expanded', 'true');
    expect((await menu()).getByRole('link', { name: 'Especies' })).toHaveAttribute('aria-current', 'page');
  });

  it('se pliega y se despliega, y recuerda la elección', async () => {
    panel();
    const { unmount } = renderRoute('/admin');
    await userEvent.click(await apartado('Trabajo diario'));
    expect(await apartado('Trabajo diario')).toHaveAttribute('aria-expanded', 'false');
    expect((await menu()).queryByRole('link', { name: 'Mi día' })).not.toBeInTheDocument();
    await userEvent.click(await apartado('Administración'));
    expect((await menu()).getByRole('link', { name: 'Usuarios' })).toHaveAttribute('href', '/admin/users');
    unmount();

    renderRoute('/admin');
    expect(await apartado('Trabajo diario')).toHaveAttribute('aria-expanded', 'false');
    expect(await apartado('Administración')).toHaveAttribute('aria-expanded', 'true');
  });
});
