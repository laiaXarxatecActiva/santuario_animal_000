import { faMagnifyingGlass, faPlus } from '@fortawesome/free-solid-svg-icons';
import {
  ADMIN_ADOPTION_SORTS,
  ADOPTION_STATUSES,
  type AdminAdoptionSort,
  type AdoptionStatus,
} from '@sanctuary/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import type { AdminAdoptionsParams } from '../../api/admin';
import { AdoptionStatusBadge } from '../../components/AdoptionStatusBadge';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { Pagination } from '../../components/Pagination';
import { useAdminAdoptions, useAdminPlans } from '../../hooks/useAdmin';
import { formatShortDate } from '../../utils/format';
import styles from './AdminPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

const PAGE_SIZE = 20;
// Orden fijo de los parámetros en la URL. `animalId` y `userId` llegan desde
// otras fichas (por ejemplo, «ver sus adopciones»).
const CLAVES = ['q', 'status', 'planId', 'animalId', 'userId', 'sort', 'page'] as const;

const entero = (valor: string | null) => (valor && /^\d+$/.test(valor) ? Number(valor) : undefined);
const de = <T extends string>(lista: readonly T[], valor: string | null): T | undefined =>
  (lista as readonly string[]).includes(valor ?? '') ? (valor as T) : undefined;

/** Filtros válidos de la URL; lo que no se reconoce se ignora. */
function leerFiltros(params: URLSearchParams): AdminAdoptionsParams {
  return {
    q: params.get('q') || undefined,
    status: de<AdoptionStatus>(ADOPTION_STATUSES, params.get('status')),
    planId: entero(params.get('planId')),
    animalId: entero(params.get('animalId')),
    userId: entero(params.get('userId')),
    sort: de<AdminAdoptionSort>(ADMIN_ADOPTION_SORTS, params.get('sort')),
    page: entero(params.get('page')),
  };
}

const fecha = (valor: string | null) => (valor ? formatShortDate(valor) : '—');

// CU-37 Gestionar adopciones: listado (SCREENS §5.3).
export function AdoptionsAdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const adopciones = useAdminAdoptions({ ...filtros, pageSize: PAGE_SIZE });
  const planes = useAdminPlans();
  const [busqueda, setBusqueda] = useState(filtros.q ?? '');

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
        <h1>{t('admin.adoptions.title')}</h1>
        <ButtonLink to="/admin/adoptions/new" icon={faPlus}>
          {t('admin.adoptions.new')}
        </ButtonLink>
      </div>
      <PageIntro pagina="adoptions" />

      <search className={styles.filters}>
        <form
          role="search"
          className={styles.search}
          onSubmit={(e) => {
            e.preventDefault();
            cambiar({ q: busqueda.trim() || undefined });
          }}
        >
          <TextField
            type="search"
            label={t('admin.adoptions.searchLabel')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <Button type="submit" variant="outline" icon={faMagnifyingGlass}>
            {t('admin.common.search')}
          </Button>
        </form>
        <SelectField
          label={t('admin.adoptions.status')}
          value={params.get('status') ?? ''}
          onChange={(e) => cambiar({ status: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          {ADOPTION_STATUSES.map((estado) => (
            <option key={estado} value={estado}>
              {t(`adoption.status.${estado}`)}
            </option>
          ))}
        </SelectField>
        {planes.data && (
          <SelectField
            label={t('admin.adoptions.plan')}
            value={params.get('planId') ?? ''}
            onChange={(e) => cambiar({ planId: e.target.value || undefined })}
          >
            <option value="">{t('form.any')}</option>
            {planes.data.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </SelectField>
        )}
      </search>

      {adopciones.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void adopciones.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.adoptions.loadError')}
        </Alert>
      ) : !adopciones.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : adopciones.data.data.length === 0 ? (
        <p>{t('admin.adoptions.empty')}</p>
      ) : (
        <>
          <p className={styles.count} aria-live="polite">
            {t('admin.common.results', { count: adopciones.data.meta.total })}
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('admin.adoptions.adopter')}</th>
                <th scope="col">{t('admin.adoptions.animal')}</th>
                <th scope="col">{t('admin.adoptions.plan')}</th>
                <th scope="col">{t('admin.adoptions.status')}</th>
                <th scope="col">{t('admin.adoptions.startDate')}</th>
                <th scope="col">{t('admin.adoptions.nextBilling')}</th>
              </tr>
            </thead>
            <tbody>
              {adopciones.data.data.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/admin/adoptions/${a.id}`} className={styles.nameLink}>
                      {`${a.adopter.firstName} ${a.adopter.lastName}`}
                    </Link>
                  </td>
                  <td data-label={t('admin.adoptions.animal')}>{a.animal.name}</td>
                  <td data-label={t('admin.adoptions.plan')}>{a.plan.name}</td>
                  <td data-label={t('admin.adoptions.status')}>
                    <AdoptionStatusBadge status={a.status} />
                  </td>
                  <td data-label={t('admin.adoptions.startDate')}>{fecha(a.startDate)}</td>
                  <td data-label={t('admin.adoptions.nextBilling')}>{fecha(a.nextBillingDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={adopciones.data.meta.page}
            totalPages={adopciones.data.meta.totalPages}
            onChange={(p) => cambiar({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
