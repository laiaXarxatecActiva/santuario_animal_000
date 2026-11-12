import type { ApiErrorBody } from '@sanctuary/shared';

/** Error devuelto por la API, con el código de `{ error: { code } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorBody['error']['details'] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Params = Record<string, string | number | boolean | undefined>;

function esErrorDeApi(body: unknown): body is ApiErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const { error } = body as { error: unknown };
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

/** GET a la API. Los parámetros `undefined` no se envían. */
export async function apiGet<T>(path: string, params: Params = {}): Promise<T> {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined) query.set(clave, String(valor));
  }
  const url = query.size > 0 ? `${path}?${query.toString()}` : path;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (esErrorDeApi(body)) {
      throw new ApiError(res.status, body.error.code, body.error.message, body.error.details);
    }
    throw new ApiError(res.status, 'HTTP_ERROR', res.statusText);
  }
  return body as T;
}
