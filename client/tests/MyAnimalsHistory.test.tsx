import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { activeAdoption, adoption, historyEvent, historyPage, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const FARO = { id: 12, name: 'Faro', species: 'Alimoche', coverPhoto: null };

const conHistorial = (historial: Parameters<typeof mockApi>[0][string], adopciones = [activeAdoption()]) => ({
  '/api/auth/me': { body: { user: sessionUser() } },
  '/api/me/adoptions': { body: { data: adopciones } },
  '/api/me/history': historial,
});

const seccion = async () =>
  (await screen.findByRole('heading', { level: 2, name: 'Historial' })).closest('section') as HTMLElement;

describe('CU-15 Historial de «Mis animales»', () => {
  it('cuenta lo que ha pasado en cada adopción, del más reciente al más antiguo', async () => {
    mockApi(
      conHistorial({
        body: historyPage([
          historyEvent({
            id: 'cancel-1',
            type: 'cancel_requested',
            date: '2026-11-20',
            amount: null,
            periodStart: null,
          }),
          historyEvent({
            id: 'event-3',
            type: 'plan_change_requested',
            date: '2026-11-12',
            amount: null,
            periodStart: null,
            previousPlanName: 'Usual',
            planName: 'Extraordinaria',
          }),
          historyEvent({
            id: 'event-2',
            type: 'payment_mode_changed',
            date: '2026-11-08',
            amount: null,
            periodStart: null,
            paymentMode: 'manual',
          }),
          historyEvent({ date: '2026-11-05' }),
          historyEvent({
            id: 'payment-2-failed',
            type: 'payment_failed',
            date: '2026-10-05',
            periodStart: '2026-10-05',
          }),
          historyEvent({ id: 'event-1', type: 'paused', date: '2026-10-05', amount: null, periodStart: null }),
          historyEvent({
            id: 'adopted-1',
            type: 'adopted',
            date: '2026-01-09',
            amount: null,
            periodStart: null,
            planName: 'Usual',
          }),
        ]),
      }),
    );
    renderRoute('/my-animals');
    const historial = await seccion();
    expect(
      within(historial).getByText('Lo que ha pasado en tus adopciones durante el último año.'),
    ).toBeInTheDocument();
    const sucesos = await within(historial).findAllByRole('listitem');
    // El importe lleva un espacio sin salto antes del «€».
    expect(sucesos.map((s) => s.textContent?.replace(/\u00a0/g, ' '))).toEqual([
      '20 nov 2026Pediste la baja de la adopción de Rufo.',
      '12 nov 2026Pediste cambiar el plan de Rufo de Usual a Extraordinaria desde la próxima cuota.',
      '8 nov 2026Cambiaste la forma de pago de Rufo a «Manual».',
      '5 nov 2026Cuota de Rufo pagada: 5,00 € (desde el 5 nov 2026).',
      '5 oct 2026No se pudo cobrar la cuota de Rufo: 5,00 € (desde el 5 oct 2026).',
      '5 oct 2026La adopción de Rufo se pausó.',
      '9 ene 2026Empezaste a adoptar a Rufo con el plan Usual.',
    ]);
    // La fecha es una fecha de verdad para los lectores de pantalla.
    expect(within(sucesos[0]!).getByText('20 nov 2026').tagName).toBe('TIME');
    expect(within(sucesos[0]!).getByText('20 nov 2026')).toHaveAttribute('datetime', '2026-11-20');
  });

  it('2c: un cierre por fallecimiento se explica con delicadeza y ofrece otro animal', async () => {
    mockApi(
      conHistorial({
        body: historyPage([
          historyEvent({
            id: 'ended-3',
            type: 'ended',
            date: '2026-10-23',
            animal: { id: 12, name: 'Faro' },
            amount: null,
            periodStart: null,
            endStatus: 'finished',
            endReason: 'animal_deceased',
          }),
        ]),
      }),
    );
    renderRoute('/my-animals');
    const historial = await seccion();
    expect(await within(historial).findByText('Terminó la adopción de Faro. Faro nos ha dejado.')).toBeInTheDocument();
    expect(within(historial).getByRole('link', { name: '¿Quieres continuar con otro animal?' })).toHaveAttribute(
      'href',
      '/animals',
    );
  });

  it('las adopciones cerradas ya no salen como tarjetas: solo en el historial', async () => {
    mockApi(
      conHistorial({ body: historyPage([]) }, [
        activeAdoption(),
        adoption({ id: 3, status: 'finished', animal: FARO, endDate: '2026-10-23', endReason: 'animal_deceased' }),
      ]),
    );
    renderRoute('/my-animals');
    await seccion();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Rufo', 'Historial']);
  });

  it('se carga de 10 en 10 con «Ver más» y avisa de que solo muestra el último año', async () => {
    const { pedidas } = mockApi(
      conHistorial((url: URL) => {
        const pagina = Number(url.searchParams.get('page') ?? '1');
        const datos = Array.from({ length: pagina === 1 ? 10 : 2 }, (_, i) =>
          historyEvent({
            id: `p${pagina}-${i}`,
            date: `2026-0${pagina === 1 ? 9 : 1}-${String(20 - i).padStart(2, '0')}`,
          }),
        );
        return { body: historyPage(datos, { page: pagina, total: 12, totalPages: 2 }) };
      }),
    );
    renderRoute('/my-animals');
    const historial = await seccion();
    await waitFor(() => expect(within(historial).getAllByRole('listitem')).toHaveLength(10));
    expect(pedidas('/api/me/history')[0]!.searchParams.get('pageSize')).toBe('10');
    expect(within(historial).getByText(/Solo se muestra el último año/)).toBeInTheDocument();
    expect(within(historial).getByRole('link', { name: /Mis aportaciones/ })).toHaveAttribute(
      'href',
      '/my-contributions',
    );

    await userEvent.click(within(historial).getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(within(historial).getAllByRole('listitem')).toHaveLength(12));
    expect(pedidas('/api/me/history').at(-1)!.searchParams.get('page')).toBe('2');
    expect(within(historial).queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('con más de un animal, se puede filtrar por animal', async () => {
    const { pedidas } = mockApi(
      conHistorial({ body: historyPage([historyEvent()]) }, [
        activeAdoption(),
        adoption({ id: 3, status: 'finished', animal: FARO, endDate: '2026-10-23', endReason: 'animal_deceased' }),
      ]),
    );
    renderRoute('/my-animals');
    const historial = await seccion();
    await userEvent.click(within(historial).getByRole('combobox', { name: 'Animal' }));
    await userEvent.click(within(historial).getByRole('option', { name: 'Faro' }));
    await waitFor(() => expect(pedidas('/api/me/history').at(-1)!.searchParams.get('animalId')).toBe('12'));
  });

  it('con un solo animal no hay filtro', async () => {
    mockApi(conHistorial({ body: historyPage([historyEvent()]) }));
    renderRoute('/my-animals');
    const historial = await seccion();
    await within(historial).findByText(/Cuota de Rufo pagada/);
    expect(within(historial).queryByRole('combobox', { name: 'Animal' })).not.toBeInTheDocument();
  });

  it('sin sucesos, lo dice; si falla, deja reintentar', async () => {
    mockApi(conHistorial({ body: historyPage([]) }));
    renderRoute('/my-animals');
    expect(await within(await seccion()).findByText('Todavía no hay nada en tu historial.')).toBeInTheDocument();
  });

  it('si no se puede cargar, deja reintentar', async () => {
    mockApi(conHistorial({ status: 500, body: {} }));
    renderRoute('/my-animals');
    const historial = await seccion();
    expect(await within(historial).findByText('No hemos podido cargar el historial')).toBeInTheDocument();
    expect(within(historial).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('tras darse de baja, el historial se vuelve a pedir', async () => {
    const { pedidas } = mockApi({
      ...conHistorial({ body: historyPage([historyEvent()]) }),
      '/api/me/adoptions/1/cancel': { body: activeAdoption({ cancelRequested: true, endDate: '2026-12-04' }) },
    });
    renderRoute('/my-animals');
    await seccion();
    await waitFor(() => expect(pedidas('/api/me/history')).toHaveLength(1));
    const rufo = (await screen.findByRole('heading', { level: 2, name: 'Rufo' })).closest('article') as HTMLElement;
    await userEvent.click(within(rufo).getByRole('button', { name: 'Más acciones de Rufo' }));
    await userEvent.click(within(rufo).getByRole('menuitem', { name: 'Darme de baja' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar la baja' }));
    await waitFor(() => expect(pedidas('/api/me/history').length).toBeGreaterThan(1));
  });

  it('si entre una página y otra llega un suceso nuevo, no repite ninguno', async () => {
    mockApi(
      conHistorial((url: URL) => {
        const pagina = Number(url.searchParams.get('page') ?? '1');
        // La segunda página empieza por el último de la primera: se ha colado uno nuevo delante.
        const ids = pagina === 1 ? ['a', 'b'] : ['b', 'c'];
        return {
          body: historyPage(
            ids.map((id) => historyEvent({ id })),
            { page: pagina, total: 4, totalPages: 2, pageSize: 2 },
          ),
        };
      }),
    );
    renderRoute('/my-animals');
    const historial = await seccion();
    await waitFor(() => expect(within(historial).getAllByRole('listitem')).toHaveLength(2));
    await userEvent.click(within(historial).getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(within(historial).getAllByRole('listitem')).toHaveLength(3));
  });
});
