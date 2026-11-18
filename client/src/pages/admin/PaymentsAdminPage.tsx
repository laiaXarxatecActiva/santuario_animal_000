import { faFileCsv, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import {
  ADMIN_PAYMENT_SORTS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type AdminPaymentListItemDto,
  type AdminPaymentSort,
  type PaymentMethod,
  type PaymentStatus,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { adminApi, type AdminPaymentsParams } from '../../api/admin';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { ADMIN_ADOPTIONS_KEY, ADMIN_PAYMENTS_KEY, useAdminPayments } from '../../hooks/useAdmin';
import { errorMessage } from '../../utils/apiErrors';
import { formatCurrency, formatShortDate, formatShortInstant } from '../../utils/format';
import styles from './AdminPage.module.css';

const PAGE_SIZE = 20;
// Orden fijo de los parámetros en la URL. La exportación usa los mismos, sin la página.
const CLAVES = ['q', 'status', 'method', 'from', 'to', 'adoptionId', 'sort', 'page'] as const;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

const entero = (valor: string | null) => (valor && /^\d+$/.test(valor) ? Number(valor) : undefined);
const de = <T extends string>(lista: readonly T[], valor: string | null): T | undefined =>
  (lista as readonly string[]).includes(valor ?? '') ? (valor as T) : undefined;
const dia = (valor: string | null) => (valor && DIA.test(valor) ? valor : undefined);

/** Filtros válidos de la URL; lo que no se reconoce se ignora. */
function leerFiltros(params: URLSearchParams): AdminPaymentsParams {
  return {
    q: params.get('q') || undefined,
    status: de<PaymentStatus>(PAYMENT_STATUSES, params.get('status')),
    method: de<PaymentMethod>(PAYMENT_METHODS, params.get('method')),
    from: dia(params.get('from')),
    to: dia(params.get('to')),
    adoptionId: entero(params.get('adoptionId')),
    sort: de<AdminPaymentSort>(ADMIN_PAYMENT_SORTS, params.get('sort')),
    page: entero(params.get('page')),
  };
}

/** Paso 3: el CSV se descarga con los mismos filtros (todas las páginas). */
function urlExportacion(filtros: AdminPaymentsParams): string {
  const query = new URLSearchParams();
  for (const clave of CLAVES) {
    const valor = filtros[clave];
    if (clave !== 'page' && valor !== undefined) query.set(clave, String(valor));
  }
  return query.size > 0 ? `/api/admin/payments/export.csv?${query.toString()}` : '/api/admin/payments/export.csv';
}

type Aviso = { type: 'success' | 'error'; message: string };

// CU-38 Gestionar pagos (SCREENS §5.3).
export function PaymentsAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const pagos = useAdminPayments({ ...filtros, pageSize: PAGE_SIZE });
  const [busqueda, setBusqueda] = useState(filtros.q ?? '');
  const [aDevolver, setADevolver] = useState<AdminPaymentListItemDto | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

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

  const devolver = useMutation({
    mutationFn: (id: number) => adminApi.payments.refund(id),
    onSuccess: async () => {
      setADevolver(null);
      setAviso({ type: 'success', message: t('admin.payments.refunded') });
      await queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_KEY });
      await queryClient.invalidateQueries({ queryKey: ADMIN_ADOPTIONS_KEY });
    },
    onError: (error) => {
      setADevolver(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('admin.payments.title')}</h1>
        <ButtonLink to={urlExportacion(filtros)} reloadDocument variant="outline" icon={faFileCsv}>
          {t('admin.payments.export')}
        </ButtonLink>
      </div>

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
          label={t('admin.payments.status')}
          value={params.get('status') ?? ''}
          onChange={(e) => cambiar({ status: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          {PAYMENT_STATUSES.map((estado) => (
            <option key={estado} value={estado}>
              {t(`contributions.paymentStatus.${estado}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('admin.payments.method')}
          value={params.get('method') ?? ''}
          onChange={(e) => cambiar({ method: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          {PAYMENT_METHODS.map((metodo) => (
            <option key={metodo} value={metodo}>
              {t(`admin.adoptions.methods.${metodo}`)}
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

      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      {pagos.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void pagos.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.payments.loadError')}
        </Alert>
      ) : !pagos.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : (
        <>
          {/* Paso 2: la suma la calcula el servidor (solo lo cobrado). */}
          <p className={styles.collected}>
            {t('admin.payments.collected', { amount: formatCurrency(pagos.data.totalCollected) })}
          </p>
          <p className={styles.count} aria-live="polite">
            {t('admin.common.results', { count: pagos.data.meta.total })}
          </p>
          {pagos.data.data.length === 0 ? (
            <p>{t('admin.payments.empty')}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('contributions.date')}</th>
                  <th scope="col">{t('admin.adoptions.adopter')}</th>
                  <th scope="col">{t('admin.adoptions.animal')}</th>
                  <th scope="col">{t('admin.adoptions.period')}</th>
                  <th scope="col" className={styles.numeric}>
                    {t('contributions.amount')}
                  </th>
                  <th scope="col">{t('admin.payments.method')}</th>
                  <th scope="col">{t('admin.payments.status')}</th>
                  <th scope="col">{t('admin.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pagos.data.data.map((p) => {
                  const adoptante = `${p.adopter.firstName} ${p.adopter.lastName}`;
                  return (
                    <tr key={p.id}>
                      <td>{formatShortInstant(p.date)}</td>
                      <td data-label={t('admin.adoptions.adopter')}>
                        <Link to={`/admin/adoptions/${p.adoptionId}`} className={styles.nameLink}>
                          {adoptante}
                        </Link>
                      </td>
                      <td data-label={t('admin.adoptions.animal')}>{p.animal.name}</td>
                      <td data-label={t('admin.adoptions.period')}>
                        {t('admin.adoptions.periodRange', {
                          from: formatShortDate(p.periodStart),
                          to: formatShortDate(p.periodEnd),
                        })}
                      </td>
                      <td data-label={t('contributions.amount')} className={styles.numeric}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td data-label={t('admin.payments.method')}>{t(`admin.adoptions.methods.${p.method}`)}</td>
                      <td data-label={t('admin.payments.status')}>{t(`contributions.paymentStatus.${p.status}`)}</td>
                      <td data-label={t('admin.common.actions')}>
                        {/* A1a: solo un pago cobrado (el servidor también lo comprueba). */}
                        {p.status === 'completed' && (
                          <Button
                            variant="outline"
                            aria-label={t('admin.payments.refundNamed', {
                              amount: formatCurrency(p.amount),
                              name: adoptante,
                            })}
                            onClick={() => setADevolver(p)}
                          >
                            {t('admin.payments.refund')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <Pagination
            page={pagos.data.meta.page}
            totalPages={pagos.data.meta.totalPages}
            onChange={(p) => cambiar({ page: String(p) })}
          />
        </>
      )}

      <Modal
        open={aDevolver !== null}
        title={t('admin.payments.confirmRefund')}
        onClose={() => setADevolver(null)}
        footer={
          <>
            <Button variant="outline" data-autofocus onClick={() => setADevolver(null)}>
              {t('admin.adoptions.back')}
            </Button>
            <Button disabled={devolver.isPending} onClick={() => aDevolver && devolver.mutate(aDevolver.id)}>
              {t('admin.payments.refund')}
            </Button>
          </>
        }
      >
        {aDevolver && (
          <>
            <p>
              {t('admin.payments.refundSummary', {
                amount: formatCurrency(aDevolver.amount),
                name: `${aDevolver.adopter.firstName} ${aDevolver.adopter.lastName}`,
                animal: aDevolver.animal.name,
              })}
            </p>
            <p>
              {t(
                aDevolver.method === 'cash' || aDevolver.method === 'bank_transfer'
                  ? 'admin.payments.refundManual'
                  : 'admin.payments.refundOnline',
              )}
            </p>
            <p>{t('admin.payments.refundKeepsAdoption')}</p>
          </>
        )}
      </Modal>
    </div>
  );
}
