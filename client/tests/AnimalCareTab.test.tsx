import type { AnimalCareDto, MedicationPlanDto, VetVisitDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { adminAnimal, caretaker } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';
import { cualificaciones } from './helpers/work-fixtures';
import { anadirHora, elegirHora, elegirOpcion } from './helpers/select';

const pauta = (overrides: Partial<MedicationPlanDto> = {}): MedicationPlanDto => ({
  id: 1,
  animalId: 1,
  medication: 'Doxiciclina',
  dose: '100 mg',
  route: 'oral',
  times: ['10:00'],
  startDate: '2026-11-20',
  endDate: '2026-11-27',
  qualification: { id: 1, name: 'Administrar medicación' },
  notes: 'Dentro de un trozo de carne.',
  isActive: true,
  dosesGiven: 2,
  dosesMissed: 1,
  hasHistory: true,
  ...overrides,
});

const visita = (overrides: Partial<VetVisitDto> = {}): VetVisitDto => ({
  id: 2,
  animalId: 1,
  date: '2026-11-23',
  time: '10:30',
  reason: 'Control de la infección respiratoria.',
  veterinarian: 'Dra. Paula Sendra',
  status: 'scheduled',
  vetRecordId: null,
  taskId: 50,
  ...overrides,
});

const CUIDADOS: AnimalCareDto = {
  animalId: 1,
  diet: [
    {
      id: 5,
      animalId: 1,
      food: 'Carne de pollo sin hueso',
      quantity: '400.00',
      unit: 'g',
      schedule: 'Mañana y tarde',
      notes: 'La doxiciclina va en la toma de la mañana.',
      startDate: '2026-11-04',
      endDate: null,
      isCurrent: true,
    },
    {
      id: 4,
      animalId: 1,
      food: 'Papilla de carne picada',
      quantity: '200.00',
      unit: 'g',
      schedule: null,
      notes: null,
      startDate: '2026-08-23',
      endDate: '2026-11-03',
      isCurrent: false,
    },
  ],
  feedings: [
    { taskId: 90, date: '2026-11-23', time: '09:00', intake: 'little', recordedBy: { id: 3, name: 'Nuria Peris Gil' } },
    { taskId: 80, date: '2026-11-22', time: '17:00', intake: 'all', recordedBy: { id: 5, name: 'Carmen Boix Sanz' } },
  ],
  lowIntakeStreak: 1,
  medicationPlans: [pauta()],
  vetVisits: [visita()],
};

function api(extra: Record<string, (u: URL, p: Peticion) => { status?: number; body?: unknown }> = {}) {
  return mockApi({
    '/api/auth/me': { body: { user: caretaker() } },
    '/api/admin/animals/1': { body: adminAnimal() },
    '/api/admin/animals/1/care': () => ({ body: CUIDADOS }),
    '/api/admin/qualifications': () => ({ body: { data: cualificaciones } }),
    ...extra,
  });
}

const seccion = (nombre: string) => screen.findByRole('region', { name: nombre });

describe('Pestaña «Cuidados» (CU-65 a CU-69)', () => {
  it('muestra la dieta, las comidas, la medicación y las visitas', async () => {
    api();
    renderRoute('/admin/animals/1/care');
    const pestanas = await screen.findByRole('navigation', { name: 'Secciones del animal' });
    expect(within(pestanas).getByRole('link', { name: 'Cuidados' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Ha comido poco en su última comida.')).toBeInTheDocument();

    const dieta = await seccion('Dieta');
    const pollo = within(dieta).getByText('Carne de pollo sin hueso').closest('tr') as HTMLElement;
    expect(within(pollo).getByText('400 g')).toBeInTheDocument();
    expect(within(pollo).getByText('Mañana y tarde')).toBeInTheDocument();
    const papilla = within(dieta).getByText('Papilla de carne picada').closest('tr') as HTMLElement;
    expect(within(papilla).getByText('Terminada')).toBeInTheDocument();

    const comidas = await seccion('Comidas de los últimos 14 días');
    expect(within(comidas).getByText('Menos de la mitad')).toBeInTheDocument();
    expect(within(comidas).getByText('Nuria Peris Gil')).toBeInTheDocument();

    const medicacion = await seccion('Medicación');
    const doxi = within(medicacion).getByRole('article', { name: /Doxiciclina/ });
    expect(within(doxi).getByText(/100 mg · Oral · 10:00/)).toBeInTheDocument();
    expect(within(doxi).getByText('Dosis dadas: 2 · No dadas: 1')).toBeInTheDocument();
    expect(within(doxi).getByText(/Exige: Administrar medicación/)).toBeInTheDocument();

    const visitas = await seccion('Visitas veterinarias');
    const fila = within(visitas).getByText('Control de la infección respiratoria.').closest('tr') as HTMLElement;
    expect(within(fila).getByText('Programada')).toBeInTheDocument();
    expect(within(fila).getByText('Dra. Paula Sendra')).toBeInTheDocument();
  });
});

describe('CU-65 Gestionar la dieta', () => {
  it('añade un alimento con su cantidad, unidad y tomas', async () => {
    const { enviados } = api({
      '/api/admin/animals/1/diet-items': () => ({ status: 201, body: CUIDADOS.diet[0] }),
    });
    renderRoute('/admin/animals/1/care');
    await userEvent.click(within(await seccion('Dieta')).getByRole('button', { name: 'Nuevo alimento' }));
    const ventana = await screen.findByRole('dialog', { name: 'Nuevo alimento' });
    await userEvent.type(within(ventana).getByLabelText('Alimento'), 'Carne de codorniz');
    await userEvent.type(within(ventana).getByLabelText('Cantidad'), '250,5');
    await elegirOpcion(within(ventana).getByLabelText('Unidad'), 'g');
    await userEvent.type(within(ventana).getByLabelText('Tomas (opcional)'), 'Por la mañana');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Alimento añadido')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/diet-items')).toEqual([
      expect.objectContaining({ food: 'Carne de codorniz', quantity: '250,5', unit: 'g', schedule: 'Por la mañana' }),
    ]);
  });

  it('sin alimento ni cantidad, avisa en los campos y no envía nada', async () => {
    const { enviados } = api();
    renderRoute('/admin/animals/1/care');
    await userEvent.click(within(await seccion('Dieta')).getByRole('button', { name: 'Nuevo alimento' }));
    const ventana = await screen.findByRole('dialog', { name: 'Nuevo alimento' });
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await within(ventana).findByText('Escribe el alimento.')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/diet-items')).toEqual([]);
  });
});

describe('CU-69 Gestionar las pautas de medicación', () => {
  it('crea una pauta con sus horas y la cualificación', async () => {
    const { enviados } = api({
      '/api/admin/animals/1/medication-plans': () => ({ status: 201, body: pauta({ id: 7 }) }),
    });
    renderRoute('/admin/animals/1/care');
    await userEvent.click(within(await seccion('Medicación')).getByRole('button', { name: 'Nueva pauta' }));
    const ventana = await screen.findByRole('dialog', { name: 'Nueva pauta' });
    await userEvent.type(within(ventana).getByLabelText('Medicamento'), 'Meloxicam');
    await userEvent.type(within(ventana).getByLabelText('Dosis'), '0,5 ml');
    await elegirOpcion(within(ventana).getByLabelText('Vía'), 'Oral');
    const horas = within(ventana).getByRole('group', { name: 'Horas' });
    await anadirHora(horas, '20:00');
    await anadirHora(horas, '08:00');
    await elegirOpcion(within(ventana).getByLabelText('Cualificación necesaria'), 'Administrar medicación');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Pauta guardada')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/medication-plans')).toEqual([
      expect.objectContaining({
        medication: 'Meloxicam',
        dose: '0,5 ml',
        route: 'oral',
        times: ['08:00', '20:00'],
        qualificationId: 1,
      }),
    ]);
  });

  it('terminar una pauta pide confirmación', async () => {
    const { enviados } = api({
      '/api/admin/medication-plans/1/end': () => ({ body: pauta({ endDate: '2026-11-23' }) }),
    });
    renderRoute('/admin/animals/1/care');
    const doxi = within(await seccion('Medicación')).getByRole('article', { name: /Doxiciclina/ });
    await userEvent.click(within(doxi).getByRole('button', { name: 'Terminar' }));
    const ventana = await screen.findByRole('dialog', { name: '¿Terminar la pauta de Doxiciclina?' });
    await userEvent.click(within(ventana).getByRole('button', { name: 'Terminar' }));
    expect(await screen.findByText('Pauta terminada')).toBeInTheDocument();
    expect(enviados('/api/admin/medication-plans/1/end')).toHaveLength(1);
  });
});

