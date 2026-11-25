import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { activeAdoption, adoption, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const tarjeta = async (nombre: string) =>
  (await screen.findByRole('heading', { level: 2, name: nombre })).closest('article') as HTMLElement;

const conAdopciones = (data: unknown[]) => ({
  '/api/auth/me': { body: { user: sessionUser() } },
  '/api/me/adoptions': { body: { data } },
});

/** Abre el menú «⋯» de la tarjeta y devuelve la opción «Descargar certificado». */
const opcionDescargar = async (rufo: HTMLElement) => {
  await userEvent.click(within(rufo).getByRole('button', { name: 'Más acciones de Rufo' }));
  return within(within(rufo).getByRole('menu')).getByRole('menuitem', { name: 'Descargar certificado' });
};

describe('CU-22 Descargar el certificado de adopción', () => {
  it('1-3: una adopción activa permite ver el certificado en el navegador o descargarlo desde el menú «⋯»', async () => {
    mockApi(conAdopciones([activeAdoption()]));
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    const ver = within(rufo).getByRole('link', { name: 'Ver el certificado de Rufo (PDF)' });
    expect(ver).toHaveAttribute('href', '/api/me/adoptions/1/certificate');
    expect(ver).toHaveAttribute('target', '_blank');
    // La descarga directa no está a la vista: va en el menú «⋯».
    expect(within(rufo).queryByRole('link', { name: /Descargar/ })).not.toBeInTheDocument();
    const descargar = await opcionDescargar(rufo);
    expect(descargar).toHaveAttribute('href', '/api/me/adoptions/1/certificate?download=1');
    expect(descargar).toHaveAttribute('download');
  });

  it('también con la baja solicitada, mientras sigue activa', async () => {
    mockApi(conAdopciones([activeAdoption({ cancelRequested: true, endDate: '2026-12-04', nextBillingDate: null })]));
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).getByRole('link', { name: 'Ver el certificado de Rufo (PDF)' })).toBeInTheDocument();
    expect(await opcionDescargar(rufo)).toBeInTheDocument();
  });

  it('1a: si la adopción no está activa, la opción no aparece', async () => {
    mockApi(conAdopciones([adoption({ status: 'paused', startDate: '2025-09-05' })]));
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    expect(within(rufo).queryByRole('link', { name: /certificado/ })).not.toBeInTheDocument();
    await userEvent.click(within(rufo).getByRole('button', { name: 'Más acciones de Rufo' }));
    expect(
      within(within(rufo).getByRole('menu')).queryByRole('menuitem', { name: 'Descargar certificado' }),
    ).not.toBeInTheDocument();
  });
});

describe('CU-15 Acciones de la tarjeta de «Mis animales»', () => {
  it('a la vista, por este orden: «Ver la ficha», «Certificado» y «Cambiar plan»', async () => {
    mockApi(conAdopciones([activeAdoption()]));
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    const ficha = within(rufo).getByRole('link', { name: 'Ver la ficha de Rufo' });
    const ver = within(rufo).getByRole('link', { name: 'Ver el certificado de Rufo (PDF)' });
    const plan = within(rufo).getByRole('button', { name: 'Cambiar plan' });
    expect(ver).toHaveTextContent(/^Certificado$/);
    expect(ficha.compareDocumentPosition(ver) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ver.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('en el menú «⋯», por este orden: «Forma de pago», «Descargar certificado» y «Darme de baja»', async () => {
    mockApi(conAdopciones([activeAdoption()]));
    renderRoute('/my-animals');
    const rufo = await tarjeta('Rufo');
    await userEvent.click(within(rufo).getByRole('button', { name: 'Más acciones de Rufo' }));
    const opciones = within(within(rufo).getByRole('menu')).getAllByRole('menuitem');
    expect(opciones.map((o) => o.textContent)).toEqual(['Forma de pago', 'Descargar certificado', 'Darme de baja']);
  });
});
