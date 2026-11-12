/** Id numérico positivo de la URL (`/animals/:id`), o `undefined` si no es válido. */
export function parseId(valor: string | undefined): number | undefined {
  return valor && /^\d+$/.test(valor) && Number(valor) > 0 ? Number(valor) : undefined;
}
