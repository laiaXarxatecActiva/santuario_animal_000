import type { Locator } from '@playwright/test';
import { expect, test } from '../support/test.js';
import { t } from '../support/textos.js';

// DESIGN_SYSTEM §8.7: en el menú de hamburguesa (por debajo de 1024 px), los
// apartados no van pegados al borde: se alinean con el logotipo y el contenido.
// Se comprueba en un navegador real porque jsdom no calcula posiciones.

const izquierda = async (elemento: Locator) => Math.round((await elemento.boundingBox())?.x ?? -1);

test.describe('Menú de hamburguesa de la web pública', () => {
  // Un ancho por cada margen de `.container`: 16, 24 y 32 px.
  for (const ancho of [375, 640, 800]) {
    test(`a ${ancho} px, los apartados se alinean con el logotipo`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto('/');
      const cabecera = page.getByRole('banner');
      const boton = cabecera.getByRole('button', { name: t('nav.openMenu'), exact: true });
      // El id lo genera React (useId) y puede llevar «:», así que se busca por atributo.
      const menu = page.locator(`[id="${await boton.getAttribute('aria-controls')}"]`);
      await boton.click();
      await expect(menu).toBeVisible();

      const logo = await izquierda(cabecera.getByRole('link').first());
      expect(logo).toBeGreaterThan(0);
      for (const clave of ['nav.animals', 'nav.howItWorks', 'nav.donate']) {
        expect(await izquierda(menu.getByRole('link', { name: t(clave), exact: true })), clave).toBe(logo);
      }
      // Los botones de «Entrar» y «Registrarse» llevan el mismo margen.
      expect(await izquierda(menu.getByRole('link', { name: t('nav.login'), exact: true }))).toBe(logo);
    });
  }
});
