import type { TaskDto } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '../Badge';
import styles from './TaskCard.module.css';

const TONO_ESTADO = { pending: 'neutral', completed: 'success', not_done: 'warning' } as const;

/** Insignias de una tarea (DESIGN_SYSTEM §8.6): tipo, atrasada, puntual y estado si está resuelta. */
export function TaskBadges({ tarea }: { tarea: Pick<TaskDto, 'type' | 'late' | 'isOneOff' | 'status'> }) {
  const { t } = useTranslation();
  return (
    <div className={styles.badges}>
      <Badge>{t(`work.types.${tarea.type}`)}</Badge>
      {tarea.late && <Badge tone="error">{t('work.late')}</Badge>}
      {tarea.isOneOff && <Badge tone="primary">{t('work.oneOff')}</Badge>}
      {tarea.status !== 'pending' && <Badge tone={TONO_ESTADO[tarea.status]}>{t(`work.status.${tarea.status}`)}</Badge>}
    </div>
  );
}
