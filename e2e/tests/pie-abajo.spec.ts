import { expect, test } from '../support/test.js';
import { t } from '../support/textos.js';

// SCREENS §2.3: el pie queda en la parte inferior de la ventana aunque la
// página tenga poco contenido; si la página es larga, va tras el contenido.
// Se comprueba en un navegador real porque jsdom no calcula posiciones.

test.describe('Pie de la web pública', () => {
  test('en una página corta, el pie llega al borde inferior de la ventana', async ({ page }) => {
    // Ventana alta para que el contenido del 404 sobre (en 720 px no cabe con el pie).
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto('/esta-pagina-no-existe');
    await expect(page.getByRole('heading', { level: 1, name: t('notFound.title') })).toBeVisible();

    const pie = await page.getByRole('contentinfo').boundingBox();
    const alto = page.viewportSize()?.height;
    expect(pie).not.toBeNull();
    expect(alto).toBeDefined();
    expect(Math.round((pie?.y ?? 0) + (pie?.height ?? 0))).toBe(alto);
  });

  test('en una página larga, el pie va después del contenido, fuera de la ventana', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const pie = await page.getByRole('contentinfo').boundingBox();
    const alto = page.viewportSize()?.height ?? 0;
    expect(pie?.y ?? 0).toBeGreaterThan(alto);
  });
});
