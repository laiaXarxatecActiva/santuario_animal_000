import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Elige una opción de un desplegable (`SelectField` o `FilterSelect`, DESIGN_SYSTEM
 * §8.5): abre la lista pulsando el campo y pulsa la opción por su texto o, si no
 * hay ninguna con ese texto, por su valor (como `userEvent.selectOptions`).
 */
export async function elegirOpcion(campo: HTMLElement, opcion: string) {
  await userEvent.click(campo);
  const lista = document.getElementById(campo.getAttribute('aria-controls') ?? '');
  if (!lista) throw new Error('El desplegable no tiene lista');
  const opciones = Array.from(lista.querySelectorAll<HTMLElement>('[role="option"]'));
  const elegida =
    opciones.find((o) => o.textContent?.trim() === opcion) ?? opciones.find((o) => o.dataset.value === opcion);
  if (!elegida) {
    throw new Error(`No hay la opción «${opcion}»: ${opciones.map((o) => o.textContent).join(', ')}`);
  }
  await userEvent.click(elegida);
}

/** La lista abierta de un desplegable, si la hay. */
export const listaAbierta = () => screen.queryByRole('listbox');

/** Textos de las opciones de un desplegable, aunque su lista esté cerrada. */
export function opcionesDe(campo: HTMLElement): string[] {
  const lista = document.getElementById(campo.getAttribute('aria-controls') ?? '');
  return Array.from(lista?.querySelectorAll('[role="option"]') ?? [], (o) => o.textContent ?? '');
}

/**
 * Escribe una hora en un campo de hora nativo (`<input type="time">`): el de un
 * `TimeField` (se pasa el campo) o el de «Nueva hora» de un `TimesField` (se pasa su grupo).
 */
export async function elegirHora(campo: HTMLElement, hora: string) {
  const entrada =
    campo instanceof HTMLInputElement ? campo : campo.querySelector<HTMLInputElement>('input[type="time"]');
  if (!entrada) throw new Error('No hay ningún campo de hora');
  await userEvent.clear(entrada);
  await userEvent.type(entrada, hora);
}

/** Añade una hora a un `TimesField`. */
export async function anadirHora(grupo: HTMLElement, hora: string) {
  await elegirHora(grupo, hora);
  await userEvent.click(within(grupo).getByRole('button', { name: 'Añadir hora' }));
}
