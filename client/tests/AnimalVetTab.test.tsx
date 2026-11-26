import type { VetRecordDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminAnimal, caretaker } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';
import { elegirOpcion } from './helpers/select';

function registro(overrides: Partial<VetRecordDto> = {}): VetRecordDto {
  return {
    id: 1,
    animalId: 1,
    recordDate: '2026-11-15',
    type: 'checkup',
    description: 'Revisión mensual. Muñón del ala bien cicatrizado.',
    weightKg: '8.40',
    veterinarian: 'Dra. Paula Sendra',
    createdBy: { id: 3, name: 'Nuria Peris Gil' },
    createdAt: '2026-11-15T09:00:00.000Z',
    updatedAt: '2026-11-15T09:00:00.000Z',
    ...overrides,
  };
}

const registros = [
  registro(),
  registro({ id: 2, recordDate: '2026-07-18', description: 'Revisión rutinaria.', weightKg: '8.30' }),
];

function api(user = caretaker(), extra: Record<string, Parameters<typeof mockApi>[0][string]> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user } },
    '/api/admin/animals/1': { body: adminAnimal() },
    '/api/admin/animals/1/vet-records': (_url, { method }) =>
      method === 'POST' ? { status: 201, body: registro({ id: 3 }) } : { body: { data: registros } },
    ...extra,
  });
}

describe('CU-34 Gestionar el historial veterinario', () => {
  it('1-2: la pestaña «Veterinario» muestra los registros y el gráfico del peso', async () => {
    api();
    renderRoute('/admin/animals/1/vet');
    const pestañas = await screen.findByRole('navigation', { name: 'Secciones del animal' });
    expect(within(pestañas).getByRole('link', { name: 'Veterinario' })).toHaveAttribute('aria-current', 'page');
    const fila = (await screen.findByText('Revisión rutinaria.')).closest('tr') as HTMLElement;
    expect(within(fila).getByText('Revisión')).toBeInTheDocument();
    expect(within(fila).getByText('8,3 kg')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Evolución del peso: 2 valores/ })).toBeInTheDocument();
    expect(screen.getByText(/Solo lo ve el personal/)).toBeInTheDocument();
  });

  it('3-4: añade un registro con fecha, tipo, descripción, peso y veterinario', async () => {
    const { enviados } = api();
    renderRoute('/admin/animals/1/vet');
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo registro' }));
    const ventana = await screen.findByRole('dialog', { name: 'Nuevo registro' });
    const fecha = within(ventana).getByLabelText('Fecha');
    await userEvent.clear(fecha);
    await userEvent.type(fecha, '2026-11-10');
    await elegirOpcion(within(ventana).getByLabelText('Tipo'), 'Vacuna');
    await userEvent.type(within(ventana).getByLabelText('Descripción'), 'Vacunación anual.');
    await userEvent.type(within(ventana).getByLabelText(/Peso \(kg\)/), '8,5');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Registro añadido.')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/vet-records').find(Boolean)).toMatchObject({
      recordDate: '2026-11-10',
      type: 'vaccine',
      description: 'Vacunación anual.',
      weightKg: '8,5',
    });
  });

  it('4a: el error de la fecha futura del servidor aparece en su campo', async () => {
    api(caretaker(), {
      '/api/admin/animals/1/vet-records': (_url, { method }) =>
        method === 'POST'
          ? errorApi(400, 'VALIDATION_ERROR', 'No válido', [
              { field: 'recordDate', message: 'La fecha no puede ser futura.' },
            ])
          : { body: { data: registros } },
    });
    renderRoute('/admin/animals/1/vet');
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo registro' }));
    const ventana = await screen.findByRole('dialog');
    await userEvent.type(within(ventana).getByLabelText('Descripción'), 'X');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await within(ventana).findByText('La fecha no puede ser futura.')).toBeInTheDocument();
  });

  it('A2: solo el administrador ve «Borrar», y pide confirmación', async () => {
    api();
    const vista = renderRoute('/admin/animals/1/vet');
    await screen.findByText('Revisión rutinaria.');
    expect(screen.getAllByRole('button', { name: /^Editar/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Borrar/ })).not.toBeInTheDocument();
    vista.unmount();

    const { pedidas } = api(admin(), { '/api/admin/vet-records/2': { status: 204 } });
    renderRoute('/admin/animals/1/vet');
    const fila = (await screen.findByText('Revisión rutinaria.')).closest('tr') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: /^Borrar/ }));
    const ventana = await screen.findByRole('dialog', { name: '¿Borrar este registro?' });
    await userEvent.click(within(ventana).getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText('Registro borrado.')).toBeInTheDocument();
    await waitFor(() => expect(pedidas('/api/admin/vet-records/2')).toHaveLength(1));
  });

  it('el menú «Veterinario» lleva a elegir un animal y muestra su historial', async () => {
    api(caretaker(), {
      '/api/admin/animals': {
        body: { data: [adminAnimal()], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } },
      },
      '/api/admin/dashboard': {
        body: { animalsByStatus: {}, activeAdoptions: 0, pendingAdoptions: 0, updateAlerts: [] },
      },
    });
    renderRoute('/admin');
    // El apartado «Animales» empieza cerrado en el escritorio.
    await userEvent.click(await screen.findByRole('button', { name: 'Animales' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Veterinario' }));
    await elegirOpcion(await screen.findByLabelText('Animal'), 'Rufo');
    expect(await screen.findByText('Revisión rutinaria.')).toBeInTheDocument();
  });
});
