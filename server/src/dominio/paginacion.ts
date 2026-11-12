import type { PageMeta } from '@sanctuary/shared';

export interface Pagina extends PageMeta {
  offset: number;
}

/**
 * Calcula la página que se va a devolver. Si la pedida no existe, se devuelve
 * la última disponible (CU-02 4b).
 */
export function paginar(peticion: { page: number; pageSize: number }, total: number): Pagina {
  const { pageSize } = peticion;
  const totalPages = Math.ceil(total / pageSize);
  const page = Math.min(peticion.page, Math.max(totalPages, 1));
  return { page, pageSize, total, totalPages, offset: (page - 1) * pageSize };
}
