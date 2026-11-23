import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Tarjeta de prueba con buen formato (pasa la comprobación de Luhn y caduca en 2040). */
export const TARJETA = { holder: 'Marta Soler', number: '4242 4242 4242 4242', expiry: '12/40', cvc: '123' };

/** Rellena la tarjeta de la ventana de pago simulado (TECH_SPEC §11.1) que esté abierta. */
export async function rellenarTarjeta(tarjeta: Partial<typeof TARJETA> = {}): Promise<HTMLElement> {
  const datos = { ...TARJETA, ...tarjeta };
  const dialogo = await screen.findByRole('dialog', { name: 'Pago simulado' });
  const campo = (etiqueta: string) => within(dialogo).getByLabelText(etiqueta);
  if (datos.holder) await userEvent.type(campo('Titular de la tarjeta'), datos.holder);
  if (datos.number) await userEvent.type(campo('Número de tarjeta'), datos.number);
  if (datos.expiry) await userEvent.type(campo('Caducidad (MM/AA)'), datos.expiry);
  if (datos.cvc) await userEvent.type(campo('CVC'), datos.cvc);
  return dialogo;
}