describe('CU-68 Visitas veterinarias', () => {
  it('programa una visita', async () => {
    const { enviados } = api({
      '/api/admin/animals/1/vet-visits': () => ({ status: 201, body: visita({ id: 9 }) }),
    });
    renderRoute('/admin/animals/1/care');
    await userEvent.click(
      within(await seccion('Visitas veterinarias')).getByRole('button', { name: 'Programar visita' }),
    );
    const ventana = await screen.findByRole('dialog', { name: 'Programar visita' });
    const dia = within(ventana).getByLabelText('Día');
    await userEvent.clear(dia);
    await userEvent.type(dia, '2026-12-01');
    await elegirHora(within(ventana).getByLabelText('Hora'), '11:00');
    await userEvent.type(within(ventana).getByLabelText('Motivo'), 'Revisión del ala');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Visita programada')).toBeInTheDocument();
    expect(enviados('/api/admin/animals/1/vet-visits')).toEqual([
      expect.objectContaining({ date: '2026-12-01', time: '11:00', reason: 'Revisión del ala' }),
    ]);
  });

  it('registrar la visita abre el historial veterinario con el motivo y el veterinario ya puestos', async () => {
    const { enviados } = api({
      '/api/admin/vet-visits/2/complete': () => ({ body: visita({ status: 'done', vetRecordId: 30, taskId: null }) }),
    });
    renderRoute('/admin/animals/1/care');
    const fila = (await screen.findByText('Control de la infección respiratoria.')).closest('tr') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: 'Registrar' }));
    const ventana = await screen.findByRole('dialog', { name: 'Registrar la visita' });
    expect(within(ventana).getByLabelText('Descripción')).toHaveValue('Control de la infección respiratoria.');
    expect(within(ventana).getByLabelText('Veterinario (opcional)')).toHaveValue('Dra. Paula Sendra');
    await userEvent.type(within(ventana).getByLabelText('Peso (kg) (opcional)'), '9,4');
    await userEvent.click(within(ventana).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Visita registrada en el historial veterinario')).toBeInTheDocument();
    await waitFor(() =>
      expect(enviados('/api/admin/vet-visits/2/complete')).toEqual([
        expect.objectContaining({ description: 'Control de la infección respiratoria.', weightKg: '9,4' }),
      ]),
    );
  });

  it('cancelar una visita pide confirmación', async () => {
    const { enviados } = api({
      '/api/admin/vet-visits/2/cancel': () => ({ body: visita({ status: 'cancelled', taskId: null }) }),
    });
    renderRoute('/admin/animals/1/care');
    const fila = (await screen.findByText('Control de la infección respiratoria.')).closest('tr') as HTMLElement;
    await userEvent.click(within(fila).getByRole('button', { name: 'Cancelar la visita' }));
    const ventana = await screen.findByRole('dialog', { name: /¿Cancelar la visita del/ });
    await userEvent.click(within(ventana).getByRole('button', { name: 'Cancelar la visita' }));
    expect(await screen.findByText('Visita cancelada')).toBeInTheDocument();
    expect(enviados('/api/admin/vet-visits/2/cancel')).toHaveLength(1);
  });
});
