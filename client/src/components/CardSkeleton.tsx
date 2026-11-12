import styles from './CardSkeleton.module.css';

// Esqueletos de tarjetas mientras carga un listado (DESIGN_SYSTEM §8.9).
export function CardSkeletons({ count }: { count: number }) {
  return (
    <ul className="card-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.card}>
          <div className={styles.photo} />
          <div className={styles.body}>
            <div className={`${styles.line} ${styles.title}`} />
            <div className={styles.line} />
            <div className={`${styles.line} ${styles.short}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
