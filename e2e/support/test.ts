import { expect, test as base, type Page } from '@playwright/test';
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
