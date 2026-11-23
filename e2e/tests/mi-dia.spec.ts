import { expect, iniciarSesion, test } from '../support/test.js';
import { t } from '../support/textos.js';
import { MARTA, NURIA } from '../support/usuarios.js';

// Tarea de hoy de TEST_DATA.sql (plantilla 8) que se deja pendiente y exige
// «Manejo de grandes rapaces», que Nuria tiene.
const REVISION = 'Revisión de los animales en tratamiento';

test.describe('CU-56, CU-57, CU-55 Mi día', () => {
  test('la cuidadora entra a «Mi día», completa una tarea con una nota y el administrador lo ve', async ({ page }) => {
    const nota = `Olmo apoya bien la pata (${Date.now()})`;

    // CU-56: al entrar, la cuidadora va directamente a «Mi día».
    await iniciarSesion(page, NURIA);
    await expect(page).toHaveURL(/\/admin\/my-day$/);
    await expect(page.getByRole('heading', { level: 1, name: t('work.myDay.title') })).toBeVisible();

    // CU-57: la marca como hecha con observaciones.
    const tarjeta = page.getByRole('article', { name: REVISION });
    await tarjeta.getByRole('button', { name: t('work.myDay.withNote'), exact: true }).click();
    const ventana = page.getByRole('dialog', { name: REVISION });
    await ventana.getByLabel(t('form.optional', { label: t('work.myDay.observations') }), { exact: true }).fill(nota);
    await ventana.getByRole('button', { name: t('work.myDay.completeSubmit'), exact: true }).click();
    await expect(page.getByText(t('work.myDay.markedDone'))).toBeVisible();
    await expect(tarjeta.getByText(t('work.status.completed'), { exact: true })).toBeVisible();
    await expect(tarjeta.getByText(nota)).toBeVisible();

    // CU-55: el administrador la ve resuelta, con quién la hizo y la nota.
    await page.context().clearCookies();
    await iniciarSesion(page, MARTA);
    await page.goto('/admin/tasks');
    const fila = page.getByRole('row').filter({ hasText: REVISION });
    await expect(fila.getByText(nota)).toBeVisible();
    await expect(fila.getByText(/Nuria Peris/)).toBeVisible();
  });
});
