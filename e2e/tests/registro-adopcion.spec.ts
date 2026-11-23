import { enlaceDelCorreo, esperarCorreo } from '../support/mailpit.js';
import { expect, rellenarLogin, rellenarTarjeta, test } from '../support/test.js';
import { t } from '../support/textos.js';
import { GRETA } from '../support/usuarios.js';

test.describe('CU-07, CU-08, CU-13, CU-14, CU-15 Registrarse, verificar el email y adoptar', () => {
  test('un visitante se registra, verifica el email, adopta a un buitre, paga y lo ve en «Mis animales»', async ({
    page,
  }) => {
    // Email nuevo en cada ejecución: el registro no distingue si ya existía.
    const email = `e2e.${Date.now()}@correo.test`;
    const password = 'Buitres.e2e.2026';

    // CU-07: registro. Lleva a iniciar sesión con un aviso.
    await page.goto('/');
    await page
      .getByRole('link', { name: t('nav.register'), exact: true })
      .first()
      .click();
    await page.getByLabel(t('auth.register.firstName'), { exact: true }).fill('Prueba');
    await page.getByLabel(t('auth.register.lastName'), { exact: true }).fill('Extremo a extremo');
    await page.getByLabel(t('auth.email'), { exact: true }).fill(email);
    await page.getByLabel(t('auth.password'), { exact: true }).fill(password);
    await page.getByLabel(t('auth.register.passwordConfirm'), { exact: true }).fill(password);
    await page.getByLabel(t('auth.register.privacy')).check();
    await page.getByRole('button', { name: t('auth.register.submit'), exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(t('auth.register.success'))).toBeVisible();

    // CU-08: el enlace del correo (en Mailpit) verifica el email.
    const correo = await esperarCorreo(email);
    await page.goto(enlaceDelCorreo(correo, '/verify-email'));
    await expect(page.getByText(t('auth.verify.verified'))).toBeVisible();

    // CU-02, CU-03: del catálogo a la ficha de Greta. Sin sesión, «Adoptar» pide entrar
    // y vuelve después a la adopción.
    await page.getByRole('link', { name: t('auth.verify.seeAnimals'), exact: true }).click();
    await page.getByRole('link', { name: GRETA }).first().click();
    await page
      .getByRole('link', { name: t('animalPage.adopt', { name: GRETA }), exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login\?next=/);
    await rellenarLogin(page, { email, password });
    await expect(page).toHaveURL(/\/adopt\//);

    // CU-13: elige el plan Extraordinaria y continúa con el pago.
    await expect(page.getByRole('heading', { name: t('adopt.title', { name: GRETA }) })).toBeVisible();
    await page.getByRole('radio', { name: /Extraordinaria/ }).check();
    await page.getByRole('button', { name: t('adopt.continue'), exact: true }).click();

    // CU-14: ventana de pago simulado.
    const pago = page.getByRole('dialog', { name: t('payment.title') });
    await expect(pago).toBeVisible();
    await expect(pago.getByText(/Extraordinaria/)).toBeVisible();
    await rellenarTarjeta(pago);
    await pago.getByRole('button', { name: t('payment.succeed'), exact: true }).click();

    // CU-15: termina en «Mis animales», con Greta.
    await expect(page).toHaveURL(/\/my-animals$/);
    await expect(page.getByText(t('adopt.success', { name: GRETA }))).toBeVisible();
    await expect(page.getByRole('heading', { name: GRETA })).toBeVisible();
  });
});
