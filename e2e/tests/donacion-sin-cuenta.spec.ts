import { expect, test } from '../support/test.js';
import { t } from '../support/textos.js';

test.describe('CU-05 Donar sin cuenta', () => {
  test('un visitante sin sesión dona 0,50 € de forma anónima', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: t('nav.donate'), exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/donate$/);

    // Sin cuenta ni email, la página avisa de que no se le podrá avisar de nada.
    await expect(page.getByText(t('donate.noNotices'))).toBeVisible();

    // Importe libre de 0,50 € (sin importe mínimo) y donación anónima.
    await page.getByRole('radio', { name: t('donate.other'), exact: true }).check();
    await page.getByLabel(t('donate.amount'), { exact: true }).fill('0,50');
    await page.getByLabel(t('donate.anonymous'), { exact: true }).check();
    await page.getByRole('button', { name: t('donate.continue'), exact: true }).click();

    const pago = page.getByRole('dialog', { name: t('payment.title') });
    await expect(pago).toBeVisible();
    await expect(pago.getByText(/0,50/)).toBeVisible();
    await pago.getByRole('button', { name: t('payment.succeed'), exact: true }).click();

    // Sin email no se manda recibo: se puede imprimir desde la página.
    await expect(page.getByText(t('donate.thanksNoEmail'))).toBeVisible();
    await expect(page.getByRole('button', { name: t('donate.printReceipt') })).toBeVisible();
  });
});
