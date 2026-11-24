import { esperarCorreo } from '../support/mailpit.js';
import { expect, iniciarSesion, test } from '../support/test.js';
import { t } from '../support/textos.js';
import { MARTA, NURIA } from '../support/usuarios.js';

// En TEST_DATA.sql, Nuria tiene hoy turno de mañana en la clínica y en el voladero
// de alimoches, y Carmen dejó anoche una nota de relevo en la clínica.
const CLINICA = 'Clínica y recuperación';

test.describe('CU-70, CU-71, CU-72, CU-73 Incidencias, relevo y panel «Hoy»', () => {
  test('la cuidadora lee el relevo y comunica una incidencia grave; la administradora la recibe y la resuelve', async ({
    page,
  }) => {
    // Descripción única para no confundirla con correos de otras ejecuciones.
    const descripcion = `La puerta de la cuarentena no cierra (${Date.now()}).`;

    // CU-71: la nota de Carmen aparece como nueva y se marca como leída.
    await iniciarSesion(page, NURIA);
    await expect(page).toHaveURL(/\/admin\/my-day$/);
    const relevo = page.getByRole('region', { name: t('work.handover.title') });
    const nota = relevo.getByRole('article').filter({ hasText: 'dejad la luz baja' });
    await expect(nota.getByText(t('work.handover.new'), { exact: true })).toBeVisible();
    await nota.getByRole('button', { name: t('work.handover.markRead') }).click();
    await expect(nota.getByRole('button', { name: t('work.handover.markRead') })).toHaveCount(0);

    // Deja una nota para el turno de tarde.
    await relevo.getByRole('button', { name: t('work.handover.write') }).click();
    const ventanaNota = page.getByRole('dialog', { name: t('work.handover.writeTitle') });
    await ventanaNota.getByLabel(t('work.handover.body'), { exact: true }).fill('Pipa ha dormido mucho esta mañana.');
    await ventanaNota.getByRole('button', { name: t('admin.common.save') }).click();
    await expect(relevo.getByText('Pipa ha dormido mucho esta mañana.')).toBeVisible();

    // CU-70: incidencia grave desde «Incidencias» (el botón ya no está en «Mi día»).
    await expect(page.getByRole('button', { name: t('work.incidents.report') })).toHaveCount(0);
    await page
      .getByRole('navigation', { name: t('admin.nav.label') })
      .getByRole('link', { name: t('admin.nav.incidents') })
      .click();
    await page.getByRole('button', { name: t('work.incidents.report') }).click();
    const ventana = page.getByRole('dialog', { name: t('work.incidents.report') });
    await ventana
      .getByLabel(t('work.incidents.category'))
      .selectOption({ label: t('work.incidents.categories.facilities') });
    await ventana.getByLabel(t('work.incidents.severity')).selectOption({ label: t('work.incidents.severities.high') });
    await ventana.getByLabel(t('work.incidents.zone'), { exact: true }).selectOption({ label: CLINICA });
    await ventana.getByLabel(t('work.incidents.description')).fill(descripcion);
    await ventana.getByRole('button', { name: t('work.incidents.send') }).click();
    await expect(page.getByText(t('work.incidents.reported_ok'))).toBeVisible();

    // La administradora la tiene en la campana y, tras `staff-emails`, en su correo (CU-73).
    await page.context().clearCookies();
    await iniciarSesion(page, MARTA);
    const respuesta = await page.request.post('/api/admin/jobs/staff-emails/run', {
      data: {},
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(respuesta.ok()).toBe(true);
    const correo = await esperarCorreo(MARTA.email, { contiene: descripcion });
    expect(correo.Subject).toContain('Incidencia grave');

    await page.goto('/notifications');
    await page
      .getByRole('main')
      .getByRole('link', { name: new RegExp(descripcion.replace(/[().]/g, '\\$&')) })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: /Incidencia n\.º \d+/ })).toBeVisible();

    // La resuelve con una nota.
    await page.getByRole('button', { name: t('work.incidents.changeStatus') }).click();
    const estado = page.getByRole('dialog', { name: t('work.incidents.changeStatus') });
    await estado
      .getByLabel(t('work.incidents.newStatus'))
      .selectOption({ label: t('work.incidents.statuses.resolved') });
    await estado.getByLabel(t('work.incidents.note')).fill('Cerradura cambiada.');
    await estado.getByRole('button', { name: t('admin.common.save') }).click();
    await expect(page.getByText(t('work.incidents.statusChanged'))).toBeVisible();
    await expect(page.getByText('Cerradura cambiada.')).toBeVisible();

    // CU-72: el escritorio lleva al panel «Hoy».
    await page.goto('/admin');
    await page.getByRole('link', { name: t('admin.dashboard.todayLink') }).click();
    await expect(page.getByRole('heading', { level: 1, name: t('work.today.title') })).toBeVisible();
    await expect(page.getByRole('region', { name: t('work.today.shifts') }).getByText('Nuria Peris Gil')).toBeVisible();
  });
});
