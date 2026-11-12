import { describe, expect, it } from 'vitest';
import { ApiError, apiGet } from '../src/api/client';
import { mockApi } from './helpers/render';

describe('apiGet', () => {
  it('pide la ruta con los parámetros definidos y devuelve el JSON', async () => {
    const { pedidas } = mockApi({ '/api/animals': { body: { data: [] } } });
    expect(await apiGet('/api/animals', { speciesId: 2, q: undefined, adoptable: true })).toEqual({ data: [] });
    expect(pedidas('/api/animals')[0]?.search).toBe('?speciesId=2&adoptable=true');
  });

  it('convierte las respuestas de error en ApiError con el código del servidor', async () => {
    mockApi({
      '/api/animals/12': {
        status: 404,
        body: { error: { code: 'ANIMAL_NOT_AVAILABLE', message: 'Este animal no está disponible.', details: [] } },
      },
    });
    const error = await apiGet('/api/animals/12').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'ANIMAL_NOT_AVAILABLE' });
  });

  it('un error sin el formato estándar sigue siendo un ApiError', async () => {
    mockApi({ '/api/home': { status: 502, body: 'Bad gateway' } });
    await expect(apiGet('/api/home')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });
});
