import { describe, expect, it } from 'vitest';
import { accesosDeSerie, accesosDisponibles, enlacesDelMenu } from '../src/utils/panelLinks';

const rutas = (lista: readonly { to: string }[]) => lista.map((e) => e.to);

describe('Páginas del panel por rol (menú y accesos rápidos)', () => {
  it('el menú del cuidador no tiene las páginas ni el apartado del administrador', () => {
    const grupos = enlacesDelMenu('caretaker');
    const todas = grupos.flatMap((g) => rutas(g.links));
    expect(todas).toContain('/admin/my-day');
    expect(todas).not.toContain('/admin/today');
    expect(todas).not.toContain('/admin/users');
    expect(grupos.map((g) => g.key)).not.toContain('admin.nav.groupAdmin');
  });

  it('el administrador lo ve todo', () => {
    const todas = enlacesDelMenu('admin').flatMap((g) => rutas(g.links));
    expect(todas).toEqual(expect.arrayContaining(['/admin/today', '/admin/users', '/admin/my-day']));
  });

  it('los accesos disponibles son las acciones y las páginas del menú, sin el escritorio', () => {
    const cuidador = rutas(accesosDisponibles('caretaker'));
    expect(cuidador.slice(0, 2)).toEqual(['/admin/updates/new', '/admin/animals/new']);
    expect(cuidador).toContain('/admin/incidents');
    expect(cuidador).not.toContain('/admin');
    expect(cuidador).not.toContain('/admin/adoptions/new');
    expect(cuidador).not.toContain('/admin/users');
    expect(rutas(accesosDisponibles('admin'))).toEqual(
      expect.arrayContaining(['/admin/adoptions/new', '/admin/donations/new', '/admin/users']),
    );
  });

  it('de serie: las acciones de crear que puede usar cada rol', () => {
    expect(accesosDeSerie('caretaker')).toEqual(['/admin/updates/new', '/admin/animals/new']);
    expect(accesosDeSerie('admin')).toEqual([
      '/admin/updates/new',
      '/admin/animals/new',
      '/admin/adoptions/new',
      '/admin/donations/new',
    ]);
  });
});
