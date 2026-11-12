import pg from 'pg';

// DATE se lee como string `YYYY-MM-DD` (no como Date, que añadiría la zona
// horaria). NUMERIC ya llega como string por defecto y así se queda.
pg.types.setTypeParser(pg.types.builtins.DATE, (valor) => valor);

/** Crea el pool de conexiones a PostgreSQL. */
export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString });
}

/** Cualquier cosa que ejecute consultas: el pool o un cliente de una transacción. */
export type Queryable = Pick<pg.Pool, 'query'>;
