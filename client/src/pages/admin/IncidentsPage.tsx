import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, type IncidentSeverity, type IncidentsQuery } from '@sanctuary/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/FormFields';
import { Pagination } from '../../components/Pagination';
import { IncidentStatusBadge, SeverityBadge } from '../../components/work/IncidentBadges';
import { IncidentFormModal } from '../../components/work/IncidentFormModal';
import { INCIDENTS_KEY, useIncidents, useZones } from '../../hooks/useWork';
import { formatShortInstant } from '../../utils/format';
import styles from './AdminPage.module.css';

type FiltroEstado = IncidentsQuery['status'];
const FILTROS_ESTADO: readonly FiltroEstado[] = ['active', ...INCIDENT_STATUSES, 'all'];

// CU-70: incidencias (SCREENS §5.7). Todo el personal las ve y las comunica.
export function IncidentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const zonas = useZones();
  const [status, setStatus] = useState<FiltroEstado>('active');
  const [severity, setSeverity] = useState<IncidentSeverity | ''>('');
  const [zoneId, setZoneId] = useState('');
  const [pagina, setPagina] = useState(1);
  const [nueva, setNueva] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const incidencias = useIncidents({
    status,
    severity: severity || undefined,
    zoneId: zoneId ? Number(zoneId) : undefined,
    page: pagina,
    pageSize: 20,
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.incidents.title')}</h1>
        <Button
          icon={faPlus}
          onClick={() => {
            setAviso(null);
            setNueva(true);
          }}
        >
          {t('work.incidents.report')}
        </Button>
      </div>
      {aviso && (
        <Alert type="success" onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}

      <div className={styles.filters}>
        <SelectField
          label={t('work.incidents.statusFilter')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as FiltroEstado);
            setPagina(1);
          }}
        >
          {FILTROS_ESTADO.map((f) => (
            <option key={f} value={f}>
              {t(`work.incidents.filters.${f}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('work.incidents.severity')}
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value as IncidentSeverity | '');
            setPagina(1);
          }}
        >
          <option value="">{t('work.incidents.filters.anySeverity')}</option>
          {INCIDENT_SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {t(`work.incidents.severities.${s}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('work.incidents.zone')}
          value={zoneId}
          onChange={(e) => {
            setZoneId(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">{t('work.incidents.filters.anyZone')}</option>
          {zonas.data?.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </SelectField>
      </div>

      {incidencias.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void incidencias.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.incidents.loadError')}
        </Alert>
      ) : !incidencias.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : incidencias.data.data.length === 0 ? (
        <p>{t('work.incidents.empty')}</p>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('work.incidents.description')}</th>
                <th scope="col">{t('work.incidents.category')}</th>
                <th scope="col">{t('work.incidents.severity')}</th>
                <th scope="col">{t('work.incidents.place')}</th>
                <th scope="col">{t('work.incidents.status')}</th>
                <th scope="col">{t('work.incidents.reported')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('admin.common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {incidencias.data.data.map((i) => (
                <tr key={i.id}>
                  <td className={styles.nameLink}>{i.description}</td>
                  <td data-label={t('work.incidents.category')}>{t(`work.incidents.categories.${i.category}`)}</td>
                  <td data-label={t('work.incidents.severity')}>
                    <SeverityBadge severity={i.severity} />
                  </td>
                  <td data-label={t('work.incidents.place')}>
                    {[i.animal?.name, i.zone?.name].filter(Boolean).join(' · ')}
                  </td>
                  <td data-label={t('work.incidents.status')}>
                    <IncidentStatusBadge status={i.status} />
                  </td>
                  <td data-label={t('work.incidents.reported')}>
                    <span className={styles.muted}>
                      {t('work.incidents.reportedBy', {
                        name: i.reportedBy.name,
                        date: formatShortInstant(i.createdAt),
                      })}
                    </span>
                  </td>
                  <td>
                    <Link to={`/admin/incidents/${i.id}`}>{t('work.incidents.view')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={pagina} totalPages={incidencias.data.meta.totalPages} onChange={setPagina} />
        </>
      )}

      {nueva && (
        <IncidentFormModal
          onClose={() => setNueva(false)}
          onSaved={async () => {
            setNueva(false);
            setAviso(t('work.incidents.reported_ok'));
            await queryClient.invalidateQueries({ queryKey: INCIDENTS_KEY });
          }}
        />
      )}
    </div>
  );
}
