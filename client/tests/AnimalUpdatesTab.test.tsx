import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { adminAnimal, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const lista = {
  body: {
    data: [
      {
        id: 2,
        animal: { id: 1, name: 'Rufo' },
        author: { id: 3, name: 'Nuria Peris Gil' },
        title: 'Revisión del ala',
        visibility: 'adopters',
        publishedAt: '2026-11-11T11:30:00.000Z',
        photoCount: 1,
        canEdit: true,
      },
    ],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  },
};

const pestañas = () => screen.getByRole('navigation', { name: 'Secciones del animal' });

describe('CU-31 pestaña «Actualizaciones» de la ficha del animal (SCREENS §5.4)', () => {
  it('lista las actualizaciones del animal y enlaza a «Nueva actualización» con el animal elegido', async () => {
    const { pedidas } = mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/animals/1': { body: adminAnimal() },
      '/api/admin/updates': lista,
    });
    renderRoute('/admin/animals/1/updates');
    expect(
      await within(await screen.findByRole('navigation', { name: 'Secciones del animal' })).findByRole('link', {
        name: 'Actualizaciones',
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Revisión del ala')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nueva actualización' })).toHaveAttribute(
      'href',
      '/admin/updates/new?animalId=1',
    );
    await waitFor(() => expect(pedidas('/api/admin/updates').at(-1)?.searchParams.get('animalId')).toBe('1'));
    // El animal ya está elegido: no se filtra por animal.
    expect(screen.queryByLabelText('Animal')).not.toBeInTheDocument();
    expect(within(pestañas()).getAllByRole('link')).toHaveLength(3);
  });

  it('un animal fallecido o trasladado no admite nuevas actualizaciones', async () => {
    mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/animals/12': { body: adminAnimal({ id: 12, name: 'Faro', status: 'deceased' }) },
      '/api/admin/updates': lista,
    });
    renderRoute('/admin/animals/12/updates');
    expect(await screen.findByText('Revisión del ala')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nueva actualización' })).not.toBeInTheDocument();
  });
});
