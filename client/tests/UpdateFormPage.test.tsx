import type { AdminUpdateDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adminAnimal, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

const detalle = (overrides: Partial<AdminUpdateDto> = {}): AdminUpdateDto => ({
  id: 2,
  animal: { id: 1, name: 'Rufo' },
  author: { id: 3, name: 'Nuria Peris Gil' },
  title: 'Revisión del ala',
  body: 'Todo en orden.',
  visibility: 'adopters',
  publishedAt: '2026-11-11T11:30:00.000Z',
  updatedAt: '2026-11-11T11:30:00.000Z',
  photoCount: 1,
  canEdit: true,
  photos: [
    {
      id: 19,
      mediaType: 'image',
      url: '/uploads/animals/1/update_2.jpg',
      thumbnailUrl: '/uploads/animals/1/thumb_update_2.jpg',
      altText: 'La veterinaria revisa el ala de Rufo',
      visibility: 'adopters',
      sortOrder: 0,
      isCover: false,
    },
  ],
  ...overrides,
});

const animales = {
  body: {
    data: [
      adminAnimal({ id: 12, name: 'Faro', status: 'deceased' }),
      adminAnimal({ id: 1, name: 'Rufo' }),
      adminAnimal({ id: 3, name: 'Turia' }),
    ],
    meta: { page: 1, pageSize: 100, total: 3, totalPages: 1 },
  },
};

function api(extra: Record<string, Handler> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/animals': animales,
    '/api/admin/updates': () => ({ body: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } }),
    ...extra,
  });
}

/** FormData enviada a una ruta con un método. */
function formData(fetchMock: ReturnType<typeof api>['fetchMock'], ruta: string, metodo: string): FormData {
  const llamada = fetchMock.mock.calls.find(([url, init]) => String(url) === ruta && init?.method === metodo);
  expect(new Headers(llamada?.[1]?.headers).get('X-Requested-With')).toBe('XMLHttpRequest');
  return llamada?.[1]?.body as FormData;
}

const archivo = (nombre: string) => new File(['contenido'], nombre, { type: 'image/jpeg' });

describe('CU-31 Publicar una actualización (SCREENS §5.5)', () => {
  it('1-3 y 5: con el animal preseleccionado, publica con fotos y vuelve al listado', async () => {
    const { fetchMock } = api({
      '/api/admin/updates': (_u, p) =>
        p.method === 'POST'
          ? { status: 201, body: detalle({ id: 30, animal: { id: 3, name: 'Turia' } }) }
          : { body: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } },
    });
    const { router } = renderRoute('/admin/updates/new?animalId=3');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nueva actualización' })).toBeInTheDocument();
    const animal = await screen.findByLabelText('Animal');
    await waitFor(() => expect(animal).toHaveValue('3'));
    // Los fallecidos y trasladados no se ofrecen.
    expect(within(animal).queryByRole('option', { name: 'Faro' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Solo adoptantes' })).toBeChecked();

    await userEvent.type(screen.getByLabelText('Título'), 'Turia y la lluvia');
    await userEvent.type(screen.getByLabelText('Texto'), 'Hoy ha llovido.');
    await userEvent.upload(screen.getByLabelText('Elegir archivos'), archivo('lluvia.jpg'));
    const grupo = screen.getByRole('group', { name: 'lluvia.jpg' });
    expect(within(grupo).queryByLabelText('Visibilidad')).not.toBeInTheDocument();
    await userEvent.type(within(grupo).getByLabelText('Texto alternativo'), 'Turia mojada');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/updates'));
    expect(await screen.findByText('Actualización publicada.')).toBeInTheDocument();
    const datos = formData(fetchMock, '/api/admin/updates', 'POST');
    expect(datos.get('animalId')).toBe('3');
    expect(datos.get('title')).toBe('Turia y la lluvia');
    expect(datos.get('body')).toBe('Hoy ha llovido.');
    expect(datos.get('visibility')).toBe('adopters');
    expect(JSON.parse(String(datos.get('meta')))).toEqual([{ altText: 'Turia mojada' }]);
    expect((datos.getAll('files') as File[]).map((f) => f.name)).toEqual(['lluvia.jpg']);
  });

  it('3a: título, texto y animal son obligatorios; también el texto alternativo de cada foto', async () => {
    const { fetchMock } = api();
    renderRoute('/admin/updates/new');
    await userEvent.upload(await screen.findByLabelText('Elegir archivos'), archivo('sin-alt.jpg'));
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(await screen.findByText('Elige el animal.')).toBeInTheDocument();
    expect(screen.getByText('Escribe el título.')).toBeInTheDocument();
    expect(screen.getByText('Escribe el texto.')).toBeInTheDocument();
    expect(screen.getByText('Escribe el texto alternativo.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('si el servidor rechaza algún archivo, se muestra cuál y por qué', async () => {
    api({
      '/api/admin/updates': (_u, p) =>
        p.method === 'POST'
          ? errorApi(422, 'FILES_REJECTED', 'Algún archivo no se puede subir; revísalo o quítalo.', [
              { field: 'files.0', message: 'mala.jpg: El archivo está dañado o no corresponde a su formato.' },
            ])
          : { body: { data: [] } },
    });
    renderRoute('/admin/updates/new?animalId=1');
    await waitFor(async () => expect(await screen.findByLabelText('Animal')).toHaveValue('1'));
    await userEvent.type(screen.getByLabelText('Título'), 'Rufo');
    await userEvent.type(screen.getByLabelText('Texto'), 'Texto');
    await userEvent.upload(screen.getByLabelText('Elegir archivos'), archivo('mala.jpg'));
    await userEvent.type(screen.getByLabelText('Texto alternativo'), 'Mala');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(
      await screen.findByText('mala.jpg: El archivo está dañado o no corresponde a su formato.'),
    ).toBeInTheDocument();
  });
});

describe('CU-32 Editar una actualización', () => {
  it('2-3: cambia el texto, la visibilidad y quita fotos', async () => {
    const { fetchMock } = api({
      '/api/admin/updates/2': (_u, p) => ({ body: p.method === 'PUT' ? detalle({ visibility: 'public' }) : detalle() }),
    });
    const { router } = renderRoute('/admin/updates/2');
    expect(await screen.findByRole('heading', { level: 1, name: 'Editar actualización' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Revisión del ala')).toBeInTheDocument();
    expect(screen.getByText('Rufo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Animal')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar La veterinaria revisa el ala de Rufo' }));
    expect(screen.queryByRole('img', { name: 'La veterinaria revisa el ala de Rufo' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Pública' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/updates'));
    expect(await screen.findByText('Actualización guardada.')).toBeInTheDocument();
    const datos = formData(fetchMock, '/api/admin/updates/2', 'PUT');
    expect(datos.get('title')).toBe('Revisión del ala');
    expect(datos.get('visibility')).toBe('public');
    expect(JSON.parse(String(datos.get('removePhotoIds')))).toEqual([19]);
    expect(JSON.parse(String(datos.get('meta')))).toEqual([]);
    expect(datos.get('animalId')).toBeNull();
  });

  it('1a: si no puede modificarla, no se muestra el formulario', async () => {
    api({ '/api/admin/updates/3': () => ({ body: detalle({ id: 3, canEdit: false }) }) });
    renderRoute('/admin/updates/3');
    expect(
      await screen.findByText('Solo su autor o un administrador puede modificar esta actualización.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
  });
});
