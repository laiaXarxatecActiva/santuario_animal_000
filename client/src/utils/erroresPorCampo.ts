/**
 * El primer error de cada campo, por la primera parte de su ruta: los de una
 * lista (`times.0`, `requirements.1.minWorkers`) cuentan como la lista entera.
 * Sirve igual para los errores de Zod que para los `details` de la API.
 */
export function erroresPorCampo(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const issue of issues) {
    const campo = String(issue.path[0] ?? '');
    errores[campo] ??= issue.message;
  }
  return errores;
}

/** Los `details` de un error de la API, con el mismo formato. */
export const erroresDeApi = (details: readonly { field: string; message: string }[]) =>
  erroresPorCampo(details.map((d) => ({ path: [d.field], message: d.message })));
