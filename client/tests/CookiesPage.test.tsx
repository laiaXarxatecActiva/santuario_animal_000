import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockApi, renderRoute } from './helpers/render';

describe('Política de cookies (SCREENS §3.9)', () => {
  it('enumera solo cookies y almacenamiento técnicos, con su duración', async () => {
    mockApi({});
    renderRoute('/cookies');
    expect(await screen.findByRole('heading', { level: 1, name: 'Política de cookies' })).toBeInTheDocument();
    const tabla = screen.getByRole('table', { name: 'Cookies y datos guardados en tu navegador' });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas.map((f) => within(f).getAllByRole('cell')[0]?.textContent)).toEqual(['sid', 'theme', 'cookie-notice']);
    expect(filas[0]).toHaveTextContent('7 días desde tu última visita');
    expect(screen.getByText(/No usamos cookies de análisis ni de publicidad/)).toBeInTheDocument();
  });
});
