import { faFileCsv, faMagnifyingGlass, faPlus } from '@fortawesome/free-solid-svg-icons';
import {
  ADMIN_DONATION_SORTS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type AdminDonationListItemDto,
  type AdminDonationSort,
  type PaymentMethod,
  type PaymentStatus,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { adminApi, type AdminDonationsParams } from '../../api/admin';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { ADMIN_DONATIONS_KEY, useAdminDonationMonthlyTotals, useAdminDonations } from '../../hooks/useAdmin';
import { errorMessage } from '../../utils/apiErrors';
import { formatCurrency, formatMonth, formatShortInstant } from '../../utils/format';
import styles from './AdminPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

const PAGE_SIZE = 20;
// Orden fijo de los parámetros en la URL. La exportación usa los mismos, sin la página.
const CLAVES = ['q', 'status', 'method', 'from', 'to', 'sort', 'page'] as const;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MANUALES: readonly PaymentMethod[] = ['cash', 'bank_transfer'];

const entero = (valor: string | null) => (valor && /^\d+$/.test(valor) ? Number(valor) : undefined);
const de = <T extends string>(lista: readonly T[], valor: string | null): T | undefined =>
  (lista as readonly string[]).includes(valor ?? '') ? (valor as T) : undefined;
const dia = (valor: string | null) => (valor && DIA.test(valor) ? valor : undefined);

/** Filtros válidos de la URL; lo que no se reconoce se ignora. */
function leerFiltros(params: URLSearchParams): AdminDonationsParams {
  return {
    q: params.get('q') || undefined,
    status: de<PaymentStatus>(PAYMENT_STATUSES, params.get('status')),
    method: de<PaymentMethod>(PAYMENT_METHODS, params.get('method')),
    from: dia(params.get('from')),
    to: dia(params.get('to')),
    sort: de<AdminDonationSort>(ADMIN_DONATION_SORTS, params.get('sort')),
    page: entero(params.get('page')),
  };
}

/** Paso 4: el CSV se descarga con los mismos filtros (todas las páginas). */
function urlExportacion(filtros: AdminDonationsParams): string {
  const query = new URLSearchParams();
  for (const clave of CLAVES) {
    const valor = filtros[clave];
    if (clave !== 'page' && valor !== undefined) query.set(clave, String(valor));
  }
  return query.size > 0 ? `/api/admin/donations/export.csv?${query.toString()}` : '/api/admin/donations/export.csv';
}

type Aviso = { type: 'success' | 'error'; message: string };
type Pestana = 'list' | 'months';
const PESTANAS: Pestana[] = ['list', 'months'];

// CU-39 Gestionar donaciones (SCREENS §5.3).
export function DonationsAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const [busqueda, setBusqueda] = useState(filtros.q ?? '');
  const [pestana, setPestana] = useState<Pestana>('list');
  const [aDevolver, setADevolver] = useState<AdminDonationListItemDto | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const base = useId();

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
    mutationFn: (id: number) => adminApi.donations.refund(id),
    onSuccess: async () => {
      setADevolver(null);
      setAviso({ type: 'success', message: t('admin.donations.refunded') });
      await queryClient.invalidateQueries({ queryKey: ADMIN_DONATIONS_KEY });
    },
    onError: (error) => {
      setADevolver(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  const moverFoco = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const siguiente = pestana === 'list' ? 'months' : 'list';
    setPestana(siguiente);
    document.getElementById(`${base}-tab-${siguiente}`)?.focus();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('admin.donations.title')}</h1>
        <div className={styles.headerActions}>
          <ButtonLink to={urlExportacion(filtros)} reloadDocument variant="outline" icon={faFileCsv}>
            {t('admin.payments.export')}
          </ButtonLink>
          <ButtonLink to="/admin/donations/new" icon={faPlus}>
            {t('admin.donations.new')}
          </ButtonLink>
        </div>
      </div>
      <PageIntro pagina="donations" />

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
            label={t('admin.donations.searchLabel')}
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
              {t(`admin.donations.status.${estado}`)}
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

      <div role="tablist" aria-label={t('admin.donations.title')} className={styles.tabs}>
        {PESTANAS.map((p) => (
          <button
            key={p}
            id={`${base}-tab-${p}`}
            type="button"
            role="tab"
            aria-selected={pestana === p}
            aria-controls={`${base}-panel-${p}`}
            tabIndex={pestana === p ? 0 : -1}
            className={styles.tab}
            onClick={() => setPestana(p)}
            onKeyDown={moverFoco}
          >
            {t(`admin.donations.tabs.${p}`)}
          </button>
        ))}
      </div>
      <div
        id={`${base}-panel-${pestana}`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${pestana}`}
        className={styles.page}
      >
        {pestana === 'list' ? (
          <Listado filtros={filtros} onPagina={(p) => cambiar({ page: String(p) })} onDevolver={setADevolver} />
        ) : (
          <PorMeses filtros={filtros} />
        )}
      </div>

      <Modal
        open={aDevolver !== null}
        title={t('admin.donations.confirmRefund')}
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
        {aDevolver && <ResumenDevolucion donacion={aDevolver} />}
      </Modal>
    </div>
  );
}

/** Nombre con el que se identifica al donante en el panel. */
function useDonante() {
  const { t } = useTranslation();
  return (d: AdminDonationListItemDto) => d.donorName ?? t('admin.donations.noName');
}

/** A2: qué pasará al devolver y a quién se avisará. */
function ResumenDevolucion({ donacion }: { donacion: AdminDonationListItemDto }) {
  const { t } = useTranslation();
  const donante = useDonante();
  const conEmail = donacion.donorEmail !== null;
  const conCuenta = donacion.userId !== null;
  let avisos = 'admin.donations.noticeNone';
  if (conEmail && conCuenta) avisos = 'admin.donations.noticeBoth';
  else if (conEmail) avisos = 'admin.donations.noticeEmail';
  else if (conCuenta) avisos = 'admin.donations.noticeWeb';
  return (
    <>
      <p>{t('admin.donations.refundSummary', { amount: formatCurrency(donacion.amount), name: donante(donacion) })}</p>
      <p>{t(MANUALES.includes(donacion.method) ? 'admin.donations.refundManual' : 'admin.donations.refundOnline')}</p>
      <p>{t(avisos)}</p>
    </>
  );
}

function Listado({
  filtros,
  onPagina,
  onDevolver,
}: {
  filtros: AdminDonationsParams;
  onPagina: (pagina: number) => void;
  onDevolver: (donacion: AdminDonationListItemDto) => void;
}) {
  const { t } = useTranslation();
  const donante = useDonante();
  const donaciones = useAdminDonations({ ...filtros, pageSize: PAGE_SIZE });

  if (donaciones.isError) {
    return (
      <Alert
        type="error"
        action={
          <Button variant="outline" onClick={() => void donaciones.refetch()}>
            {t('common.retry')}
          </Button>
        }
      >
        {t('admin.donations.loadError')}
      </Alert>
    );
  }
  if (!donaciones.data) return <p aria-busy="true">{t('common.loading')}</p>;
  const { data, meta, totalCollected } = donaciones.data;
  return (
    <>
      {/* Paso 2: la suma la calcula el servidor (solo lo cobrado). */}
      <p className={styles.collected}>{t('admin.donations.collected', { amount: formatCurrency(totalCollected) })}</p>
      <p className={styles.count} aria-live="polite">
        {t('admin.common.results', { count: meta.total })}
      </p>
      {data.length === 0 ? (
        <p>{t('admin.donations.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('contributions.date')}</th>
              <th scope="col">{t('admin.donations.donor')}</th>
              <th scope="col" className={styles.numeric}>
                {t('contributions.amount')}
              </th>
              <th scope="col">{t('admin.donations.message')}</th>
              <th scope="col">{t('admin.payments.method')}</th>
              <th scope="col">{t('admin.payments.status')}</th>
              <th scope="col">{t('admin.common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id}>
                <td>{formatShortInstant(d.date)}</td>
                <td data-label={t('admin.donations.donor')}>
                  {/* El público nunca ve el nombre de una anónima; el administrador sí (CU-05). */}
                  {d.isAnonymous ? (
                    <>
                      <span>{t('admin.donations.anonymous')}</span>
                      {(d.donorName || d.donorEmail) && (
                        <>
                          <br />
                          <small className={styles.muted}>
                            {[d.donorName, d.donorEmail].filter(Boolean).join(' · ')}
                          </small>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span>{donante(d)}</span>
                      {d.donorEmail && (
                        <>
                          <br />
                          <small className={styles.muted}>{d.donorEmail}</small>
                        </>
                      )}
                    </>
                  )}
                </td>
                <td data-label={t('contributions.amount')} className={styles.numeric}>
                  {formatCurrency(d.amount)}
                </td>
                <td data-label={t('admin.donations.message')}>{d.message ?? ''}</td>
                <td data-label={t('admin.payments.method')}>{t(`admin.adoptions.methods.${d.method}`)}</td>
                <td data-label={t('admin.payments.status')}>{t(`admin.donations.status.${d.status}`)}</td>
                <td data-label={t('admin.common.actions')}>
                  {/* A2: solo una donación cobrada (el servidor también lo comprueba). */}
                  {d.status === 'completed' && (
                    <Button
                      variant="outline"
                      aria-label={t('admin.donations.refundNamed', {
                        amount: formatCurrency(d.amount),
                        name: donante(d),
                      })}
                      onClick={() => onDevolver(d)}
                    >
                      {t('admin.payments.refund')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pagination page={meta.page} totalPages={meta.totalPages} onChange={onPagina} />
    </>
  );
}

/** Paso 3: lo cobrado cada mes con los mismos filtros, salvo el estado. */
function PorMeses({ filtros }: { filtros: AdminDonationsParams }) {
  const { t } = useTranslation();
  const meses = useAdminDonationMonthlyTotals(
    { q: filtros.q, method: filtros.method, from: filtros.from, to: filtros.to },
    true,
  );
  if (meses.isError) {
    return (
      <Alert
        type="error"
        action={
          <Button variant="outline" onClick={() => void meses.refetch()}>
            {t('common.retry')}
          </Button>
        }
      >
        {t('admin.donations.loadError')}
      </Alert>
    );
  }
  if (!meses.data) return <p aria-busy="true">{t('common.loading')}</p>;
  return (
    <>
      <p className={styles.count}>{t('admin.donations.monthsHelp')}</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('admin.donations.month')}</th>
            <th scope="col" className={styles.numeric}>
              {t('admin.donations.count')}
            </th>
            <th scope="col" className={styles.numeric}>
              {t('admin.donations.total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {meses.data.data.map((fila) => (
            <tr key={fila.month}>
              <td>{formatMonth(fila.month)}</td>
              <td data-label={t('admin.donations.count')} className={styles.numeric}>
                {fila.count}
              </td>
              <td data-label={t('admin.donations.total')} className={styles.numeric}>
                {formatCurrency(fila.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
