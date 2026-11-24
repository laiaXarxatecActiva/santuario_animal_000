import type { MyDayTaskDto } from '@sanctuary/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatList, formatTime } from '../../utils/format';
import { TaskBadges } from './TaskBadges';
import styles from './TaskCard.module.css';

/**
 * Tarjeta de una tarea en «Mi día» (CU-56, DESIGN_SYSTEM §8.9): hora, título,
 * insignias, zona y animales, quién la resolvió y las acciones que caben.
 */
export function TaskCard({ tarea, acciones }: { tarea: MyDayTaskDto; acciones: ReactNode }) {
  const { t } = useTranslation();
  const tituloId = `tarea-${tarea.id}`;
  const bloqueo =
    tarea.status === 'pending' && tarea.blockedReason && tarea.blockedReason !== 'NOT_PENDING'
      ? t(`work.blocked.${tarea.blockedReason}`, { name: tarea.qualification?.name ?? '' })
      : null;

  return (
    <article aria-labelledby={tituloId} className={styles.card} data-late={tarea.late || undefined}>
      <div className={styles.top}>
        <time className={styles.time}>{tarea.dueTime}</time>
        <h3 id={tituloId} className={styles.title}>
          {tarea.title}
        </h3>
      </div>
      <TaskBadges tarea={tarea} />
      {(tarea.zone || tarea.animals.length > 0) && (
        <p className={styles.meta}>
          {tarea.zone && <span>{tarea.zone.name}</span>}
          {tarea.animals.length > 0 && <span>{formatList(tarea.animals.map((a) => a.name))}</span>}
        </p>
      )}
      {tarea.description && <p>{tarea.description}</p>}
      {(tarea.qualification || (tarea.assignedTo && !tarea.mine)) && (
        <p className={styles.meta}>
          {tarea.qualification && <span>{t('work.requires', { name: tarea.qualification.name })}</span>}
          {tarea.assignedTo && !tarea.mine && <span>{t('work.assignedTo', { name: tarea.assignedTo.name })}</span>}
        </p>
      )}
      {tarea.status !== 'pending' && <Resolucion tarea={tarea} />}
      {bloqueo && <p className={styles.blocked}>{bloqueo}</p>}
      {acciones && <div className={styles.actions}>{acciones}</div>}
    </article>
  );
}

/** Quién la resolvió y cuándo, con las observaciones y la foto. */
export function Resolucion({
  tarea,
}: {
  tarea: Pick<MyDayTaskDto, 'resolvedBy' | 'resolvedAt' | 'observations' | 'photoUrl' | 'intakes'>;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.resolution}>
      <p className={styles.meta}>
        {tarea.resolvedBy && tarea.resolvedAt
          ? t('work.resolvedBy', { name: tarea.resolvedBy.name, time: formatTime(tarea.resolvedAt) })
          : t('work.resolvedBySystem')}
      </p>
      {tarea.intakes && tarea.intakes.length > 0 && (
        <p className={styles.meta}>
          {tarea.intakes.map((i) => (
            <span key={i.animal.id}>
              {t('work.intakeOf', { name: i.animal.name, intake: t(`work.care.intakes.${i.intake}`) })}
            </span>
          ))}
        </p>
      )}
      {tarea.observations && <p>{tarea.observations}</p>}
      {tarea.photoUrl && (
        <a href={tarea.photoUrl} target="_blank" rel="noreferrer">
          {t('work.viewPhoto')}
        </a>
      )}
    </div>
  );
}
