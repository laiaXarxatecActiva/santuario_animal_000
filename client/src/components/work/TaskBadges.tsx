import type { TaskDto, TaskStatus } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '../Badge';
import styles from './TaskCard.module.css';

const TONO_ESTADO = { pending: 'neutral', completed: 'success', not_done: 'warning' } as const;

/**
 * Insignias de una tarea (DESIGN_SYSTEM §8.6): tipo, visita veterinaria (CU-68),
 * atrasada y estado si está resuelta.
 */
export function TaskBadges({
  tarea,
}: {
  tarea: Pick<TaskDto, 'type' | 'late' | 'status' | 'vetVisitId' | 'incidentId'>;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.badges}>
      <Badge>{t(`work.types.${tarea.type}`)}</Badge>
      {tarea.vetVisitId && <Badge tone="info">{t('work.vetVisit')}</Badge>}
      {tarea.late && <Badge tone="error">{t('work.late')}</Badge>}
      {tarea.status !== 'pending' && <TaskStatusBadge status={tarea.status} deIncidencia={tarea.incidentId != null} />}
    </div>
  );
}

/**
 * El estado de una tarea, también «Pendiente» (las tareas de una incidencia, CU-70).
 * Una tarea de incidencia hecha (o cerrada al resolver la incidencia) se ve «Resuelta».
 */
export function TaskStatusBadge({ status, deIncidencia = false }: { status: TaskStatus; deIncidencia?: boolean }) {
  const { t } = useTranslation();
  const texto = deIncidencia && status === 'completed' ? t('work.status.resolved') : t(`work.status.${status}`);
  return <Badge tone={TONO_ESTADO[status]}>{texto}</Badge>;
}
