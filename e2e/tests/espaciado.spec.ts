import type { Locator, Page } from '@playwright/test';
import { expect, iniciarSesion, test } from '../support/test.js';
import { t } from '../support/textos.js';
import { LUCIA, MARTA } from '../support/usuarios.js';

// DESIGN_SYSTEM §7 y §8: los elementos tienen aire entre sí y nada se sale de la
// pantalla en móvil. Se comprueba en un navegador real porque jsdom no calcula posiciones.

/** La página no se puede desplazar hacia los lados. */
async function sinDesplazamientoLateral(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState('networkidle');
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: document.documentElement.clientWidth,
  }));
  expect(ancho, `${ruta}: ancho de la página`).toBeLessThanOrEqual(visible);
}

const caja = async (elemento: Locator) => {
  const c = await elemento.boundingBox();
  if (!c) throw new Error('El elemento no se ve');
  return c;
};

/** Separación vertical entre elementos consecutivos (del final de uno al principio del siguiente). */
async function huecosVerticales(elementos: Locator) {
  const cajas = await Promise.all((await elementos.all()).map(caja));
  return cajas.slice(1).map((c, i) => Math.round(c.y - (cajas[i]!.y + cajas[i]!.height)));
}

test.describe('Separación entre elementos y diseño adaptable', () => {
  for (const ancho of [360, 390]) {
    test(`a ${ancho} px, ni la web pública ni el área del adoptante se salen de la pantalla`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      for (const ruta of ['/', '/animals', '/donate']) await sinDesplazamientoLateral(page, ruta);
      await iniciarSesion(page, LUCIA);
      for (const ruta of ['/my-animals', '/profile', '/feed']) await sinDesplazamientoLateral(page, ruta);
    });

    test(`a ${ancho} px, el panel no se sale de la pantalla`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await iniciarSesion(page, MARTA);
      for (const ruta of ['/admin', '/admin/adoptions', '/admin/adoptions/1', '/admin/users/7', '/admin/payments']) {
        await sinDesplazamientoLateral(page, ruta);
      }
    });
  }

  test('en móvil, los datos de la ficha del panel van separados entre sí', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await iniciarSesion(page, MARTA);
    await page.goto('/admin/adoptions/1');
    const datos = page.locator('main dl').first();
    await expect(datos).toBeVisible();
    // Etiqueta pegada a su valor; entre un dato y el siguiente, al menos 16 px.
    const valores = datos.locator('dd');
    const etiquetas = datos.locator('dt');
    const n = await etiquetas.count();
    for (let i = 0; i < n - 1; i++) {
      const valor = await caja(valores.nth(i));
      const siguiente = await caja(etiquetas.nth(i + 1));
      expect(Math.round(siguiente.y - (valor.y + valor.height)), `tras el dato ${i + 1}`).toBeGreaterThanOrEqual(16);
      const etiqueta = await caja(etiquetas.nth(i));
      expect(Math.round(valor.y - (etiqueta.y + etiqueta.height))).toBeLessThanOrEqual(8);
    }
  });

  test('en escritorio, los botones del título de la ficha no van pegados', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await iniciarSesion(page, MARTA);
    await page.goto('/admin/adoptions/1');
    const registrar = await caja(page.getByRole('button', { name: t('admin.payments.register'), exact: true }));
    const pausar = await caja(page.getByRole('button', { name: t('admin.adoptions.pause'), exact: true }));
    expect(Math.round(pausar.x - (registrar.x + registrar.width))).toBeGreaterThanOrEqual(12);
  });

  for (const [ancho, minimo] of [
    [390, 16],
    [1280, 24],
  ] as const) {
    test(`a ${ancho} px, las tarjetas de «Mis animales» tienen al menos ${minimo} px entre sí`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await iniciarSesion(page, LUCIA);
      await page.goto('/my-animals');
      const tarjetas = page.locator('main article');
      await expect(tarjetas.first()).toBeVisible();
      for (const hueco of await huecosVerticales(tarjetas)) expect(hueco).toBeGreaterThanOrEqual(minimo);
    });
  }
});
