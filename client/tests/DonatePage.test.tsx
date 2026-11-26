import type { DonationResultDto } from '@sanctuary/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { caretaker, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute, type Peticion } from './helpers/render';
import { rellenarTarjeta } from './helpers/tarjeta';

const resultado = (cambios: Partial<DonationResultDto> = {}): DonationResultDto => ({
  id: 50,
  status: 'completed',
  amount: '20.00',
  method: 'card',
  reference: 'CARD-20261117-ABCDEF',
  paidAt: '2026-11-17T10:00:00.000Z',
  failureReason: null,
  donorName: 'Marta',
  donorSurname: 'Soler',
  donorEmail: 'marta@correo.test',
  isAnonymous: false,
  receiptToken: 'firma-del-recibo',
  ...cambios,
});

/** Responde a POST /api/donations con lo que pida el pago simulado. */
const donaciones = (_url: URL, peticion: Peticion) => {
  const cuerpo = peticion.body as { amount: string; simulatedOutcome: string };
  return {
    status: 201,
    body:
      cuerpo.simulatedOutcome === 'failure'
        ? resultado({ status: 'failed', paidAt: null, failureReason: 'Rechazado', amount: cuerpo.amount })
        : resultado({ amount: cuerpo.amount }),
  };
};

/** Rellena los datos obligatorios del donante (CU-05 paso 2). */
async function rellenarDonante() {
  await userEvent.type(await screen.findByLabelText('Nombre'), 'Marta');
  await userEvent.type(screen.getByLabelText('Apellidos'), 'Soler');
  await userEvent.type(screen.getByLabelText('Email'), 'marta@correo.test');
  await userEvent.click(screen.getByLabelText(/acepto la política de privacidad/));
}

