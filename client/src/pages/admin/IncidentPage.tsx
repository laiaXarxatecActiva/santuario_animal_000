import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  INCIDENT_STATUSES,
  incidentStatusBodySchema,
  type IncidentDto,
  type IncidentStatus,
  type IncidentStatusBody,
  type TaskType,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { SelectField, TextAreaField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { IncidentStatusBadge, SeverityBadge } from '../../components/work/IncidentBadges';
import { useSession } from '../../hooks/useSession';
import { INCIDENTS_KEY, TASKS_KEY, TODAY_KEY, useIncident } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { erroresDeApi, erroresPorCampo } from '../../utils/erroresPorCampo';
import { formatShortInstant } from '../../utils/format';
import styles from './AdminPage.module.css';
import { NuevaTarea } from './TasksAdminPage';

/** Tipo de tarea que se propone según la incidencia. */
const TIPO_DE_TAREA: Record<IncidentDto['category'], TaskType> = {
  health: 'health_check',
  behavior: 'health_check',
  facilities: 'maintenance',
  other: 'maintenance',
};

// CU-70: ficha de una incidencia (SCREENS §5.7). Todo el personal cambia su estado; la tarea, solo el administrador.
export function IncidentPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useSession();
  const esAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const incidencia = useIncident(Number(id));
  const [ventana, setVentana] = useState<'estado' | 'tarea' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const refrescar = async (clave: string) => {
    setVentana(null);
    setAviso(t(clave));
    await queryClient.invalidateQueries({ queryKey: INCIDENTS_KEY });
    await queryClient.invalidateQueries({ queryKey: TODAY_KEY });
  };

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

  return (
    <div className={styles.page}>
      {volver}
      <div className={styles.header}>
        <h1>{t('work.incidents.detailTitle', { id: i.id })}</h1>
        <div className={styles.headerActions}>
          {esAdmin && i.status !== 'resolved' && i.taskId === null && (
            <Button variant="outline" onClick={() => setVentana('tarea')}>
              {t('work.incidents.createTask')}
            </Button>
          )}
          <Button onClick={() => setVentana('estado')}>{t('work.incidents.changeStatus')}</Button>
        </div>
      </div>
      {aviso && (
        <Alert type="success" onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}
      <div className={styles.badges}>
        <SeverityBadge severity={i.severity} />
        <IncidentStatusBadge status={i.status} />
      </div>
      <p className={styles.preWrap}>{i.description}</p>
      <dl className={styles.details}>
        <dt>{t('work.incidents.category')}</dt>
        <dd>{t(`work.incidents.categories.${i.category}`)}</dd>
        {i.zone && (
          <>
            <dt>{t('work.incidents.zone')}</dt>
            <dd>{i.zone.name}</dd>
          </>
        )}
        {i.animal && (
          <>
            <dt>{t('work.incidents.animal')}</dt>
            <dd>
              <Link to={`/admin/animals/${i.animal.id}/care`}>{i.animal.name}</Link>
            </dd>
          </>
        )}
        <dt>{t('work.incidents.reported')}</dt>
        <dd>{t('work.incidents.reportedBy', { name: i.reportedBy.name, date: formatShortInstant(i.createdAt) })}</dd>
        {i.taskId !== null && (
          <>
            <dt>{t('work.incidents.task')}</dt>
            <dd>
              <Link to="/admin/tasks">{t('work.incidents.taskLink', { id: i.taskId })}</Link>
            </dd>
          </>
        )}
        {i.resolution && (
          <>
            <dt>{t('work.incidents.resolution')}</dt>
            <dd className={styles.preWrap}>
              {i.resolution}
              {i.resolvedBy && i.resolvedAt && (
                <span className={styles.muted}>
                  {' '}
                  ({t('work.incidents.resolvedBy', { name: i.resolvedBy.name, date: formatShortInstant(i.resolvedAt) })}
                  )
                </span>
              )}
            </dd>
          </>
        )}
      </dl>
      {i.photoUrl && (
        <a href={i.photoUrl} target="_blank" rel="noreferrer">
          <img src={i.photoUrl} alt={t('work.incidents.photoAlt')} className={styles.thumb} />
        </a>
      )}

      {ventana === 'estado' && (
        <CambiarEstado
          incidencia={i}
          onClose={() => setVentana(null)}
          onSaved={() => refrescar('work.incidents.statusChanged')}
        />
      )}
      {ventana === 'tarea' && (
        <NuevaTarea
          titulo={t('work.incidents.taskTitle', { id: i.id })}
          inicial={{
            type: TIPO_DE_TAREA[i.category],
            title: i.description.slice(0, 150),
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

function CambiarEstado({
  incidencia,
  onClose,
  onSaved,
}: {
  incidencia: IncidentDto;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<IncidentStatus>(incidencia.status);
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: (datos: IncidentStatusBody) => workApi.incidents.setStatus(incidencia.id, datos),
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) setErrores(erroresDeApi(e.details));
      else setError(errorMessage(t, e));
    },
  });
  const formId = 'estado-incidencia';
  return (
    <Modal
      open
      title={t('work.incidents.changeStatus')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={guardar.isPending}>
            {guardar.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className={styles.modalForm}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const datos: IncidentStatusBody = { status, note: nota };
          const resultado = incidentStatusBodySchema.safeParse(datos);
          if (!resultado.success) {
            setErrores(erroresPorCampo(resultado.error.issues));
            return;
          }
          setErrores({});
          guardar.mutate(datos);
        }}
      >
        {error && <Alert type="error">{error}</Alert>}
        <SelectField
          label={t('work.incidents.newStatus')}
          value={status}
          error={errores.status}
          onChange={(e) => setStatus(e.target.value as IncidentStatus)}
        >
          {INCIDENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`work.incidents.statuses.${s}`)}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label={
            status === 'resolved' ? t('work.incidents.note') : t('form.optional', { label: t('work.incidents.note') })
          }
          rows={3}
          maxLength={2000}
          value={nota}
          error={errores.note}
          help={status === 'resolved' ? t('work.incidents.noteHelp') : undefined}
          onChange={(e) => setNota(e.target.value)}
        />
      </form>
    </Modal>
  );
}
