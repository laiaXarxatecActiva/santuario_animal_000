import { useTranslation } from 'react-i18next';
import styles from './Chart.module.css';
import { marcasEje } from './escala';

export interface LinePoint {
  /** Etiqueta del eje horizontal (p. ej., la fecha ya formateada). */
  label: string;
  value: number;
  /** Valor tal y como se muestra (p. ej., «8,40 kg»). */
  display: string;
}

const ANCHO = 600;
const ALTO = 300;
const MARGEN = { arriba: 16, derecha: 16, abajo: 32, izquierda: 48 };

// Gráfico de evolución (DESIGN_SYSTEM §8.9): una línea y un punto por valor.
export function LineChart({
  title,
  points,
  formatAxis,
}: {
  title: string;
  points: LinePoint[];
  formatAxis: (valor: number) => string;
}) {
  const { t } = useTranslation();
  if (points.length === 0) return <p className={styles.empty}>{t('charts.empty')}</p>;

  const valores = points.map((p) => p.value);
  const marcas = marcasEje(Math.max(...valores), Math.min(...valores));
  const yMin = marcas[0] ?? 0;
  const yMax = marcas.at(-1) ?? 1;
  const ancho = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const alto = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (i: number) => MARGEN.izquierda + (points.length === 1 ? ancho / 2 : (i * ancho) / (points.length - 1));
  const y = (v: number) => MARGEN.arriba + alto - ((v - yMin) / (yMax - yMin || 1)) * alto;
  const camino = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const resumen = t('charts.lineSummary', {
    title,
    count: points.length,
    first: `${points[0]!.label}: ${points[0]!.display}`,
    last: `${points.at(-1)!.label}: ${points.at(-1)!.display}`,
  });

  return (
    <figure className={styles.figure}>
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
        {points.length > 1 && <path d={camino} className={styles.line} />}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={3} className={styles.point} />
        ))}
        <text x={x(0)} y={ALTO - 8} textAnchor={points.length === 1 ? 'middle' : 'start'} className={styles.axisLabel}>
          {points[0]!.label}
        </text>
        {points.length > 1 && (
          <text x={x(points.length - 1)} y={ALTO - 8} textAnchor="end" className={styles.axisLabel}>
            {points.at(-1)!.label}
          </text>
        )}
      </svg>
      <details className={styles.data}>
        <summary>{t('charts.showData')}</summary>
        <table>
          <caption className="visually-hidden">{title}</caption>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <th scope="row">{p.label}</th>
                <td className={styles.numeric}>{p.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
