import type { Locator, Page } from '@playwright/test';
import { expect, rellenarTarjeta, test } from '../support/test.js';
import { t } from '../support/textos.js';

// DESIGN_SYSTEM §8.4: las ventanas emergentes salen centradas. Se comprueba en un
// navegador real porque jsdom no calcula posiciones.

/** La ventana está centrada en la pantalla (con 1 px de margen por el redondeo). */
async function comprobarCentrada(page: Page, ventana: Locator) {
  const caja = await ventana.boundingBox();
  const pantalla = page.viewportSize();
  expect(caja).not.toBeNull();
  expect(pantalla).not.toBeNull();
  if (!caja || !pantalla) return;
  expect(Math.abs(caja.x + caja.width / 2 - pantalla.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(caja.y + caja.height / 2 - pantalla.height / 2)).toBeLessThanOrEqual(1);
}

test.describe('CU-05 Ventana de pago y aviso del pago rechazado', () => {
  test('la ventana de pago sale centrada; si el pago falla, un aviso emergente deja reintentar', async ({ page }) => {
    await page.goto('/donate');
    await page.getByLabel(t('donate.name'), { exact: true }).fill('Iris');
    await page.getByLabel(t('donate.surname'), { exact: true }).fill('Valls Mora');
    await page.getByLabel(t('donate.email'), { exact: true }).fill('iris.valls@correo.test');
    await page.getByLabel(/política de privacidad/).check();
    await page.getByRole('button', { name: t('donate.continue'), exact: true }).click();

    const pago = page.getByRole('dialog', { name: t('payment.title') });
    await expect(pago).toBeVisible();
    await comprobarCentrada(page, pago);

    await rellenarTarjeta(pago);
    await pago.getByRole('button', { name: t('payment.fail'), exact: true }).click();
    const aviso = page.getByRole('dialog', { name: t('payment.failedTitle') });
    await expect(aviso).toBeVisible();
    await expect(aviso.getByText(t('donate.failed'))).toBeVisible();
    await comprobarCentrada(page, aviso);

    await aviso.getByRole('button', { name: t('payment.retry'), exact: true }).click();
    await expect(aviso).toBeHidden();
    await expect(pago).toBeVisible();
    await rellenarTarjeta(pago);
    await pago.getByRole('button', { name: t('payment.succeed'), exact: true }).click();
    await expect(page.getByText(t('donate.thanksEmail'))).toBeVisible();
  });
});
