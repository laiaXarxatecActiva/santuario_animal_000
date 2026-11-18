import type { AdminAdoptionDetailDto, AdoptionAdminAction } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { adminApi } from '../../api/admin';
import { AdoptionStatusBadge } from '../../components/AdoptionStatusBadge';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { TextAreaField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { ADMIN_ADOPTIONS_KEY, useAdminAdoption } from '../../hooks/useAdmin';
import { errorMessage } from '../../utils/apiErrors';
import { formatCurrency, formatShortDate, formatShortInstant } from '../../utils/format';
import { parseId } from '../../utils/routeParams';
import styles from './AdminPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };
/** Acciones que piden el motivo en una ventana. */
type AccionConMotivo = Exclude<AdoptionAdminAction, 'resume'>;

const fecha = (valor: string | null) => (valor ? formatShortDate(valor) : '—');

// CU-37 paso 3 y A1-A3: ficha de la adopción con sus pagos y notas internas.
export function AdoptionAdminPage() {
  const { t } = useTranslation();
  const id = parseId(useParams().id);
  const adopcion = useAdminAdoption(id);

  if (adopcion.isError || id === undefined) {
    return (
      <div className={styles.page}>
        <h1>{t('admin.adoptions.notFound')}</h1>
        <p>
          <Link to="/admin/adoptions">{t('admin.adoptions.backToList')}</Link>
        </p>
      </div>
    );
  }
  if (!adopcion.data) return <p aria-busy="true">{t('common.loading')}</p>;
  return <Ficha adopcion={adopcion.data} />;
}

function Ficha({ adopcion }: { adopcion: AdminAdoptionDetailDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ventana, setVentana] = useState<AccionConMotivo | null>(null);
  const adoptante = `${adopcion.adopter.firstName} ${adopcion.adopter.lastName}`;
  const abierta = ['pending', 'active', 'paused'].includes(adopcion.status);

  const cambiar = useMutation({
    mutationFn: (body: { action: AdoptionAdminAction; notes?: string }) =>
      adminApi.adoptions.changeStatus(adopcion.id, body),
    onSuccess: async (_datos, body) => {
      setVentana(null);
      setAviso({ type: 'success', message: t(`admin.adoptions.done.${body.action}`) });
      await queryClient.invalidateQueries({ queryKey: ADMIN_ADOPTIONS_KEY });
    },
    onError: (error) => {
      setVentana(null);
      setAviso({ type: 'error', message: errorMessage(t, error) });
    },
  });

  return (
    <div className={styles.page}>
      <nav aria-label={t('animalPage.breadcrumb')} className={styles.count}>
        <Link to="/admin/adoptions">{t('admin.adoptions.title')}</Link> › {adopcion.animal.name}
      </nav>
      <div className={styles.header}>
        <h1>{`${adopcion.animal.name} · ${adoptante}`}</h1>
        <div className={styles.headerActions}>
          {/* A1: solo una activa sin baja solicitada (el servidor también lo comprueba). */}
          {adopcion.status === 'active' && !adopcion.cancelRequested && (
            <Button variant="outline" onClick={() => setVentana('pause')}>
              {t('admin.adoptions.pause')}
            </Button>
          )}
          {adopcion.status === 'paused' && (
            <Button disabled={cambiar.isPending} onClick={() => cambiar.mutate({ action: 'resume' })}>
              {t('admin.adoptions.resume')}
            </Button>
          )}
          {abierta && (
            <Button variant="outline" onClick={() => setVentana('cancel')}>
              {t('admin.adoptions.cancel')}
            </Button>
          )}
        </div>
      </div>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      <dl className={styles.details}>
        <dt>{t('admin.adoptions.adopter')}</dt>
        <dd>
          <Link to={`/admin/users/${adopcion.adopter.id}`}>{adoptante}</Link> · {adopcion.adopter.email}
        </dd>
        <dt>{t('admin.adoptions.animal')}</dt>
        <dd>
          <Link to={`/admin/animals/${adopcion.animal.id}`}>{adopcion.animal.name}</Link>
        </dd>
        <dt>{t('admin.adoptions.plan')}</dt>
        <dd>
          {t('admin.adoptions.planAmount', {
            name: adopcion.plan.name,
            amount: formatCurrency(adopcion.plan.monthlyAmount),
          })}
          {adopcion.nextPlan &&
            ` · ${t('admin.adoptions.nextPlan', { name: adopcion.nextPlan.name, amount: formatCurrency(adopcion.nextPlan.monthlyAmount) })}`}
        </dd>
        <dt>{t('admin.adoptions.status')}</dt>
        <dd>
          <AdoptionStatusBadge status={adopcion.status} />
          {adopcion.cancelRequested && adopcion.status === 'active' && ` · ${t('admin.users.cancelRequested')}`}
        </dd>
        {adopcion.endReason && (
          <>
            <dt>{t('admin.adoptions.endReason')}</dt>
            <dd>{t(`admin.adoptions.endReasons.${adopcion.endReason}`)}</dd>
          </>
        )}
        <dt>{t('admin.adoptions.startDate')}</dt>
        <dd>{fecha(adopcion.startDate)}</dd>
        <dt>{t('admin.adoptions.nextBilling')}</dt>
        <dd>{fecha(adopcion.nextBillingDate)}</dd>
        <dt>{t('admin.adoptions.endDate')}</dt>
        <dd>{fecha(adopcion.endDate)}</dd>
        <dt>{t('admin.adoptions.origin')}</dt>
        <dd>
          {adopcion.createdBy
            ? t('admin.adoptions.createdBy', { name: adopcion.createdBy.name })
            : t('admin.adoptions.createdOnline', { date: formatShortInstant(adopcion.createdAt) })}
        </dd>
      </dl>

      <Pagos adopcion={adopcion} />

      <section aria-labelledby="notas" className={styles.page}>
        <h2 id="notas">{t('admin.adoptions.notes')}</h2>
        <p className={styles.preWrap}>{adopcion.notes ?? t('admin.adoptions.noNotes')}</p>
      </section>

      {ventana && (
        <VentanaMotivo
          accion={ventana}
          enviando={cambiar.isPending}
          onCerrar={() => setVentana(null)}
          onConfirmar={(notes) => cambiar.mutate({ action: ventana, notes })}
        />
      )}
    </div>
  );
}

/** A1 y A3: pide el motivo, que se guarda solo en las notas internas. */
function VentanaMotivo({
  accion,
  enviando,
  onCerrar,
  onConfirmar,
}: {
  accion: AccionConMotivo;
  enviando: boolean;
  onCerrar: () => void;
  onConfirmar: (notas: string) => void;
}) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirmar = () => {
    if (motivo.trim() === '') {
      setError(t('admin.adoptions.reasonRequired'));
      return;
    }
    onConfirmar(motivo.trim());
  };

  return (
    <Modal
      open
      title={t(`admin.adoptions.confirm.${accion}`)}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="outline" data-autofocus onClick={onCerrar}>
            {t('admin.adoptions.back')}
          </Button>
          <Button disabled={enviando} onClick={confirmar}>
            {t(`admin.adoptions.${accion}`)}
          </Button>
        </>
      }
    >
      <p>{t(`admin.adoptions.explain.${accion}`)}</p>
      <p>{t('admin.adoptions.notifyAdopter')}</p>
      <TextAreaField
        label={t('admin.adoptions.reason')}
        rows={3}
        value={motivo}
        error={error ?? undefined}
        onChange={(e) => {
          setMotivo(e.target.value);
          setError(null);
        }}
      />
    </Modal>
  );
}

