import type { ReactNode } from 'react';
import styles from './AuthCard.module.css';

// Tarjeta centrada de las pantallas de autenticación (SCREENS §3.8).
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="container">
      <section className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </section>
    </div>
  );
}
