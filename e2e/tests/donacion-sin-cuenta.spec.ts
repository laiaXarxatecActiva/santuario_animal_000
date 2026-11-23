import { enlaceDelCorreo, esperarCorreo } from '../support/mailpit.js';
import { expect, rellenarTarjeta, test } from '../support/test.js';
import { t } from '../support/textos.js';

test.describe('CU-05 Donar sin cuenta', () => {
  test('un visitante sin sesión dona 0,50 € de forma anónima', async ({ page }) => {
    // Un email distinto en cada ejecución, para no confundir correos de otras.
    const email = `donante-${Date.now()}@correo.test`;
    await page.goto('/');
    await page
      .getByRole('link', { name: t('nav.donate'), exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/donate$/);

    // Importe libre de 0,50 € (sin importe mínimo) y donación anónima. El email es
    // obligatorio: con él se avisa de la operación aunque sea anónima.
    await page.getByRole('radio', { name: t('donate.other'), exact: true }).check();
    await page.getByLabel(t('donate.amount'), { exact: true }).fill('0,50');
    await page.getByLabel(t('donate.name'), { exact: true }).fill('Iris');
    await page.getByLabel(t('donate.surname'), { exact: true }).fill('Valls Mora');
    await page.getByLabel(t('donate.email'), { exact: true }).fill(email);
    await page.getByLabel(t('donate.anonymous'), { exact: true }).check();
    await page.getByLabel(/política de privacidad/).check();
    await page.getByRole('button', { name: t('donate.continue'), exact: true }).click();

    const pago = page.getByRole('dialog', { name: t('payment.title') });
    await expect(pago).toBeVisible();
    await expect(pago.getByText(/0,50/)).toBeVisible();
    await rellenarTarjeta(pago);
    await pago.getByRole('button', { name: t('payment.succeed'), exact: true }).click();

    // El recibo llega por email y también se puede ver o descargar en PDF.
    await expect(page.getByText(t('donate.thanksEmail'))).toBeVisible();
    const ver = page.getByRole('link', { name: t('donate.viewReceipt') });
    await expect(page.getByRole('link', { name: t('donate.downloadReceipt') })).toBeVisible();
    const pdf = await page.request.get((await ver.getAttribute('href')) ?? '');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');

    const correo = await esperarCorreo(email);
    expect(enlaceDelCorreo(correo, '/receipt.pdf')).toContain('token=');
  });
});
