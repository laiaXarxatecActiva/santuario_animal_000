import type { TaskDto, TodayDto } from '@sanctuary/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SeverityBadge } from '../../components/work/IncidentBadges';
import { useToday } from '../../hooks/useWork';
import { formatTime, formatWeekdayDate } from '../../utils/format';
import styles from './AdminPage.module.css';
import hoyStyles from './TodayPage.module.css';

// CU-72: panel «Hoy» del administrador (SCREENS §5.7). Solo lee; cada bloque lleva a su pantalla.
export function TodayPage() {
  const { t } = useTranslation();
  const hoy = useToday();
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.today.title')}</h1>
        {hoy.data && <span className={styles.muted}>{formatWeekdayDate(hoy.data.date)}</span>}
      </div>
      {hoy.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void hoy.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.today.loadError')}
        </Alert>
      ) : !hoy.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : (
        <Contenido datos={hoy.data} />
      )}
    </div>
  );
}

function Bloque({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={hoyStyles.block}>
      <h2 id={id}>{titulo}</h2>
      {children}
    </section>
  );
}

function Lista<T>({ items, render }: { items: T[]; render: (item: T) => ReactNode }) {
  const { t } = useTranslation();
  if (items.length === 0) return <p className={styles.muted}>{t('work.today.none')}</p>;
  return <ul className={hoyStyles.list}>{items.map(render)}</ul>;
}

function Contenido({ datos }: { datos: TodayDto }) {
  const { t } = useTranslation();
  const tarea = (x: TaskDto) => (
    <li key={x.id}>
      {x.dueTime && `${x.dueTime} · `}
      <span>{x.title}</span>
      {x.zone && <span className={styles.muted}> · {x.zone.name}</span>}
    </li>
  );
  return (
    <div className={hoyStyles.grid}>
      <Bloque id="hoy-tareas" titulo={t('work.today.tasks')}>
        <p>
          {t('work.today.tasksSummary', {
            completed: datos.tasks.completed,
            notDone: datos.tasks.notDone,
            pending: datos.tasks.pending,
            total: datos.tasks.total,
          })}
        </p>
        <Link to="/admin/tasks">{t('work.today.tasksLink')}</Link>
      </Bloque>
      <Bloque id="hoy-atrasadas" titulo={t('work.today.late')}>
        <Lista items={datos.lateTasks} render={tarea} />
      </Bloque>
      <Bloque id="hoy-no-realizadas" titulo={t('work.today.notDone')}>
        <Lista items={datos.notDoneTasks} render={tarea} />
      </Bloque>
      <Bloque id="hoy-dosis" titulo={t('work.today.missedDoses')}>
        <Lista
          items={datos.missedDoses}
          render={(x) => (
            <li key={x.id}>
              {x.dueTime && `${x.dueTime} · `}
              {x.title}
              {x.animals.map((a) => (
                <span key={a.id}>
                  {' · '}
                  <Link to={`/admin/animals/${a.id}/care`}>{a.name}</Link>
                </span>
              ))}
            </li>
          )}
        />
      </Bloque>
      <Bloque id="hoy-incidencias" titulo={t('work.today.incidents')}>
        <p>
          {t('work.today.incidentsSummary', { open: datos.incidents.open, inProgress: datos.incidents.inProgress })}
        </p>
        <Lista
          items={datos.incidents.latest}
          render={(i) => (
            <li key={i.id}>
              <SeverityBadge severity={i.severity} /> <Link to={`/admin/incidents/${i.id}`}>{i.description}</Link>
            </li>
          )}
        />
        <Link to="/admin/incidents">{t('work.today.incidentsLink')}</Link>
      </Bloque>
      <Bloque id="hoy-turnos" titulo={t('work.today.shifts')}>
        <Lista
          items={datos.shifts}
          render={({ assignment: a, missingCheckIn }) => (
            <li key={a.id}>
              <span>{a.user.name}</span>
              <span className={styles.muted}> · {a.shift.name}</span>
              {a.checkedInAt && (
                <span className={styles.muted}>
                  {' '}
                  · {t('work.today.checkedIn', { time: formatTime(a.checkedInAt) })}
                </span>
              )}{' '}
              {missingCheckIn && <Badge tone="warning">{t('work.today.missingCheckIn')}</Badge>}
            </li>
          )}
        />
        <Link to="/admin/shifts">{t('work.today.shiftsLink')}</Link>
      </Bloque>
      <Bloque id="hoy-huecos" titulo={t('work.today.gaps')}>
        <Lista
          items={datos.gaps}
          render={(g) => (
            <li key={`${g.shift.id}-${g.zone.id}`}>
              {t('work.today.gap', {
                zone: g.zone.name,
                shift: g.shift.name,
                assigned: g.assigned,
                required: g.required,
              })}
            </li>
          )}
        />
      </Bloque>
      <Bloque id="hoy-comen-poco" titulo={t('work.today.lowIntake')}>
        <Lista
          items={datos.lowIntake}
          render={(x) => (
            <li key={x.animal.id}>
              <Link to={`/admin/animals/${x.animal.id}/care`}>{x.animal.name}</Link>
              <span className={styles.muted}> · {t('work.today.streak', { count: x.streak })}</span>
            </li>
          )}
        />
      </Bloque>
      <Bloque id="hoy-visitas" titulo={t('work.today.vetVisits')}>
        <Lista
          items={datos.vetVisits}
          render={(v) => (
            <li key={v.id}>
              <Link to={`/admin/animals/${v.animal.id}/care`}>
                {v.time ? `${v.time} · ${v.animal.name}` : v.animal.name}
              </Link>
              {v.reason && <span className={styles.muted}> · {v.reason}</span>}
            </li>
          )}
        />
      </Bloque>
    </div>
  );
}
