import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, adminDonations } from './helpers/fixtures';
import { errorApi, mockApi, renderRoute } from './helpers/render';

const PAGINA = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, totalCollected: '0.00' };

describe('CU-39 A1 Registrar una donación manual', () => {
  it('rellena el formulario, la registra y vuelve al listado', async () => {
    const { enviados } = mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/donations': (_url, peticion) =>
        peticion.method === 'POST' ? { status: 201, body: adminDonations[0] } : { body: PAGINA },
    });
    renderRoute('/admin/donations/new');
    expect(await screen.findByRole('heading', { level: 1, name: 'Registrar donación' })).toBeInTheDocument();
    const fecha = screen.getByLabelText('Fecha');
    expect((fecha as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fecha).toHaveAttribute('max', (fecha as HTMLInputElement).value);
    expect(
      screen.getByText('Sin email no podremos enviarle el agradecimiento ni avisarle si hubiera que devolverla.'),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Importe (€)'), '25,50');
    await userEvent.clear(fecha);
    await userEvent.type(fecha, '2026-11-02');
    await userEvent.selectOptions(screen.getByLabelText('Forma de pago'), 'Transferencia');
    await userEvent.type(screen.getByLabelText('Nombre del donante (opcional)'), 'Ana Ruiz');
    await userEvent.type(screen.getByLabelText('Email del donante (opcional)'), 'ana@correo.test');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Donación anónima' }));
    await userEvent.type(screen.getByLabelText('Mensaje (opcional)'), 'Mercadillo');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar donación' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Donaciones' })).toBeInTheDocument();
    expect(screen.getByText('Donación registrada.')).toBeInTheDocument();
    expect(enviados('/api/admin/donations').filter((b) => b !== undefined)).toEqual([
      {
        amount: '25,50',
        date: '2026-11-02',
        method: 'bank_transfer',
        donorName: 'Ana Ruiz',
        donorEmail: 'ana@correo.test',
        isAnonymous: true,
        message: 'Mercadillo',
      },
    ]);
  });

  it('valida antes de enviar', async () => {
    const { pedidas } = mockApi({ '/api/auth/me': { body: { user: admin() } } });
    renderRoute('/admin/donations/new');
    await userEvent.type(await screen.findByLabelText('Email del donante (opcional)'), 'no-es-email');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar donación' }));
    expect(await screen.findByText('Elige cómo se ha pagado.')).toBeInTheDocument();
    expect(screen.getByLabelText('Importe (€)')).toHaveAccessibleDescription(/importe válido/);
    expect(screen.getByLabelText('Email del donante (opcional)')).toHaveAttribute('aria-invalid', 'true');
    expect(pedidas('/api/admin/donations')).toHaveLength(0);
  });

  it('muestra el error del servidor en el campo de la fecha', async () => {
    mockApi({
      '/api/auth/me': { body: { user: admin() } },
      '/api/admin/donations': () =>
        errorApi(400, 'VALIDATION_ERROR', 'x', [{ field: 'date', message: 'La fecha no puede ser posterior a hoy.' }]),
    });
    renderRoute('/admin/donations/new');
    await userEvent.type(await screen.findByLabelText('Importe (€)'), '5');
    await userEvent.selectOptions(screen.getByLabelText('Forma de pago'), 'Efectivo');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar donación' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Fecha')).toHaveAccessibleDescription(/La fecha no puede ser posterior a hoy\./),
    );
  });
});
