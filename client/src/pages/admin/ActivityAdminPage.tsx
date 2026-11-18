import {
  ACTIVITY_ACTIONS,
  ACTIVITY_SYSTEM_USER,
  ACTIVITY_TABLES,
  type ActivityAction,
  type ActivityTable,
} from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import type { AdminActivityLogsParams } from '../../api/admin';
import { ActivityLogTable } from '../../components/admin/ActivityLogTable';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { Pagination } from '../../components/Pagination';
import { useAdminActivityLogs, useWorkers } from '../../hooks/useAdmin';
import styles from './AdminPage.module.css';

const PAGE_SIZE = 20;
const CLAVES = ['userId', 'tableName', 'action', 'from', 'to', 'page'] as const;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

const de = <T extends string>(lista: readonly T[], valor: string | null): T | undefined =>
  (lista as readonly string[]).includes(valor ?? '') ? (valor as T) : undefined;
const dia = (valor: string | null) => (valor && DIA.test(valor) ? valor : undefined);
const entero = (valor: string | null) => (valor && /^\d+$/.test(valor) ? Number(valor) : undefined);

/** Filtros válidos de la URL; lo que no se reconoce se ignora. */
function leerFiltros(params: URLSearchParams): AdminActivityLogsParams {
  const usuario = params.get('userId');
  return {
    userId: usuario === ACTIVITY_SYSTEM_USER ? ACTIVITY_SYSTEM_USER : entero(usuario),
    tableName: de<ActivityTable>(ACTIVITY_TABLES, params.get('tableName')),
    action: de<ActivityAction>(ACTIVITY_ACTIONS, params.get('action')),
    from: dia(params.get('from')),
    to: dia(params.get('to')),
    page: entero(params.get('page')),
  };
}

// CU-42 Consultar el registro de actividad (SCREENS §5.6): solo lectura.
export function ActivityAdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const registro = useAdminActivityLogs({ ...filtros, pageSize: PAGE_SIZE });
  const trabajadores = useWorkers();

  /** Cambia un filtro y vuelve a la primera página. */
  const cambiar = (cambios: Partial<Record<(typeof CLAVES)[number], string | undefined>>) => {
    const actuales = Object.fromEntries(CLAVES.map((c) => [c, params.get(c) ?? undefined]));
    const nuevos: Record<string, string | undefined> = { ...actuales, page: undefined, ...cambios };
    const siguiente = new URLSearchParams();
    for (const clave of CLAVES) {
      const valor = nuevos[clave];
      if (valor) siguiente.set(clave, valor);
    }
    setParams(siguiente);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('admin.activity.title')}</h1>
      </div>

      <search className={styles.filters}>
        <SelectField
          label={t('admin.activity.user')}
          value={params.get('userId') ?? ''}
          onChange={(e) => cambiar({ userId: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          <option value={ACTIVITY_SYSTEM_USER}>{t('admin.activity.system')}</option>
          {(trabajadores.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {`${u.firstName} ${u.lastName}`}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('admin.activity.table')}
          value={params.get('tableName') ?? ''}
          onChange={(e) => cambiar({ tableName: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          {ACTIVITY_TABLES.map((tabla) => (
            <option key={tabla} value={tabla}>
              {t(`admin.activity.tables.${tabla}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('admin.activity.action')}
          value={params.get('action') ?? ''}
          onChange={(e) => cambiar({ action: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          {ACTIVITY_ACTIONS.map((accion) => (
            <option key={accion} value={accion}>
              {t(`admin.activity.actions.${accion}`)}
            </option>
          ))}
        </SelectField>
        <TextField
          type="date"
          label={t('admin.payments.from')}
          value={filtros.from ?? ''}
          onChange={(e) => cambiar({ from: dia(e.target.value) })}
        />
        <TextField
          type="date"
          label={t('admin.payments.to')}
          value={filtros.to ?? ''}
          onChange={(e) => cambiar({ to: dia(e.target.value) })}
        />
      </search>

      {registro.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void registro.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.activity.loadError')}
        </Alert>
      ) : !registro.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : (
        <>
          <p className={styles.count} aria-live="polite">
            {t('admin.common.results', { count: registro.data.meta.total })}
          </p>
          {registro.data.data.length === 0 ? (
            <p>{t('admin.activity.empty')}</p>
          ) : (
            <ActivityLogTable entries={registro.data.data} />
          )}
          <Pagination
            page={registro.data.meta.page}
            totalPages={registro.data.meta.totalPages}
            onChange={(page) => cambiar({ page: String(page) })}
          />
        </>
      )}
    </div>
  );
}
