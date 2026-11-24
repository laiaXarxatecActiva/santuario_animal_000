import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IncidentDto } from '@sanctuary/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatShortInstant } from '../../utils/format';
import styles from './IncidentResolution.module.css';

/**
 * CU-70: cómo se resolvió una incidencia, quién y cuándo, en un recuadro verde suave.
 * En la ficha lleva el título «Resolución»; en el listado va sin título.
 */
export function IncidentResolution({
  incidencia,
  conTitulo = false,
}: {
  incidencia: IncidentDto;
  conTitulo?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  if (!incidencia.resolution) return null;
  const quien =
    incidencia.resolvedBy && incidencia.resolvedAt
      ? t('work.incidents.resolvedByLine', {
          name: incidencia.resolvedBy.name,
          date: formatShortInstant(incidencia.resolvedAt),
        })
      : null;
  const contenido = (
    <>
      {quien && (
        <p className={styles.who}>
          <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
          <span>{quien}</span>
        </p>
      )}
      <p className={styles.text}>{incidencia.resolution}</p>
    </>
  );
  return conTitulo ? (
    <section aria-labelledby={id} className={styles.box}>
      <h2 id={id} className={styles.title}>
        {t('work.incidents.resolution')}
      </h2>
      {contenido}
    </section>
  ) : (
    <div className={styles.box}>{contenido}</div>
  );
}
