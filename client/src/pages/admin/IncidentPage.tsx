import { faArrowLeft, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IncidentDto, TaskType } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { IncidentStatusBadge, SeverityBadge } from '../../components/work/IncidentBadges';
import { IncidentResolution } from '../../components/work/IncidentResolution';
import { ResolveIncidentModal } from '../../components/work/ResolveIncidentModal';
import { TaskStatusBadge } from '../../components/work/TaskBadges';
import { useSession } from '../../hooks/useSession';
import { INCIDENTS_KEY, TASKS_KEY, TODAY_KEY, useIncident } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { formatShortDate, formatShortInstant } from '../../utils/format';
import styles from './AdminPage.module.css';
import ficha from './IncidentPage.module.css';
import { NuevaTarea } from './TasksAdminPage';

/** Tipo de tarea que se propone según la incidencia. */
const TIPO_DE_TAREA: Record<IncidentDto['category'], TaskType> = {
  health: 'health_check',
  behavior: 'health_check',
  facilities: 'maintenance',
  other: 'maintenance',
};

// CU-70: ficha de una incidencia (SCREENS §5.7). Todo el personal la resuelve o la reabre; la tarea, solo el administrador.
export function IncidentPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useSession();
  const esAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const incidencia = useIncident(Number(id));
  const [ventana, setVentana] = useState<'resolver' | 'tarea' | null>(null);
  const [aviso, setAviso] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const refrescar = async (clave: string) => {
    setVentana(null);
    setAviso({ type: 'success', message: t(clave) });
    await queryClient.invalidateQueries({ queryKey: INCIDENTS_KEY });
    await queryClient.invalidateQueries({ queryKey: TODAY_KEY });
  };
  const reabrir = useMutation({
    mutationFn: (incidenciaId: number) => workApi.incidents.setStatus(incidenciaId, { status: 'open' }),
    onSuccess: () => refrescar('work.incidents.reopenedOk'),
    onError: (e) => setAviso({ type: 'error', message: errorMessage(t, e) }),
  });

  const volver = (
    <Link to="/admin/incidents">
      <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" /> {t('work.incidents.back')}
    </Link>
  );

  if (incidencia.isError) {
    const mensaje =
      incidencia.error instanceof ApiError && incidencia.error.status === 404
        ? t('work.incidents.notFound')
        : errorMessage(t, incidencia.error);
    return (
      <div className={styles.page}>
        {volver}
        <Alert type="error">{mensaje}</Alert>
      </div>
    );
  }
  if (!incidencia.data) return <p aria-busy="true">{t('common.loading')}</p>;
  const i = incidencia.data;
  const resuelta = i.status === 'resolved';
  // CU-70: solo una tarea pendiente a la vez.
  const conTareaPendiente = i.tasks.some((tarea) => tarea.status === 'pending');

  return (
    <div className={styles.page}>
      {volver}
      <div className={styles.header}>
        <div className={ficha.titleBlock}>
          <h1>{t('work.incidents.detailTitle', { id: i.id })}</h1>
          <div className={styles.badges}>
            <SeverityBadge severity={i.severity} />
            <IncidentStatusBadge status={i.status} />
          </div>
        </div>
        <div className={styles.headerActions}>
          {esAdmin && !resuelta && !conTareaPendiente && (
            <Button variant="outline" onClick={() => setVentana('tarea')}>
              {t('work.incidents.createTask')}
            </Button>
          )}
          {resuelta ? (
            <Button
              variant="outline"
              icon={faRotateLeft}
              disabled={reabrir.isPending}
              onClick={() => {
                setAviso(null);
                reabrir.mutate(i.id);
              }}
            >
              {t('work.incidents.reopen')}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setAviso(null);
                setVentana('resolver');
              }}
            >
              {t('work.incidents.resolve')}
            </Button>
          )}
        </div>
      </div>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      <section className={ficha.card} aria-labelledby="incidencia-descripcion">
        <h2 className={ficha.title}>{i.title}</h2>
        <div>
          <h3 id="incidencia-descripcion" className={ficha.sectionTitle}>
            {t('work.incidents.description')}
          </h3>
          <p className={ficha.description}>{i.description}</p>
        </div>
        <dl className={ficha.facts}>
          <div>
            <dt>{t('work.incidents.category')}</dt>
            <dd>{t(`work.incidents.categories.${i.category}`)}</dd>
          </div>
          {i.zone && (
            <div>
              <dt>{t('work.incidents.zone')}</dt>
              <dd>{i.zone.name}</dd>
            </div>
          )}
          {i.animal && (
            <div>
              <dt>{t('work.incidents.animal')}</dt>
              <dd>
                <Link to={`/admin/animals/${i.animal.id}/care`}>{i.animal.name}</Link>
              </dd>
            </div>
          )}
          <div>
            <dt>{t('work.incidents.reported')}</dt>
            <dd>
              {t('work.incidents.reportedBy', { name: i.reportedBy.name, date: formatShortInstant(i.createdAt) })}
            </dd>
          </div>
        </dl>
        {i.photos.length > 0 && (
          <section aria-labelledby="incidencia-fotos">
            <h3 id="incidencia-fotos" className={ficha.sectionTitle}>
              {t('work.photos')}
            </h3>
            <ul className={ficha.photos}>
              {i.photos.map((url, n) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer" className={ficha.photo}>
                    <img src={url} alt={t('work.incidents.photoAlt', { n: n + 1 })} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {i.tasks.length > 0 && (
          <section aria-labelledby="incidencia-tareas">
            <h3 id="incidencia-tareas" className={ficha.sectionTitle}>
              {t('work.incidents.tasks')}
            </h3>
            <ul className={ficha.tasks}>
              {i.tasks.map((tarea) => (
                <li key={tarea.id}>
                  <Link to={`/admin/tasks?date=${tarea.dueDate}`}>{tarea.title}</Link>
                  <span className={ficha.taskDate}>{formatShortDate(tarea.dueDate)}</span>
                  <TaskStatusBadge status={tarea.status} deIncidencia />
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      <IncidentResolution incidencia={i} conTitulo />

      {ventana === 'resolver' && (
        <ResolveIncidentModal
          incidencia={i}
          onClose={() => setVentana(null)}
          onSaved={() => refrescar('work.incidents.resolvedOk')}
        />
      )}
      {ventana === 'tarea' && (
        <NuevaTarea
          titulo={t('work.incidents.taskTitle', { id: i.id })}
          inicial={{
            type: TIPO_DE_TAREA[i.category],
            title: i.title,
            zoneId: i.zone ? String(i.zone.id) : '',
            animalIds: i.animal ? [i.animal.id] : [],
          }}
          enviar={(datos) => workApi.incidents.createTask(i.id, datos)}
          onClose={() => setVentana(null)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
            await refrescar('work.incidents.taskCreated');
          }}
        />
      )}
    </div>
  );
}
