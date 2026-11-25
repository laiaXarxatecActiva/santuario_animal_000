import type { Locator } from '@playwright/test';
import { expect, iniciarSesion, test } from '../support/test.js';
import { t } from '../support/textos.js';
import { LUCIA, RUFO } from '../support/usuarios.js';

// SCREENS §4.2 y DESIGN_SYSTEM §8.9: se comprueba en un navegador real porque jsdom
// no calcula tamaños ni posiciones.

const caja = async (elemento: Locator) => {
  const c = await elemento.boundingBox();
  if (!c) throw new Error('El elemento no se ve');
  return c;
};

test.describe('CU-15 Tarjeta de «Mis animales»', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await iniciarSesion(page, LUCIA);
    await page.goto('/my-animals');
  });

  test('solo la foto abre la ficha: el hueco en blanco de debajo no es un enlace', async ({ page }) => {
    const tarjeta = page.locator('main article').filter({ hasText: RUFO });
    // El enlace de la foto está oculto a los lectores de pantalla (ya está «Ver la ficha de…»).
    const enlaceFoto = tarjeta.locator('a[aria-hidden="true"]');
    const foto = enlaceFoto.locator('> *').first();
    await expect(foto).toBeVisible();
    const enlace = await caja(enlaceFoto);
    const imagen = await caja(foto);
    expect(Math.round(enlace.height)).toBeLessThanOrEqual(Math.round(imagen.height) + 1);

    // Un clic justo debajo de la foto no cambia de página.
    const fondo = await caja(tarjeta);
    if (fondo.y + fondo.height - (imagen.y + imagen.height) > 20) {
      await page.mouse.click(imagen.x + imagen.width / 2, imagen.y + imagen.height + 10);
      await expect(page).toHaveURL(/\/my-animals$/);
    }
  });

  test('el menú «⋯» no sobresale: sin franjas vacías y con el fondo de las opciones recortado', async ({ page }) => {
    const tarjeta = page.locator('main article').filter({ hasText: RUFO });
    await tarjeta.getByRole('button', { name: t('manageAdoption.moreActions', { name: RUFO }) }).click();
    const menu = tarjeta.getByRole('menu');
    await expect(menu).toBeVisible();
    const opciones = menu.getByRole('menuitem');
    // Se mide cuando termina la animación de apertura (baja 8 px con un fundido).
    await expect(menu).toHaveCSS('opacity', '1');
    const panel = await caja(menu);
    const primera = await caja(opciones.first());
    const ultima = await caja(opciones.last());
    // La primera opción empieza en el borde de arriba y la última acaba en el de abajo (1 px de borde).
    expect(Math.round(primera.y - panel.y)).toBeLessThanOrEqual(1);
    expect(Math.round(panel.y + panel.height - (ultima.y + ultima.height))).toBeLessThanOrEqual(1);
    // El panel recorta el fondo de las opciones con la curva de sus esquinas; las opciones son rectas.
    expect(await menu.evaluate((el) => getComputedStyle(el).overflow)).toBe('hidden');
    expect(await opciones.nth(1).evaluate((el) => getComputedStyle(el).borderRadius)).toBe('0px');
  });
});