describe('CU-05 Hacer una donación', () => {
  it('1-7: elige un importe, paga en la ventana simulada y ve el agradecimiento con el recibo', async () => {
    const { enviados } = mockApi({ '/api/donations': donaciones });
    renderRoute('/donate');
    expect(await screen.findByRole('heading', { level: 1, name: 'Donar' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '20 €' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: '50 €' }));
    expect(screen.getByLabelText('Importe (€)')).toHaveValue('50');
    await rellenarDonante();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Pago con tarjeta' });
    expect(within(dialogo).getByText('Donación')).toBeInTheDocument();
    expect(within(dialogo).getByText('50,00 €')).toBeInTheDocument();
    await rellenarTarjeta();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago correcto' }));

    expect(
      await screen.findByText('¡Gracias por tu donación! Te hemos enviado el recibo por email.'),
    ).toBeInTheDocument();
    expect(enviados('/api/donations')).toEqual([
      {
        amount: '50.00',
        donorName: 'Marta',
        donorSurname: 'Soler',
        donorEmail: 'marta@correo.test',
        donorPhone: null,
        isAnonymous: false,
        acceptPrivacy: true,
        taxCertificate: false,
        simulatedOutcome: 'success',
      },
    ]);
    expect(screen.getByText('CARD-20261117-ABCDEF')).toBeInTheDocument();
    // El recibo se ve o se descarga en PDF, en lugar de imprimir la página.
    const pdf = '/api/donations/50/receipt.pdf?token=firma-del-recibo&lang=es';
    expect(screen.getByRole('link', { name: 'Ver recibo' })).toHaveAttribute('href', pdf);
    expect(screen.getByRole('link', { name: 'Ver recibo' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Descargar recibo' })).toHaveAttribute('href', `${pdf}&download=1`);
    expect(screen.queryByRole('button', { name: 'Imprimir recibo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('«Otra»: importe libre sin mínimo; 3a: un importe no válido da error en el campo', async () => {
    const { pedidas } = mockApi({ '/api/donations': donaciones });
    renderRoute('/donate');
    await rellenarDonante();
    const importe = await screen.findByLabelText('Importe (€)');
    await userEvent.clear(importe);
    await userEvent.type(importe, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    expect(await screen.findByText('El importe debe ser mayor que 0.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Otra' })).toBeChecked();
    await userEvent.clear(importe);
    await userEvent.type(importe, '0,50');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    expect(within(await screen.findByRole('dialog')).getByText('0,50 €')).toBeInTheDocument();
    expect(pedidas('/api/donations')).toEqual([]);
  });

  it('3b: sin nombre, apellidos, email o la aceptación de la privacidad no se puede continuar', async () => {
    const { pedidas } = mockApi({ '/api/donations': donaciones });
    renderRoute('/donate');
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar con el pago' }));
    expect(await screen.findByText('Escribe tu nombre.')).toBeInTheDocument();
    expect(screen.getByText('Escribe tus apellidos.')).toBeInTheDocument();
    expect(screen.getByText('Introduce un email válido.')).toBeInTheDocument();
    expect(screen.getByText('Debes aceptar la política de privacidad.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pedidas('/api/donations')).toEqual([]);
  });

  it('el certificado para desgravar pide el NIF y la dirección solo si se marca', async () => {
    const { enviados } = mockApi({ '/api/donations': donaciones });
    renderRoute('/donate');
    await rellenarDonante();
    expect(screen.queryByLabelText('NIF o NIE')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Quiero el certificado para desgravar'));
    expect(screen.getByLabelText('País')).toHaveValue('España');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    expect(await screen.findByText('Escribe tu NIF.')).toBeInTheDocument();
    expect(screen.getByText('Escribe tu dirección.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('NIF o NIE'), '12345678Z');
    await userEvent.type(screen.getByLabelText('Dirección'), 'Calle Mayor 1');
    await userEvent.type(screen.getByLabelText('Código postal'), '46001');
    await userEvent.type(screen.getByLabelText('Provincia'), 'Valencia');
    await userEvent.type(screen.getByLabelText('Teléfono (opcional)'), '612345678');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    await rellenarTarjeta();
    await userEvent.click(screen.getByRole('button', { name: 'Simular pago correcto' }));
    expect(await screen.findByText(/¡Gracias por tu donación!/)).toBeInTheDocument();
    expect(enviados('/api/donations')[0]).toMatchObject({
      donorPhone: '612345678',
      taxCertificate: true,
      donorTaxId: '12345678Z',
      donorAddress: 'Calle Mayor 1',
      donorPostalCode: '46001',
      donorProvince: 'Valencia',
      donorCountry: 'España',
    });
  });

  it('5a: si el pago falla, lo avisa en una ventana; al cerrarla, el formulario conserva los datos', async () => {
    const { enviados } = mockApi({ '/api/donations': donaciones });
    renderRoute('/donate');
    await rellenarDonante();
    await userEvent.type(await screen.findByLabelText('Mensaje (opcional)'), 'Para la comida');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    await rellenarTarjeta();
    await userEvent.click(await screen.findByRole('button', { name: 'Simular pago fallido' }));
    const aviso = await screen.findByRole('dialog', { name: 'Pago rechazado' });
    expect(within(aviso).getByRole('alert')).toHaveTextContent(
      'El pago no se ha completado. Puedes intentarlo de nuevo.',
    );
    await userEvent.click(within(aviso).getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje (opcional)')).toHaveValue('Para la comida');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    await rellenarTarjeta();
    await userEvent.click(await screen.findByRole('button', { name: 'Simular pago correcto' }));
    expect(await screen.findByText(/¡Gracias por tu donación!/)).toBeInTheDocument();
    expect(enviados('/api/donations').map((b: { simulatedOutcome: string }) => b.simulatedOutcome)).toEqual([
      'failure',
      'success',
    ]);
  });

  it('5a: «Volver a intentarlo» abre otra vez el pago con la misma donación', async () => {
    const { enviados } = mockApi({ '/api/donations': donaciones });
    renderRoute('/donate');
    await rellenarDonante();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con el pago' }));
    await rellenarTarjeta();
    await userEvent.click(await screen.findByRole('button', { name: 'Simular pago fallido' }));
    const aviso = await screen.findByRole('dialog', { name: 'Pago rechazado' });
    await userEvent.click(within(aviso).getByRole('button', { name: 'Volver a intentarlo' }));
    const pago = await rellenarTarjeta();
    expect(within(pago).getByText('20,00 €')).toBeInTheDocument();
    await userEvent.click(within(pago).getByRole('button', { name: 'Simular pago correcto' }));
    expect(await screen.findByText(/¡Gracias por tu donación!/)).toBeInTheDocument();
    expect(enviados('/api/donations').map((b: { amount: string }) => b.amount)).toEqual(['20.00', '20.00']);
  });

  it('2: con sesión de adoptante, el nombre, los apellidos y el email vienen rellenos', async () => {
    mockApi({ '/api/auth/me': { body: { user: sessionUser() } } });
    renderRoute('/donate');
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('lucia.martinez@correo.test'));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Lucía');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Martínez Navarro');
  });

  it('6a: un trabajador puede donar, pero sin datos de su cuenta', async () => {
    mockApi({ '/api/auth/me': { body: { user: caretaker() } } });
    renderRoute('/donate');
    expect(await screen.findByRole('heading', { level: 1, name: 'Donar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });
});