function Pagos({ adopcion }: { adopcion: AdminAdoptionDetailDto }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="pagos" className={styles.page}>
      <h2 id="pagos">{t('admin.adoptions.payments')}</h2>
      {adopcion.payments.length === 0 ? (
        <p>{t('admin.adoptions.noPayments')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('admin.adoptions.period')}</th>
              <th scope="col" className={styles.numeric}>
                {t('contributions.amount')}
              </th>
              <th scope="col">{t('admin.adoptions.method')}</th>
              <th scope="col">{t('contributions.status')}</th>
              <th scope="col">{t('contributions.reference')}</th>
              <th scope="col">{t('admin.adoptions.recordedBy')}</th>
            </tr>
          </thead>
          <tbody>
            {adopcion.payments.map((p) => (
              <tr key={p.id}>
                <td>
                  {t('admin.adoptions.periodRange', {
                    from: formatShortDate(p.periodStart),
                    to: formatShortDate(p.periodEnd),
                  })}
                </td>
                <td data-label={t('contributions.amount')} className={styles.numeric}>
                  {formatCurrency(p.amount)}
                </td>
                <td data-label={t('admin.adoptions.method')}>{t(`admin.adoptions.methods.${p.method}`)}</td>
                <td data-label={t('contributions.status')}>{t(`contributions.paymentStatus.${p.status}`)}</td>
                <td data-label={t('contributions.reference')}>{p.reference}</td>
                <td data-label={t('admin.adoptions.recordedBy')}>{p.recordedBy?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
