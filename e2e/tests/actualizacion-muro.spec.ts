import { elegirOpcion, expect, iniciarSesion, test } from '../support/test.js';
import { t } from '../support/textos.js';
import { LUCIA, NURIA, RUFO } from '../support/usuarios.js';

test.describe('CU-31, CU-17 Publicar una actualización y verla en el muro', () => {
  test('una cuidadora publica una actualización de Rufo y su adoptante la ve en «Novedades»', async ({ page }) => {
    const titulo = `Rufo estrena posadero (${Date.now()})`;

    // CU-31: Nuria (cuidadora) publica desde el panel.
    await iniciarSesion(page, NURIA);
    await page.goto('/admin/updates/new');
    await elegirOpcion(page.getByLabel(t('admin.updates.animal'), { exact: true }), RUFO);
    await page.getByLabel(t('admin.updates.titleField'), { exact: true }).fill(titulo);
    await page
      .getByLabel(t('admin.updates.body'), { exact: true })
      .fill('Hoy ha probado el posadero nuevo del voladero y no se ha querido bajar en toda la mañana.');
    await page.getByRole('button', { name: t('admin.updates.publish'), exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/updates$/);
    await expect(page.getByText(titulo)).toBeVisible();

    // CU-17: Lucía, que adopta a Rufo, la ve en su muro.
    await page.context().clearCookies();
    await iniciarSesion(page, LUCIA);
    await page
      .getByRole('link', { name: new RegExp(`^${t('nav.feed')}`) })
      .first()
      .click();
    await expect(page).toHaveURL(/\/feed$/);
    // El título también sale en el aviso de la campana (CU-18): se busca el del muro.
    await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  });
});
