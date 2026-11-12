import { describe, expect, it } from 'vitest';
import { ApiError, apiGet, apiPost } from '../src/api/client';
import { errorApi, mockApi } from './helpers/render';

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

describe('apiPost', () => {
  it('envía JSON con la cookie de sesión y devuelve la respuesta', async () => {
    const { fetchMock, enviados } = mockApi({ '/api/auth/login': { body: { user: { id: 6 } } } });
    expect(await apiPost('/api/auth/login', { email: 'a@b.test', password: 'x' })).toEqual({ user: { id: 6 } });
    expect(enviados('/api/auth/login')).toEqual([{ email: 'a@b.test', password: 'x' }]);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });

  it('sin cuerpo envía {} (la API solo acepta JSON en las modificaciones)', async () => {
    const { enviados } = mockApi({ '/api/auth/logout': { status: 204 } });
    expect(await apiPost('/api/auth/logout')).toBeUndefined();
    expect(enviados('/api/auth/logout')).toEqual([{}]);
  });

  it('convierte los errores con los detalles por campo', async () => {
    mockApi({
      '/api/auth/register': errorApi(400, 'VALIDATION_ERROR', 'Datos no válidos', [{ field: 'email', message: 'x' }]),
    });
    await expect(apiPost('/api/auth/register', {})).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'email', message: 'x' }],
    });
  });
});
