// Ayudas para las búsquedas de texto de los listados del panel.

/** Quita mayúsculas y tildes de una expresión SQL, para buscar «lucia» y encontrar «Lucía». */
export const sinTildes = (expr: string) =>
  `translate(lower(${expr}), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc')`;

/** Escapa los comodines de `LIKE` para que el texto buscado se lea literalmente. */
export const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, '\\$&');
