import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminAdoptionDetail, adminAnimal, adminPlans, adminUsers } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

const animales = {
  data: [adminAnimal({ id: 1, name: 'Rufo' }), adminAnimal({ id: 5, name: 'Brisa' })],
  meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
};
const adoptantes = {
  data: [adminUsers[0]],
  meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
};

function api(
  alta: () => { status?: number; body?: unknown } = () => ({ status: 201, body: adminAdoptionDetail({ id: 30 }) }),
) {
  return mockApi({
    '/api/auth/me': { body: { user: admin() } },
    '/api/admin/animals': { body: animales },
    '/api/admin/plans': { body: { data: adminPlans } },
    '/api/admin/users': { body: adoptantes },
    '/api/admin/adoptions': alta,
    '/api/admin/adoptions/30': { body: adminAdoptionDetail({ id: 30 }) },
  });
}

async function elegirAdoptante() {
  await userEvent.type(await screen.findByLabelText('Buscar adoptante por nombre o email'), 'lucia');
  await userEvent.click(screen.getByRole('button', { name: 'Buscar adoptante' }));
  const opciones = await screen.findByRole('group', { name: 'Adoptante' });
  await userEvent.click(within(opciones).getByRole('radio', { name: /Lucía Martínez Navarro/ }));
}

async function rellenarResto() {
  await userEvent.selectOptions(await screen.findByLabelText('Animal'), 'Brisa');
  await userEvent.selectOptions(screen.getByLabelText('Plan'), '2');
  await userEvent.selectOptions(screen.getByLabelText('Forma del primer pago'), 'Efectivo');
}

describe('CU-37 Gestionar adopciones: alta manual', () => {
  it('2-3: busca el adoptante, elige animal, plan y pago, y lleva a la ficha', async () => {
    const { enviados, pedidas } = api();
    const { router } = renderRoute('/admin/adoptions/new');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nueva adopción' })).toBeInTheDocument();
    await elegirAdoptante();
    const busqueda = pedidas('/api/admin/users').at(-1);
    expect(busqueda?.searchParams.get('role')).toBe('adopter');
    expect(busqueda?.searchParams.get('status')).toBe('active');
    expect(busqueda?.searchParams.get('q')).toBe('lucia');
    await rellenarResto();
    await userEvent.type(screen.getByLabelText('Notas internas (opcional)'), 'Puertas abiertas.');
    await userEvent.click(screen.getByRole('button', { name: 'Crear adopción' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/adoptions/30'));
    expect(await screen.findByText('Adopción creada. Hemos avisado al adoptante.')).toBeInTheDocument();
    expect(enviados('/api/admin/adoptions')).toEqual([
      { userId: 6, animalId: 5, planId: 2, method: 'cash', notes: 'Puertas abiertas.' },
    ]);
  });

  it('solo ofrece animales que admiten adopciones y planes activos', async () => {
    const { pedidas } = api();
    renderRoute('/admin/adoptions/new');
    await screen.findByLabelText('Animal');
    const peticion = pedidas('/api/admin/animals').at(-1);
    expect(peticion?.searchParams.get('adoptable')).toBe('true');
    expect(peticion?.searchParams.get('published')).toBe('true');
    // «Extraordinaria» está desactivado en los datos de ejemplo.
    expect(await screen.findByRole('option', { name: /^Usual \(5,00\s€\/mes\)$/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Extraordinaria/ })).not.toBeInTheDocument();
  });

  it('valida antes de enviar', async () => {
    const { pedidas } = api();
    renderRoute('/admin/adoptions/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Crear adopción' }));
    expect(await screen.findByText('Elige el adoptante.')).toBeInTheDocument();
    expect(screen.getByText('Elige el animal.')).toBeInTheDocument();
    expect(screen.getByText('Elige cómo se ha pagado.')).toBeInTheDocument();
    expect(pedidas('/api/admin/adoptions')).toHaveLength(0);
  });

  it('2a: el error del servidor se muestra', async () => {
    api(() => errorApi(409, 'ADOPTION_ALREADY_OPEN', 'Ya tienes una adopción en curso de Brisa.'));
    renderRoute('/admin/adoptions/new');
    await elegirAdoptante();
    await rellenarResto();
    await userEvent.click(screen.getByRole('button', { name: 'Crear adopción' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta persona ya tiene una adopción en curso de este animal.',
    );
  });
});
