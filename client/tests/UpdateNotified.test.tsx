import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adminAnimal, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const vacia = { body: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } };

function publicar(notifiedAdopters: number) {
  mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/animals': {
      body: {
        data: [adminAnimal({ id: 2, name: 'Greta', activeAdopters: 2 })],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      },
    },
    '/api/admin/updates': (_u, p) =>
      p.method === 'POST'
        ? {
            status: 201,
            body: {
              id: 40,
              animal: { id: 2, name: 'Greta' },
              author: { id: 3, name: 'Nuria Peris Gil' },
              title: 'Greta',
              body: 'Texto',
              visibility: 'adopters',
              publishedAt: '2026-11-17T10:00:00.000Z',
              updatedAt: '2026-11-17T10:00:00.000Z',
              photoCount: 0,
              canEdit: true,
              photos: [],
              notifiedAdopters,
            },
          }
        : vacia,
  });
}

async function enviar() {
  renderRoute('/admin/updates/new?animalId=2');
  await waitFor(async () => expect(await screen.findByLabelText('Animal')).toHaveValue('2'));
  await userEvent.type(screen.getByLabelText('Título'), 'Greta');
  await userEvent.type(screen.getByLabelText('Texto'), 'Texto');
  await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));
}

describe('CU-31 paso 5: aviso con los adoptantes avisados (Fase 2)', () => {
  it('antes de publicar dice a cuántos adoptantes se avisará (SCREENS §5.5)', async () => {
    publicar(2);
    renderRoute('/admin/updates/new?animalId=2');
    expect(await screen.findByText('Se avisará a 2 adoptantes.')).toBeInTheDocument();
  });

  it('dice cuántos adoptantes se han avisado', async () => {
    publicar(2);
    await enviar();
    expect(await screen.findByText('Actualización publicada y 2 adoptantes avisados.')).toBeInTheDocument();
  });

  it('en singular con un adoptante', async () => {
    publicar(1);
    await enviar();
    expect(await screen.findByText('Actualización publicada y 1 adoptante avisado.')).toBeInTheDocument();
  });

  it('4a: sin adoptantes activos, solo «Actualización publicada.»', async () => {
    publicar(0);
    await enviar();
    expect(await screen.findByText('Actualización publicada.')).toBeInTheDocument();
  });
});
