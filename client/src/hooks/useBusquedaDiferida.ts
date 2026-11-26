import { useEffect, useRef, useState } from 'react';

/** Milisegundos sin escribir antes de aplicar la búsqueda (DESIGN_SYSTEM §8.5). */
export const ESPERA_BUSQUEDA = 300;

/**
 * Buscadores del panel que filtran a medida que se escribe, como el catálogo
 * público: el texto se aplica (recortado; vacío quita el filtro) cuando se deja
 * de escribir un momento, para no pedir una búsqueda por cada letra.
 *
 * @param aplicado lo que ya está filtrado (p. ej., `?q=` de la URL).
 * @param aplicar  cambia el filtro.
 * @returns el texto del campo, cómo cambiarlo y `ya`, que aplica lo escrito al
 *          momento (al pulsar Enter).
 */
export function useBusquedaDiferida(aplicado: string, aplicar: (q: string | undefined) => void) {
  const [texto, setTexto] = useState(aplicado);
  const ultimoAplicar = useRef(aplicar);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    ultimoAplicar.current = aplicar;
  });

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio === aplicado.trim()) return;
    temporizador.current = setTimeout(() => ultimoAplicar.current(limpio || undefined), ESPERA_BUSQUEDA);
    return () => clearTimeout(temporizador.current);
  }, [texto, aplicado]);

  const ya = () => {
    clearTimeout(temporizador.current);
    const limpio = texto.trim();
    if (limpio !== aplicado.trim()) ultimoAplicar.current(limpio || undefined);
  };

  return [texto, setTexto, ya] as const;
}
