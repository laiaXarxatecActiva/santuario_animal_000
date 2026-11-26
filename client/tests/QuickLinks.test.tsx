import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, caretaker, dashboard } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

type Usuario = ReturnType<typeof caretaker>;

function escritorio(user: Usuario) {
  mockApi({ '/api/auth/me': { body: { user } }, '/api/admin/dashboard': { body: dashboard() } });
  return renderRoute('/admin');
}

const seccion = async () => screen.findByRole('region', { name: 'Accesos rápidos' });

const accesos = async () =>
  within(await seccion())
    .queryAllByRole('link')
    .map((a) => [a.textContent, a.getAttribute('href')]);

const personalizar = async () => {
  await userEvent.click(within(await seccion()).getByRole('button', { name: 'Personalizar' }));
  return screen.getByRole('dialog', { name: 'Personalizar accesos rápidos' });
};

describe('CU-27 Escritorio: accesos rápidos', () => {
  it('el cuidador ve de serie «Nueva actualización» y «Nuevo animal»', async () => {
    escritorio(caretaker());
    expect(await accesos()).toEqual([
      ['Nueva actualización', '/admin/updates/new'],
      ['Nuevo animal', '/admin/animals/new'],
    ]);
  });

  it('el administrador ve además «Nueva adopción» y «Registrar donación»', async () => {
    escritorio(admin());
    expect(await accesos()).toEqual([
      ['Nueva actualización', '/admin/updates/new'],
      ['Nuevo animal', '/admin/animals/new'],
      ['Nueva adopción', '/admin/adoptions/new'],
      ['Registrar donación', '/admin/donations/new'],
    ]);
  });

  it('«Personalizar» ofrece las acciones y las páginas de su menú, sin las del administrador', async () => {
    escritorio(caretaker());
    const ventana = await personalizar();
    expect(within(ventana).getByRole('checkbox', { name: 'Nueva actualización' })).toBeChecked();
    expect(within(ventana).getByRole('checkbox', { name: 'Nuevo animal' })).toBeChecked();
    expect(within(ventana).getByRole('checkbox', { name: 'Mi día' })).not.toBeChecked();
    expect(within(ventana).getByRole('checkbox', { name: 'Incidencias' })).toBeInTheDocument();
    expect(within(ventana).queryByRole('checkbox', { name: 'Nueva adopción' })).not.toBeInTheDocument();
    expect(within(ventana).queryByRole('checkbox', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(within(ventana).queryByRole('checkbox', { name: 'Hoy' })).not.toBeInTheDocument();
    expect(within(ventana).queryByRole('checkbox', { name: 'Escritorio' })).not.toBeInTheDocument();
  });

  it('guardar cambia los accesos, en el orden de la lista, y se recuerda al volver', async () => {
    const { unmount } = escritorio(caretaker());
    const ventana = await personalizar();
    await userEvent.click(within(ventana).getByRole('checkbox', { name: 'Nuevo animal' }));
    await userEvent.click(within(ventana).getByRole('checkbox', { name: 'Incidencias' }));
    await userEvent.click(within(ventana).getByRole('checkbox', { name: 'Mi día' }));
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const esperado = [
      ['Nueva actualización', '/admin/updates/new'],
      ['Mi día', '/admin/my-day'],
      ['Incidencias', '/admin/incidents'],
    ];
    expect(await accesos()).toEqual(esperado);
    unmount();

    escritorio(caretaker());
    expect(await accesos()).toEqual(esperado);
  });

  it('«Cancelar» cierra sin cambiar nada', async () => {
    escritorio(caretaker());
    const ventana = await personalizar();
    await userEvent.click(within(ventana).getByRole('checkbox', { name: 'Mi día' }));
    await userEvent.click(within(ventana).getByRole('button', { name: 'Cancelar' }));
    expect(await accesos()).toEqual([
      ['Nueva actualización', '/admin/updates/new'],
      ['Nuevo animal', '/admin/animals/new'],
    ]);
  });

  it('sin ninguno marcado, lo dice y deja personalizarlos', async () => {
    escritorio(caretaker());
    const ventana = await personalizar();
    await userEvent.click(within(ventana).getByRole('checkbox', { name: 'Nueva actualización' }));
    await userEvent.click(within(ventana).getByRole('checkbox', { name: 'Nuevo animal' }));
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    const zona = await seccion();
    expect(within(zona).queryAllByRole('link')).toHaveLength(0);
    expect(within(zona).getByText('No tienes accesos rápidos.')).toBeInTheDocument();
    expect(within(zona).getByRole('button', { name: 'Personalizar' })).toBeInTheDocument();
  });

  it('«Restablecer» vuelve a marcar los de serie', async () => {
    escritorio(caretaker());
    let ventana = await personalizar();
    await userEvent.click(within(ventana).getByRole('checkbox', { name: 'Nuevo animal' }));
    await userEvent.click(within(ventana).getByRole('checkbox', { name: 'Mi día' }));
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));

    ventana = await personalizar();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Restablecer' }));
    expect(within(ventana).getByRole('checkbox', { name: 'Nuevo animal' })).toBeChecked();
    expect(within(ventana).getByRole('checkbox', { name: 'Mi día' })).not.toBeChecked();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await accesos()).toEqual([
      ['Nueva actualización', '/admin/updates/new'],
      ['Nuevo animal', '/admin/animals/new'],
    ]);
  });

  it('cada persona tiene los suyos en el mismo navegador', async () => {
    const { unmount } = escritorio(admin());
    const ventana = await personalizar();
    await userEvent.click(within(ventana).getByRole('checkbox', { name: 'Pagos' }));
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await accesos()).toContainEqual(['Pagos', '/admin/payments']);
    unmount();

    escritorio(caretaker());
    expect(await accesos()).toEqual([
      ['Nueva actualización', '/admin/updates/new'],
      ['Nuevo animal', '/admin/animals/new'],
    ]);
  });

  it('ignora lo guardado que su rol no puede usar y los datos dañados', async () => {
    localStorage.setItem('quick-links:3', JSON.stringify(['/admin/users', '/admin/my-day', 42]));
    const { unmount } = escritorio(caretaker());
    expect(await accesos()).toEqual([['Mi día', '/admin/my-day']]);
    unmount();

    localStorage.setItem('quick-links:3', '{no es json');
    escritorio(caretaker());
    expect(await accesos()).toEqual([
      ['Nueva actualización', '/admin/updates/new'],
      ['Nuevo animal', '/admin/animals/new'],
    ]);
  });
});
