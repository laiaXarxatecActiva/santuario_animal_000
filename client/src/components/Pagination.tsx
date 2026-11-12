import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import styles from './Pagination.module.css';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/** Páginas visibles: primera, última y las vecinas de la actual, con «…» entre huecos. */
function paginasVisibles(page: number, total: number): (number | 'gap')[] {
  const paginas = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const ordenadas = [...paginas].sort((a, b) => a - b);
  const resultado: (number | 'gap')[] = [];
  ordenadas.forEach((p, i) => {
    const anterior = ordenadas[i - 1];
    if (anterior !== undefined && p - anterior > 1) resultado.push('gap');
    resultado.push(p);
  });
  return resultado;
}

// Paginación (DESIGN_SYSTEM §8.9). En móvil solo «Anterior», «Página x de y» y «Siguiente».
export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={t('pagination.label')} className={styles.pagination}>
      <button type="button" className={styles.step} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
        <span>{t('pagination.previous')}</span>
      </button>
      <ol className={styles.pages}>
        {paginasVisibles(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className={styles.gap}>
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className={styles.page}
                aria-label={t('pagination.page', { page: p })}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ol>
      <p className={styles.summary}>{t('pagination.pageOf', { page, total: totalPages })}</p>
      <button type="button" className={styles.step} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        <span>{t('pagination.next')}</span>
        <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
      </button>
    </nav>
  );
}
