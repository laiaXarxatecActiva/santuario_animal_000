import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * Al ir a otra página, la muestra desde arriba del todo (DESIGN_SYSTEM §8.7).
 * No sube si solo cambian los filtros, el orden o la página de una lista (`?…`),
 * al volver atrás o adelante (el navegador devuelve a donde se estaba) ni con un
 * enlace a una sección de la página (`#…`).
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const tipo = useNavigationType();

  useEffect(() => {
    if (tipo === 'POP' || hash) return;
    window.scrollTo(0, 0);
    // Solo cuando cambia la página; `tipo` y `hash` son los de esa navegación.
  }, [pathname]);

  return null;
}
