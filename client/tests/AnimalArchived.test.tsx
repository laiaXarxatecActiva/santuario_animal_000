import type { AdminPhotoDto, VetRecordDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminAnimal, adminSpecies, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';

const faro = adminAnimal({
  id: 12,
  name: 'Faro',
  status: 'deceased',
  statusChangedAt: '2026-11-04',
  isAdoptable: false,
  showInMemorial: true,
  temperament: 'Sociable y muy querido por los cuidadores.',
  openAdoptions: 0,
});

const foto: AdminPhotoDto = {
  id: 12,
  mediaType: 'image',
  url: '/uploads/animals/12/cover.jpg',
  thumbnailUrl: '/uploads/animals/12/thumb_cover.jpg',
  altText: 'Faro sobre un tronco',
  visibility: 'public',
  sortOrder: 0,
  isCover: true,
};

const registro: VetRecordDto = {
  id: 9,
  animalId: 12,
  recordDate: '2026-10-30',
  type: 'checkup',
  description: 'Decaimiento general asociado a la edad.',
  weightKg: '1.80',
  veterinarian: 'Dra. Paula Sendra',
  createdBy: { id: 3, name: 'Nuria Peris Gil' },
  createdAt: '2026-10-30T09:00:00.000Z',
  updatedAt: '2026-10-30T09:00:00.000Z',
};

function api(user = caretaker(), estados: { method: string; body: unknown }[] = []) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/species': { body: { data: adminSpecies } },
    '/api/admin/animals/12': { body: faro },
    '/api/admin/animals/12/photos': { body: { data: [foto] } },
    '/api/admin/animals/12/vet-records': { body: { data: [registro] } },
    '/api/admin/animals/12/status': (_u: URL, p: Peticion) => {
      estados.push({ method: p.method, body: p.body });
      return { body: { ...faro, status: 'in_sanctuary', statusChangedAt: null, showInMemorial: false } };
    },
  });
}

describe('RN-22 Un animal fallecido o trasladado solo se consulta', () => {
  it('avisa arriba y sus datos se ven sin formulario ni «Guardar cambios»', async () => {
    api();
    renderRoute('/admin/animals/12');
    expect(
      await screen.findByText('Este animal ya no está en el santuario: solo se puede consultar su información.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Sociable y muy querido por los cuidadores.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // El cuidador tampoco puede cambiar su estado.
    expect(screen.queryByRole('button', { name: 'Cambiar estado' })).not.toBeInTheDocument();
  });

  it('CU-29: la galería se ve, sin subir fotos ni botones en cada una', async () => {
    api();
    renderRoute('/admin/animals/12/photos');
    const galeria = await screen.findByRole('list', { name: 'Galería' });
    expect(within(galeria).getByRole('img', { name: 'Faro sobre un tronco' })).toBeInTheDocument();
    expect(within(galeria).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Subir fotos y vídeos' })).not.toBeInTheDocument();
  });

  it('CU-34: el historial se ve, sin «Nuevo registro» ni editar o borrar', async () => {
    api(admin());
    renderRoute('/admin/animals/12/vet');
    expect(await screen.findByText('Decaimiento general asociado a la edad.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo registro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar Revisión/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Borrar Revisión/ })).not.toBeInTheDocument();
  });
});

describe('CU-33 El administrador corrige el estado de un animal archivado', () => {
  it('lo devuelve al santuario tras confirmar; al cancelar no cambia nada', async () => {
    const estados: { method: string; body: unknown }[] = [];
    api(admin(), estados);
    renderRoute('/admin/animals/12');
    expect(await screen.findByText(/Si es un error, cambia su estado/)).toBeInTheDocument();
    const abrirMenu = async () => userEvent.click(await screen.findByRole('button', { name: 'Cambiar estado' }));

    await abrirMenu();
    const opciones = screen.getAllByRole('button').map((b) => b.textContent);
    expect(opciones).toEqual(expect.arrayContaining(['En el santuario', 'En tratamiento', 'Trasladado']));
    await userEvent.click(screen.getByRole('button', { name: 'En el santuario' }));
    let ventana = within(await screen.findByRole('dialog', { name: '¿Devolver a Faro a «En el santuario»?' }));
    expect(ventana.getByText(/Sus adopciones cerradas no se reabren/)).toBeInTheDocument();
    expect(ventana.getByText(/dejará de aparecer en «En memoria»/)).toBeInTheDocument();
    await userEvent.click(ventana.getByRole('button', { name: 'Cancelar' }));
    expect(estados).toEqual([]);

    await abrirMenu();
    await userEvent.click(screen.getByRole('button', { name: 'En el santuario' }));
    ventana = within(await screen.findByRole('dialog', { name: '¿Devolver a Faro a «En el santuario»?' }));
    await userEvent.click(ventana.getByRole('button', { name: 'Cambiar estado' }));
    await waitFor(() => expect(estados).toEqual([{ method: 'PATCH', body: { status: 'in_sanctuary' } }]));
    expect(await screen.findByText('Estado cambiado a «En el santuario»')).toBeInTheDocument();
  });
});
