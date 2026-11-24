import { faPlus, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  type IncidentDto,
  type IncidentSeverity,
  type IncidentsQuery,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { workApi } from '../../api/work';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { SelectField } from '../../components/FormFields';
import { Pagination } from '../../components/Pagination';
import { IncidentStatusBadge, SeverityBadge } from '../../components/work/IncidentBadges';
import { IncidentFormModal } from '../../components/work/IncidentFormModal';
import { IncidentResolution } from '../../components/work/IncidentResolution';
import { ResolveIncidentModal } from '../../components/work/ResolveIncidentModal';
import { INCIDENTS_KEY, TODAY_KEY, useIncidentSummary, useIncidents, useZones } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { formatShortInstant } from '../../utils/format';
import styles from './AdminPage.module.css';
import lista from './IncidentsPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

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
  const [aviso, setAviso] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [aResolver, setAResolver] = useState<IncidentDto | null>(null);
  const resumen = useIncidentSummary();
  const pendientes = resumen.data ? resumen.data.open + resumen.data.inProgress : null;

  const refrescar = async (clave: string) => {
    setAviso({ type: 'success', message: t(clave) });
    await queryClient.invalidateQueries({ queryKey: INCIDENTS_KEY });
    await queryClient.invalidateQueries({ queryKey: TODAY_KEY });
  };
  // CU-70: una resuelta se reabre con un toque si el problema vuelve.
  const reabrir = useMutation({
    mutationFn: (id: number) => workApi.incidents.setStatus(id, { status: 'open' }),
    onSuccess: () => refrescar('work.incidents.reopenedOk'),
    onError: (e) => setAviso({ type: 'error', message: errorMessage(t, e) }),
  });
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
      <PageIntro pagina="incidents" />
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
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
              {f === 'active' && pendientes !== null
                ? t('work.incidents.filters.activeCount', { count: pendientes })
                : t(`work.incidents.filters.${f}`)}
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
          <table className={lista.table}>
            <thead>
              <tr>
                <th scope="col">{t('work.incidents.incident')}</th>
                <th scope="col">{t('work.incidents.severity')}</th>
                <th scope="col">{t('work.incidents.status')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('admin.common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {incidencias.data.data.map((i) => (
                <tr key={i.id} className={i.severity === 'high' && i.status !== 'resolved' ? lista.high : undefined}>
                  <td className={lista.main}>
                    <span className={lista.title}>{i.title}</span>
                    <p className={lista.description}>{i.description}</p>
                    <p className={lista.meta}>
                      <span>{t(`work.incidents.categories.${i.category}`)}</span>
                      {(i.animal || i.zone) && (
                        <span>{[i.animal?.name, i.zone?.name].filter(Boolean).join(' · ')}</span>
                      )}
                      <span>
                        {t('work.incidents.reportedShort', {
                          name: i.reportedBy.name,
                          date: formatShortInstant(i.createdAt),
                        })}
                      </span>
                    </p>
                    <IncidentResolution incidencia={i} />
                  </td>
                  <td className={lista.severity}>
                    <SeverityBadge severity={i.severity} />
                  </td>
                  <td className={lista.status}>
                    <IncidentStatusBadge status={i.status} />
                  </td>
                  <td className={lista.actions}>
                    <div>
                      {i.status !== 'resolved' ? (
                        <Button
                          onClick={() => {
                            setAviso(null);
                            setAResolver(i);
                          }}
                        >
                          {t('work.incidents.resolve')}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          icon={faRotateLeft}
                          disabled={reabrir.isPending}
                          onClick={() => {
                            setAviso(null);
                            reabrir.mutate(i.id);
                          }}
                        >
                          {t('work.incidents.reopen')}
                        </Button>
                      )}
                      <ButtonLink variant="outline" to={`/admin/incidents/${i.id}`}>
                        {t('work.incidents.view')}
                      </ButtonLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={pagina} totalPages={incidencias.data.meta.totalPages} onChange={setPagina} />
        </>
      )}

      {aResolver && (
        <ResolveIncidentModal
          incidencia={aResolver}
          onClose={() => setAResolver(null)}
          onSaved={async () => {
            setAResolver(null);
            await refrescar('work.incidents.resolvedOk');
          }}
        />
      )}
      {nueva && (
        <IncidentFormModal
          onClose={() => setNueva(false)}
          onSaved={async () => {
            setNueva(false);
            await refrescar('work.incidents.reported_ok');
          }}
        />
      )}
    </div>
  );
}
