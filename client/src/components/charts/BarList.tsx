import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Chart.module.css';

export interface BarListItem {
  key: number | string;
  label: ReactNode;
  /** Solo para la longitud de la barra. */
  value: number;
  display: string;
}

// Lista de barras (DESIGN_SYSTEM §8.9): rankings y repartos. Es una lista
// ordenada, así que se lee sin necesidad de tabla.
export function BarList({ label, items }: { label: string; items: BarListItem[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return <p className={styles.empty}>{t('charts.empty')}</p>;
  const maximo = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <ol className={styles.barList} aria-label={label}>
      {items.map((item) => (
        <li key={item.key} className={styles.barRow}>
          <span>{item.label}</span>
          <span className={styles.barValue}>{item.display}</span>
          <span className={styles.barTrack} aria-hidden="true">
            <span
              data-bar
              className={styles.barFill}
              style={{ display: 'block', width: `${Math.round((item.value / maximo) * 100)}%` }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
