import { expect, iniciarSesion, test } from '../support/test.js';
import { t } from '../support/textos.js';
import { MARTA, NURIA } from '../support/usuarios.js';

// En TEST_DATA.sql, Nuria tiene hoy el turno de mañana (07:00–15:00) en la
// clínica y en el voladero de alimoches, todavía sin fichar.
const MANANA = t('work.shifts.shiftLabel', { name: 'Mañana', start: '07:00', end: '15:00' });

test.describe('CU-63, CU-61 Turnos', () => {
  test('la cuidadora ficha la entrada y la salida desde «Mi día» y el administrador lo ve en el calendario', async ({
    page,
  }) => {
    // CU-63: el bloque «Fichaje» de «Mi día», con sus zonas.
    await iniciarSesion(page, NURIA);
    await expect(page).toHaveURL(/\/admin\/my-day$/);
    const turno = page.getByRole('region', { name: t('work.clock.title') }).getByRole('article', { name: MANANA });
    await expect(turno.getByText('Clínica y recuperación, Voladero de alimoches')).toBeVisible();

    await turno.getByRole('button', { name: t('work.shifts.checkIn'), exact: true }).click();
    await expect(page.getByText(t('work.shifts.checkInDone'), { exact: true })).toBeVisible();
    await expect(turno.getByText(/^Trabajando desde las \d\d:\d\d$/)).toBeVisible();

    // La salida pide confirmación.
    await turno.getByRole('button', { name: t('work.shifts.checkOut'), exact: true }).click();
    await page
      .getByRole('dialog', { name: t('work.clock.confirmOutTitle') })
      .getByRole('button', { name: t('work.shifts.checkOut'), exact: true })
      .click();
    await expect(page.getByText(t('work.shifts.checkOutDone'), { exact: true })).toBeVisible();
    await expect(turno.getByRole('button')).toHaveCount(0);

    // CU-61: en el calendario de la semana, el administrador ve que ha fichado.
    await page.context().clearCookies();
    await iniciarSesion(page, MARTA);
    await page.goto('/admin/shifts');
    await expect(page.getByRole('heading', { level: 1, name: t('work.shifts.title') })).toBeVisible();
    // Solo el día de hoy: los turnos de los días anteriores de la semana también están fichados.
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    const deNuria = page
      .locator('section', { has: page.locator(`[id="dia-${hoy}"]`) })
      .getByRole('article', { name: MANANA })
      .getByRole('listitem')
      .filter({ hasText: 'Nuria Peris Gil' })
      .filter({ hasText: t('work.shifts.checkedIn') });
    await expect(deNuria).toHaveCount(1);
  });
});
