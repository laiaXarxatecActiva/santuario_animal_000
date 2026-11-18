import { useTranslation } from 'react-i18next';
import styles from './Chart.module.css';
import { marcasEje } from './escala';

export interface BarSeries {
  name: string;
  /** Solo para dibujar (los totales los calcula el servidor). */
  values: number[];
  /** Cada valor tal y como se muestra (p. ej., «20,00 €»). */
  display: string[];
}

const ANCHO = 600;
const ALTO = 300;
const MARGEN = { arriba: 16, derecha: 8, abajo: 32, izquierda: 56 };
/** Con muchos meses, solo se rotula uno de cada `paso` para que no se pisen. */
const MAX_ETIQUETAS = 12;

// Gráfico de barras agrupadas por mes (DESIGN_SYSTEM §8.9): la primera serie en
// terracota y la segunda en oliva; la leyenda y la tabla no dependen del color.
export function BarChart({
  title,
  labels,
  series,
  formatAxis,
}: {
  title: string;
  labels: string[];
  series: BarSeries[];
  formatAxis: (valor: number) => string;
}) {
  const { t } = useTranslation();
  const maximo = Math.max(0, ...series.flatMap((s) => s.values));
  if (labels.length === 0 || maximo === 0) return <p className={styles.empty}>{t('charts.empty')}</p>;

  const marcas = marcasEje(maximo);
  const yMax = marcas.at(-1) ?? 1;
  const ancho = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const alto = ALTO - MARGEN.arriba - MARGEN.abajo;
  const grupo = ancho / labels.length;
  const barra = Math.min(24, (grupo * 0.7) / series.length);
  const y = (v: number) => MARGEN.arriba + alto - (v / yMax) * alto;
  const paso = Math.ceil(labels.length / MAX_ETIQUETAS);
  const resumen = t('charts.barSummary', {
    title,
    count: labels.length,
    first: labels[0],
    last: labels.at(-1),
  });

  return (
    <figure className={styles.figure}>
      <ul className={styles.legend}>
        {series.map((s, i) => (
          <li key={s.name}>
            <span className={`${styles.swatch} ${styles[`series${i}`]}`} aria-hidden="true" />
            {s.name}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className={styles.svg} role="img" aria-label={resumen}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(m)} y2={y(m)} className={styles.grid} />
            <text
              x={MARGEN.izquierda - 8}
              y={y(m)}
              textAnchor="end"
              dominantBaseline="middle"
              className={styles.axisLabel}
            >
              {formatAxis(m)}
            </text>
          </g>
        ))}
        {labels.map((etiqueta, i) => {
          const inicio = MARGEN.izquierda + i * grupo + (grupo - barra * series.length) / 2;
          return (
            <g key={etiqueta}>
              {series.map((s, j) => {
                const valor = s.values[i] ?? 0;
                const altura = Math.max(0, y(0) - y(valor));
                return (
                  <rect
                    key={s.name}
                    x={inicio + j * barra}
                    y={y(valor)}
                    width={barra - 2}
                    height={altura}
                    rx={2}
                    className={styles[`series${j}`]}
                  />
                );
              })}
              {i % paso === 0 && (
                <text
                  x={MARGEN.izquierda + (i + 0.5) * grupo}
                  y={ALTO - 8}
                  textAnchor="middle"
                  className={styles.axisLabel}
                >
                  {etiqueta}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <details className={styles.data}>
        <summary>{t('charts.showData')}</summary>
        <table>
          <caption className="visually-hidden">{title}</caption>
          <thead>
            <tr>
              <td />
              {series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((etiqueta, i) => (
              <tr key={etiqueta}>
                <th scope="row">{etiqueta}</th>
                {series.map((s) => (
                  <td key={s.name} className={styles.numeric}>
                    {s.display[i]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
