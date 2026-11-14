import type { AdminPhotoDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adminAnimal, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute, type Peticion } from './helpers/render';

type Handler = (u: URL, p: Peticion) => { status?: number; body?: unknown };

const foto = (overrides: Partial<AdminPhotoDto>): AdminPhotoDto => ({
  id: 1,
  mediaType: 'image',
  url: '/uploads/animals/1/cover.jpg',
  thumbnailUrl: '/uploads/animals/1/thumb_cover.jpg',
  altText: 'Rufo en su rampa',
  visibility: 'public',
  sortOrder: 0,
  isCover: true,
  ...overrides,
});

const galeria = [
  foto({}),
  foto({ id: 16, altText: 'Rufo comiendo', sortOrder: 1, isCover: false }),
  foto({ id: 17, altText: 'Rufo de cerca', sortOrder: 2, isCover: false, visibility: 'adopters' }),
];

function api(extra: Record<string, Handler> = {}, fotos: AdminPhotoDto[] = galeria) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/animals/1': { body: adminAnimal() },
    '/api/admin/animals/1/photos': { body: { data: fotos } },
    ...extra,
  });
}

const archivo = (nombre: string, tipo = 'image/jpeg') => new File(['contenido'], nombre, { type: tipo });

describe('CU-29 Gestionar fotos y vídeos: pestaña «Fotos»', () => {
  it('1: la pestaña «Fotos» muestra la galería en su orden', async () => {
    api();
    renderRoute('/admin/animals/1/photos');
    expect(await screen.findByRole('link', { name: 'Fotos' })).toHaveAttribute('aria-current', 'page');
    const lista = await screen.findByRole('list', { name: 'Galería' });
    expect(
      within(lista)
        .getAllByRole('listitem')
        .map((li) => within(li).getByRole('img').getAttribute('alt')),
    ).toEqual(['Rufo en su rampa', 'Rufo comiendo', 'Rufo de cerca']);
  });

  it('sin fotos muestra un estado vacío', async () => {
    api({}, []);
    renderRoute('/admin/animals/1/photos');
    expect(await screen.findByText('Este animal todavía no tiene fotos.')).toBeInTheDocument();
  });

  it('2-4 y 2a: sube los archivos con su texto alternativo y avisa de los rechazados', async () => {
    const { fetchMock } = api({
      '/api/admin/animals/1/photos': (_u, p) =>
        p.method === 'POST'
          ? {
              status: 201,
              body: {
                created: [foto({ id: 30, altText: 'Rufo al sol', isCover: false, sortOrder: 3 })],
                rejected: [
                  {
                    fileName: 'falsa.png',
                    code: 'INVALID_FILE',
                    message: 'El archivo está dañado o no corresponde a su formato.',
                  },
                ],
              },
            }
          : { body: { data: galeria } },
    });
    renderRoute('/admin/animals/1/photos');
    await userEvent.upload(await screen.findByLabelText('Elegir archivos'), [
      archivo('sol.jpg'),
      archivo('falsa.png', 'image/png'),
    ]);
    await userEvent.type(
      within(screen.getByRole('group', { name: 'sol.jpg' })).getByLabelText('Texto alternativo'),
      'Rufo al sol',
    );
    const falsa = screen.getByRole('group', { name: 'falsa.png' });
    await userEvent.type(within(falsa).getByLabelText('Texto alternativo'), 'Falsa');
    await userEvent.selectOptions(within(falsa).getByLabelText('Visibilidad'), 'Solo adoptantes');
    await userEvent.click(screen.getByRole('button', { name: 'Subir 2 archivos' }));

    expect(await screen.findByText('Se ha subido 1 archivo.')).toBeInTheDocument();
    expect(screen.getByText('falsa.png: El archivo está dañado o no corresponde a su formato.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'sol.jpg' })).not.toBeInTheDocument();

    const llamada = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === '/api/admin/animals/1/photos' && init?.method === 'POST',
    );
    const init = llamada?.[1];
    expect(new Headers(init?.headers).get('X-Requested-With')).toBe('XMLHttpRequest');
    const datos = init?.body as FormData;
    expect(JSON.parse(String(datos.get('meta')))).toEqual([
      { altText: 'Rufo al sol', visibility: 'public' },
      { altText: 'Falsa', visibility: 'adopters' },
    ]);
    expect((datos.getAll('files') as File[]).map((f) => f.name)).toEqual(['sol.jpg', 'falsa.png']);
  });

  it('3a: sin texto alternativo no se sube nada', async () => {
    const { fetchMock } = api();
    renderRoute('/admin/animals/1/photos');
    await userEvent.upload(await screen.findByLabelText('Elegir archivos'), archivo('sol.jpg'));
    await userEvent.click(screen.getByRole('button', { name: 'Subir 1 archivo' }));
    expect(await screen.findByText('Escribe el texto alternativo.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('5-6: elige la portada y cambia el orden', async () => {
    const { enviados } = api({
      '/api/admin/animals/1/cover': () => ({ status: 204 }),
      '/api/admin/animals/1/photos/order': () => ({ status: 204 }),
    });
    renderRoute('/admin/animals/1/photos');
    await userEvent.click(await screen.findByRole('button', { name: 'Elegir como portada: Rufo comiendo' }));
    expect(await screen.findByText('Portada actualizada.')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/cover')).toEqual([{ photoId: 16 }]);

    await userEvent.click(screen.getByRole('button', { name: 'Bajar Rufo en su rampa' }));
    await waitFor(() => expect(enviados('/api/admin/animals/1/photos/order')).toEqual([{ photoIds: [16, 1, 17] }]));
  });

  it('A1: edita el texto alternativo y la visibilidad; los errores del campo se muestran junto a él', async () => {
    const { enviados } = api({
      '/api/admin/photos/1': () =>
        errorApi(422, 'COVER_MUST_BE_PUBLIC', 'La portada no puede ser solo para adoptantes.', [
          { field: 'visibility', message: 'La portada no puede ser solo para adoptantes. Elige antes otra portada.' },
        ]),
      '/api/admin/photos/16': (_u, p) => ({ body: { ...galeria[1], ...(p.body as object) } }),
    });
    renderRoute('/admin/animals/1/photos');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Rufo comiendo' }));
    const ventana = await screen.findByRole('dialog', { name: 'Editar foto' });
    const alt = within(ventana).getByLabelText('Texto alternativo');
    await userEvent.clear(alt);
    await userEvent.type(alt, 'Rufo comiendo con otros buitres');
    await userEvent.selectOptions(within(ventana).getByLabelText('Visibilidad'), 'Solo adoptantes');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Foto guardada.')).toBeInTheDocument();
    expect(enviados('/api/admin/photos/16')).toEqual([
      { altText: 'Rufo comiendo con otros buitres', visibility: 'adopters' },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Editar Rufo en su rampa' }));
    const otra = await screen.findByRole('dialog', { name: 'Editar foto' });
    await userEvent.selectOptions(within(otra).getByLabelText('Visibilidad'), 'Solo adoptantes');
    await userEvent.click(within(otra).getByRole('button', { name: 'Guardar' }));
    expect(
      await within(otra).findByText('La portada no puede ser solo para adoptantes. Elige antes otra portada.'),
    ).toBeInTheDocument();
  });

  it('A2: pide confirmación y, si era la portada, avisa de que el animal queda sin portada', async () => {
    const { pedidas } = api({ '/api/admin/photos/1': () => ({ status: 204 }) });
    renderRoute('/admin/animals/1/photos');
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar Rufo en su rampa' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Borrar esta foto?' });
    expect(within(ventana).getByText('Es la portada: el animal se quedará sin portada.')).toBeInTheDocument();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Borrar' }));
    expect(
      await screen.findByText('Foto borrada. El animal se ha quedado sin portada: elige otra.'),
    ).toBeInTheDocument();
    expect(pedidas('/api/admin/photos/1')).toHaveLength(1);
  });
});
