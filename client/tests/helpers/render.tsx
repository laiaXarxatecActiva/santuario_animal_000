import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../../src/router';

type Respuesta = { status?: number; body?: unknown };
/** Petición recibida: método y cuerpo JSON ya convertido. */
export type Peticion = { method: string; body: unknown };
type Handler = (url: URL, peticion: Peticion) => Respuesta | Promise<Respuesta>;

/** Respuesta de error en el formato de la API. */
export const errorApi = (
  status: number,
  code: string,
  message: string,
  details: { field: string; message: string }[] = [],
) => ({
  status,
  body: { error: { code, message, details } },
});

/**
 * Sustituye `fetch` por una API falsa. Las claves son rutas exactas
 * (`/api/animals/1`); lo que no está definido responde 404. Si no se indica
 * otra cosa, `/api/auth/me` responde que no hay sesión.
 */
export function mockApi(handlers: Record<string, Handler | Respuesta>) {
  const todos: Record<string, Handler | Respuesta> = { '/api/auth/me': { body: { user: null } }, ...handlers };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const handler = todos[url.pathname];
    const peticion: Peticion = {
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    const respuesta =
      handler === undefined
        ? errorApi(404, 'NOT_FOUND', 'No encontrado.')
        : typeof handler === 'function'
          ? await handler(url, peticion)
          : handler;
    const status = respuesta.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(respuesta.body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  /** URLs pedidas a una ruta concreta. */
  const pedidas = (pathname: string) =>
    fetchMock.mock.calls
      .map(([input]) => new URL(String(input), 'http://localhost'))
      .filter((u) => u.pathname === pathname);
  /** Cuerpos enviados a una ruta concreta (POST, PUT…). */
  const enviados = (pathname: string) =>
    fetchMock.mock.calls
      .filter(([input]) => new URL(String(input), 'http://localhost').pathname === pathname)
      .map(([, init]) => (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined));
  return { fetchMock, pedidas, enviados };
}

/** Renderiza la aplicación en una ruta, con React Query sin reintentos. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router };
}
