import type { MemorialAnimalDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adminAnimal, caretaker, card, update } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const faro: MemorialAnimalDto = {
  id: 12,
  name: 'Faro',
  species: { id: 3, name: 'Alimoche común', scientificName: 'Neophron percnopterus' },
  sex: 'male',
  coverPhoto: card().coverPhoto,
  arrivalDate: '2022-11-18',
  deathDate: '2026-10-29',
  rescueStory: 'Llegó muy mayor y vivió tranquilo sus últimos años.',
  photos: [card().coverPhoto!],
  updates: [update],
};

describe('CU-12 Consultar la sección «En memoria»', () => {
  it('2: muestra los animales marcados con su foto, especie y los años «2022 – 2026», sin adoptantes', async () => {
    mockApi({ '/api/animals/memorial': { body: { data: [faro] } } });
    renderRoute('/memorial');
    expect(await screen.findByRole('heading', { level: 1, name: 'En memoria' })).toBeInTheDocument();
    const tarjeta = await screen.findByRole('link', { name: /Faro/ });
    expect(tarjeta).toHaveAttribute('href', '/memorial/12');
    expect(within(tarjeta).getByText('Alimoche común')).toBeInTheDocument();
    expect(within(tarjeta).getByText('2022 – 2026')).toBeInTheDocument();
    expect(within(tarjeta).queryByText(/adopt/i)).not.toBeInTheDocument();
  });

  it('3: la ficha es de solo lectura: fechas, historia y noticias públicas, sin botón de adoptar', async () => {
    mockApi({ '/api/animals/memorial': { body: { data: [faro] } } });
    renderRoute('/memorial/12');
    expect(await screen.findByRole('heading', { level: 1, name: 'Faro' })).toBeInTheDocument();
    expect(screen.getByText('Llegó al santuario el 18 de noviembre de 2022')).toBeInTheDocument();
    expect(screen.getByText('Nos dejó el 29 de octubre de 2026')).toBeInTheDocument();
    expect(screen.getByText(/vivió tranquilo/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: update.title })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Adoptar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adoptar/ })).not.toBeInTheDocument();
  });

  it('2a: sin animales marcados, el enlace no aparece y la página muestra un mensaje neutro', async () => {
    mockApi({ '/api/animals/memorial': { body: { data: [] } } });
    renderRoute('/memorial');
    expect(await screen.findByText('Por ahora no hay ningún animal en esta sección.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'En memoria' })).not.toBeInTheDocument();
  });

  it('con animales marcados, el pie enlaza a «En memoria»', async () => {
    mockApi({ '/api/animals/memorial': { body: { data: [faro] } } });
    renderRoute('/memorial');
    expect(await screen.findByRole('link', { name: 'En memoria' })).toHaveAttribute('href', '/memorial');
  });
});

describe('CU-12 en el panel: marcar un fallecido para «En memoria»', () => {
  it('al registrar el fallecimiento se puede marcar «Mostrar en En memoria»', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/animals/15': { body: adminAnimal({ id: 15, name: 'Roca', openAdoptions: 0 }) },
      '/api/admin/animals/15/status': {
        body: adminAnimal({ id: 15, name: 'Roca', status: 'deceased', showInMemorial: true }),
      },
    });
    renderRoute('/admin/animals/15');
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar estado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fallecido' }));
    const ventana = await screen.findByRole('dialog');
    await userEvent.click(within(ventana).getByRole('switch', { name: 'Mostrar en «En memoria»' }));
    await userEvent.click(within(ventana).getByRole('button', { name: 'Registrar' }));
    await waitFor(() =>
      expect(enviados('/api/admin/animals/15/status')[0]).toMatchObject({ status: 'deceased', showInMemorial: true }),
    );
  });

  it('en los datos de un fallecido se puede quitar de «En memoria»', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/animals/12': (_url, { method }) => ({
        body: adminAnimal({
          id: 12,
          name: 'Faro',
          status: 'deceased',
          isAdoptable: false,
          showInMemorial: method === 'GET',
        }),
      }),
      '/api/admin/species': {
        body: { data: [{ id: 1, name: 'Buitre leonado', scientificName: null, description: null, animalCount: 1 }] },
      },
    });
    renderRoute('/admin/animals/12');
    const interruptor = await screen.findByRole('switch', { name: 'Mostrar en «En memoria»' });
    expect(interruptor).toBeChecked();
    await userEvent.click(interruptor);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(enviados('/api/admin/animals/12').find(Boolean)).toMatchObject({ showInMemorial: false }),
    );
  });

  it('un animal que no ha fallecido no muestra la opción', async () => {
    mockApi({
      '/api/auth/me': { body: { user: caretaker() } },
      '/api/admin/animals/1': { body: adminAnimal() },
    });
    renderRoute('/admin/animals/1');
    await screen.findByRole('switch', { name: /Publicado/ });
    expect(screen.queryByRole('switch', { name: 'Mostrar en «En memoria»' })).not.toBeInTheDocument();
  });
});
