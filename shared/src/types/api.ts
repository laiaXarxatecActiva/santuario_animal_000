// Formas comunes de las respuestas de la API (TECH_SPEC §10.1).

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: { field: string; message: string }[];
  };
}
