import { correosPara, esperarCorreo } from '../support/mailpit.js';
import { elegirOpcion, expect, iniciarSesion, test } from '../support/test.js';
import { t } from '../support/textos.js';
import { ELENA, GRETA, NURIA, PABLO } from '../support/usuarios.js';

test.describe('CU-31 Los avisos por email llegan a Mailpit según las preferencias', () => {
  test('al publicar una actualización de Greta, Pablo (por actualización) recibe el email y Elena (resumen mensual) no', async ({
    page,
  }) => {
    const titulo = `Greta toma el sol (${Date.now()})`;

    await iniciarSesion(page, NURIA);
    await page.goto('/admin/updates/new');
    await elegirOpcion(page.getByLabel(t('admin.updates.animal'), { exact: true }), GRETA);
    await page.getByLabel(t('admin.updates.titleField'), { exact: true }).fill(titulo);
    await page
      .getByLabel(t('admin.updates.body'), { exact: true })
      .fill('Ha pasado la mañana con las alas abiertas en la roca más alta del voladero.');
    await page.getByRole('button', { name: t('admin.updates.publish'), exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/updates$/);

    // Pablo lo quiere por cada actualización: el email llega a Mailpit con el título.
    const correo = await esperarCorreo(PABLO.email, { contiene: titulo });
    expect(correo.Subject).toContain(GRETA);

    // Elena solo quiere el resumen mensual: no recibe nada de esta actualización.
    // Los avisos se envían en la misma petición, así que el suyo ya habría llegado.
    const deElena = await correosPara(ELENA.email);
    expect(deElena.filter((m) => m.Text.includes(titulo))).toEqual([]);
  });
});
