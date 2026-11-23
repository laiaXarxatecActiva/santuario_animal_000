import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentModal } from '../src/components/PaymentModal';
import { rellenarTarjeta } from './helpers/tarjeta';

function abrir(onPay = vi.fn()) {
  render(<PaymentModal open concept="Donación" amount="20.00" processing={false} onPay={onPay} onClose={() => {}} />);
  return { onPay, dialogo: screen.getByRole('dialog', { name: 'Pago simulado' }) };
}

describe('CU-05, CU-13, CU-14 Ventana de pago simulado con tarjeta', () => {
  it('pide la tarjeta y avisa de que es una simulación', () => {
    const { dialogo } = abrir();
    for (const etiqueta of ['Titular de la tarjeta', 'Número de tarjeta', 'Caducidad (MM/AA)', 'CVC']) {
      expect(within(dialogo).getByLabelText(etiqueta)).toBeInTheDocument();
    }
    expect(within(dialogo).getByText('Pago simulado: no se realizará ningún cargo real.')).toBeInTheDocument();
    expect(
      within(dialogo).getByText(
        'No escribas los datos de una tarjeta real. Se comprueba solo su formato y no se envían ni se guardan.',
      ),
    ).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Número de tarjeta')).toHaveAttribute('autocomplete', 'off');
  });

  it('sin la tarjeta o con datos mal formados no paga y señala cada campo', async () => {
    const { onPay, dialogo } = abrir();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago correcto' }));
    expect(await within(dialogo).findByText('Escribe el nombre del titular.')).toBeInTheDocument();
    expect(within(dialogo).getByText('El número de tarjeta no es válido.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Escribe la caducidad como MM/AA.')).toBeInTheDocument();
    expect(within(dialogo).getByText('El CVC tiene 3 o 4 dígitos.')).toBeInTheDocument();
    expect(onPay).not.toHaveBeenCalled();

    await rellenarTarjeta({ number: '4242 4242 4242 4241', expiry: '01/20' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago fallido' }));
    expect(await within(dialogo).findByText('La tarjeta está caducada.')).toBeInTheDocument();
    expect(within(dialogo).getByText('El número de tarjeta no es válido.')).toBeInTheDocument();
    expect(onPay).not.toHaveBeenCalled();
  });

  it('con la tarjeta bien escrita, paga con el resultado elegido y sin pasar los datos de la tarjeta', async () => {
    const { onPay, dialogo } = abrir();
    await rellenarTarjeta();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago fallido' }));
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(onPay.mock.calls[0]).toEqual(['failure']);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Simular pago correcto' }));
    expect(onPay.mock.calls[1]).toEqual(['success']);
  });
});
