import { expect, test as base, type Locator, type Page } from '@playwright/test';
import { t } from './textos.js';

// `test` de Playwright con el aviso de cookies ya aceptado, para que no tape
// botones de la parte inferior (es solo informativo y no bloquea nada).
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('cookie-notice', 'accepted');
      } catch {
        // Sin localStorage el aviso sale, pero no impide usar la página.
      }
    });
    await use(page);
  },
});

export { expect };

/** Rellena y envía el formulario de `/login` (la página ya tiene que estar abierta). */
export async function rellenarLogin(page: Page, credenciales: { email: string; password: string }): Promise<void> {
  await page.getByLabel(t('auth.email'), { exact: true }).fill(credenciales.email);
  await page.getByLabel(t('auth.password'), { exact: true }).fill(credenciales.password);
  await page.getByRole('button', { name: t('auth.login.submit'), exact: true }).click();
}

/** Abre `/login` e inicia sesión. Espera a salir de la página de login. */
export async function iniciarSesion(page: Page, credenciales: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await rellenarLogin(page, credenciales);
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Rellena la tarjeta de la ventana de pago simulado (TECH_SPEC §11.1) con la
 * tarjeta de prueba: solo se comprueba el formato y nunca sale del navegador.
 */
export async function rellenarTarjeta(pago: Locator): Promise<void> {
  await pago.getByLabel(t('payment.cardHolder'), { exact: true }).fill('Persona de Prueba');
  await pago.getByLabel(t('payment.cardNumber'), { exact: true }).fill('4242 4242 4242 4242');
  await pago.getByLabel(t('payment.cardExpiry'), { exact: true }).fill('12/40');
  await pago.getByLabel(t('payment.cardCvc'), { exact: true }).fill('123');
}

/**
 * Elige una opción de un desplegable de la web (`SelectField` o `FilterSelect`,
 * DESIGN_SYSTEM §8.5): no es un `<select>` del navegador, así que se abre la
 * lista pulsando el campo y se pulsa la opción por su texto.
 */
export async function elegirOpcion(campo: Locator, opcion: string) {
  // Antes de abrirla: abierta, la etiqueta nombra también la lista.
  const lista = campo.page().locator(`[id="${await campo.getAttribute('aria-controls')}"]`);
  await campo.click();
  await lista.getByRole('option', { name: opcion, exact: true }).click();
}
