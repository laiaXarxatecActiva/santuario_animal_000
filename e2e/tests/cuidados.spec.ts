import { elegirOpcion, expect, iniciarSesion, test } from '../support/test.js';
import { t } from '../support/textos.js';
import { MARTA, NURIA } from '../support/usuarios.js';

// En TEST_DATA.sql, Carbón (clínica) comió hoy a las 09:00 «Menos de la mitad»,
// y la comida de las 17:00 de la clínica está pendiente.
const COMIDA = 'Comida de la clínica';

test.describe('CU-66, CU-67 Lo que come cada animal', () => {
  test('la cuidadora anota que Carbón no ha comido y la administradora recibe el aviso', async ({ page }) => {
    // CU-66: «Hecha» en la comida pregunta lo que ha comido cada animal.
    await iniciarSesion(page, NURIA);
    await expect(page).toHaveURL(/\/admin\/my-day$/);
    const tarjeta = page
      .getByRole('article', { name: COMIDA })
      .filter({ has: page.getByRole('button', { name: t('work.myDay.done'), exact: true }) });
    await tarjeta.getByRole('button', { name: t('work.myDay.done'), exact: true }).click();
    const ventana = page.getByRole('dialog', { name: COMIDA });
    await expect(ventana.getByLabel('Olmo', { exact: true })).toHaveText(t('work.care.intakes.all'));
    await elegirOpcion(ventana.getByLabel('Carbón', { exact: true }), t('work.care.intakes.none'));
    await ventana.getByRole('button', { name: t('work.myDay.completeSubmit'), exact: true }).click();
    await expect(page.getByText(t('work.myDay.markedDone'))).toBeVisible();

    // CU-67: dos tomas seguidas comiendo poco → aviso a la administradora.
    await page.context().clearCookies();
    await iniciarSesion(page, MARTA);
    await page.goto('/notifications');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Carbón ha comido poco en sus 2 últimas tomas.' }),
    ).toBeVisible();

    // En su pestaña «Cuidados» se ve la comida anotada y el aviso.
    await page.goto('/admin/animals/10/care');
    await expect(page.getByText(t('work.care.lowIntakeWarning_other', { count: '2' }), { exact: true })).toBeVisible();
    const comidas = page.getByRole('region', { name: t('work.care.feedings.title') });
    await expect(comidas.getByText(t('work.care.intakes.none'), { exact: true })).toBeVisible();
  });
});
