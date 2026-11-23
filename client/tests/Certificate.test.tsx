import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { activeAdoption, adoption, sessionUser } from './helpers/fixtures';
import { mockApi, renderRoute } from './helpers/render';

const tarjeta = async (nombre: string) =>
  (await screen.findByRole('heading', { level: 2, name: nombre })).closest('article') as HTMLElement;

const conAdopciones = (data: unknown[]) => ({
  '/api/auth/me': { body: { user: sessionUser() } },
  '/api/me/adoptions': { body: { data } },
});

describe('CU-22 Descargar el certificado de adopción', () => {
  it('1-3: una adopción activa permite descargar el certificado en PDF o verlo en el navegador', async () => {
    mockApi(conAdopciones([activeAdoption()]));
    renderRoute('/my-animals');
    const rufo = within(await tarjeta('Rufo'));
    const descargar = rufo.getByRole('link', { name: 'Descargar el certificado de Rufo (PDF)' });
    expect(descargar).toHaveAttribute('href', '/api/me/adoptions/1/certificate?download=1');
    expect(descargar).toHaveAttribute('download');
    expect(descargar).toHaveTextContent('Descargar certificado');
    const ver = rufo.getByRole('link', { name: 'Ver el certificado de Rufo (PDF)' });
    expect(ver).toHaveAttribute('href', '/api/me/adoptions/1/certificate');
    expect(ver).toHaveAttribute('target', '_blank');
  });

  it('también con la baja solicitada, mientras sigue activa', async () => {
    mockApi(conAdopciones([activeAdoption({ cancelRequested: true, endDate: '2026-12-04', nextBillingDate: null })]));
    renderRoute('/my-animals');
    const rufo = within(await tarjeta('Rufo'));
    expect(rufo.getByRole('link', { name: 'Descargar el certificado de Rufo (PDF)' })).toBeInTheDocument();
  });

  it('1a: si la adopción no está activa, la opción no aparece', async () => {
    mockApi(conAdopciones([adoption({ status: 'paused', startDate: '2025-09-05' })]));
    renderRoute('/my-animals');
    const rufo = within(await tarjeta('Rufo'));
    expect(rufo.queryByRole('link', { name: /certificado/ })).not.toBeInTheDocument();
  });
});

describe('CU-22 Orden de los botones del certificado', () => {
  it('primero «Certificado» (lo abre) y al lado «Descargar certificado»', async () => {
    mockApi(conAdopciones([activeAdoption()]));
    renderRoute('/my-animals');
    const rufo = within(await tarjeta('Rufo'));
    const ver = rufo.getByRole('link', { name: 'Ver el certificado de Rufo (PDF)' });
    const descargar = rufo.getByRole('link', { name: 'Descargar el certificado de Rufo (PDF)' });
    expect(ver).toHaveTextContent(/^Certificado$/);
    expect(descargar).toHaveTextContent(/^Descargar certificado$/);
    expect(ver.compareDocumentPosition(descargar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
