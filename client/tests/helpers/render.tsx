import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../../src/router';

type Respuesta = { status?: number; body: unknown };
type Handler = (url: URL) => Respuesta | Promise<Respuesta>;

/**
 * Sustituye `fetch` por una API falsa. Las claves son rutas exactas
 * (`/api/animals/1`); lo que no está definido responde 404.
 */
export function mockApi(handlers: Record<string, Handler | Respuesta>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const handler = handlers[url.pathname];
    const respuesta =
      handler === undefined
        ? { status: 404, body: { error: { code: 'NOT_FOUND', message: 'No encontrado.', details: [] } } }
        : typeof handler === 'function'
          ? await handler(url)
          : handler;
    return new Response(JSON.stringify(respuesta.body), {
      status: respuesta.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  /** URLs pedidas a una ruta concreta. */
  const pedidas = (pathname: string) =>
    fetchMock.mock.calls
      .map(([input]) => new URL(String(input), 'http://localhost'))
      .filter((u) => u.pathname === pathname);
  return { fetchMock, pedidas };
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
