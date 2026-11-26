import {
  MANUAL_PAYMENT_METHOD,
  manualPaymentSchema,
  type AdminAdoptionDetailDto,
  type AdoptionAdminAction,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { adminApi } from '../../api/admin';
import { AdoptionStatusBadge } from '../../components/AdoptionStatusBadge';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ApiError } from '../../api/client';
import { Checkbox, TextAreaField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { ADMIN_ADOPTIONS_KEY, ADMIN_PAYMENTS_KEY, useAdminAdoption } from '../../hooks/useAdmin';
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
  const [registrando, setRegistrando] = useState(false);
  const adoptante = `${adopcion.adopter.firstName} ${adopcion.adopter.lastName}`;
  const abierta = ['pending', 'active', 'paused'].includes(adopcion.status);

  const cambiar = useMutation({
    mutationFn: (body: { action: AdoptionAdminAction; notes?: string; refundLastPayment?: boolean }) =>
      adminApi.adoptions.changeStatus(adopcion.id, body),
    onSuccess: async (_datos, body) => {
      setVentana(null);
      setAviso({ type: 'success', message: t(`admin.adoptions.done.${body.action}`) });
      await queryClient.invalidateQueries({ queryKey: ADMIN_ADOPTIONS_KEY });
      await queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_KEY });
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
          {/* CU-38 A2: solo si hay una cuota pendiente (la calcula el servidor). */}
          {adopcion.pendingFee && (
            <Button variant="outline" onClick={() => setRegistrando(true)}>
              {t('admin.payments.register')}
            </Button>
          )}
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
        {/* CU-49: si la tarea de cobro la cobra sola o la paga el adoptante. */}
        <dt>{t('admin.adoptions.paymentMode')}</dt>
        <dd>{t(`paymentMode.${adopcion.paymentMode}`)}</dd>
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
          ultimaCuota={ventana === 'cancel' ? adopcion.lastRefundablePayment : null}
          onConfirmar={(notes, devolver) =>
            cambiar.mutate(devolver ? { action: ventana, notes, refundLastPayment: true } : { action: ventana, notes })
          }
        />
      )}
      {registrando && adopcion.pendingFee && (
        <VentanaPago
          adopcion={adopcion}
          cuota={adopcion.pendingFee}
          onCerrar={() => setRegistrando(false)}
          onTerminar={(resultado) => {
            setRegistrando(false);
            setAviso(resultado);
          }}
        />
      )}
    </div>
  );
}

/** A1 y A3: pide el motivo, que se guarda solo en las notas internas. */
function VentanaMotivo({
  accion,
  enviando,
  ultimaCuota,
  onCerrar,
  onConfirmar,
}: {
  accion: AccionConMotivo;
  enviando: boolean;
  /** CU-38: al cancelar, la última cuota cobrada que se puede devolver. */
  ultimaCuota: { id: number; amount: string } | null;
  onCerrar: () => void;
  onConfirmar: (notas: string, devolver: boolean) => void;
}) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState('');
  const [devolver, setDevolver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = () => {
    if (motivo.trim() === '') {
      setError(t('admin.adoptions.reasonRequired'));
      return;
    }
    onConfirmar(motivo.trim(), devolver);
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
      {ultimaCuota && (
        <Checkbox
          label={t('admin.payments.refundLast', { amount: formatCurrency(ultimaCuota.amount) })}
          checked={devolver}
          onChange={(e) => setDevolver(e.target.checked)}
        />
      )}
    </Modal>
  );
}

/** El importe con coma, como se escribe en castellano: `"5.00"` → `"5,00"`. */
const importeEditable = (importe: string) => importe.replace('.', ',');

/** CU-38 A2: registra la cuota pendiente cobrada fuera de la web. */
function VentanaPago({
  adopcion,
  cuota,
  onCerrar,
  onTerminar,
}: {
  adopcion: AdminAdoptionDetailDto;
  cuota: { periodStart: string; periodEnd: string; amount: string };
  onCerrar: () => void;
  onTerminar: (aviso: Aviso) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [importe, setImporte] = useState(importeEditable(cuota.amount));
  const [errores, setErrores] = useState<Partial<Record<'amount', string>>>({});

  const registrar = useMutation({
    mutationFn: adminApi.payments.create,
    onSuccess: async () => {
      onTerminar({ type: 'success', message: t('admin.payments.registered') });
      await queryClient.invalidateQueries({ queryKey: ADMIN_ADOPTIONS_KEY });
      await queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_KEY });
    },
    onError: (error) => {
      // A2a: aquí «la cuota ya está pagada» se explica como periodo.
      const clave = error instanceof ApiError ? `admin.payments.errors.${error.code}` : '';
      onTerminar({ type: 'error', message: clave && t(clave) !== clave ? t(clave) : errorMessage(t, error) });
    },
  });

  const enviar = () => {
    // Solo se registran a mano las transferencias (no se acepta efectivo).
    const body = { adoptionId: adopcion.id, amount: importe, method: MANUAL_PAYMENT_METHOD };
    // Las mismas reglas que el servidor (esquema compartido), para avisar antes de enviar.
    const resultado = manualPaymentSchema.safeParse(body);
    if (!resultado.success) {
      const nuevos: typeof errores = {};
      for (const issue of resultado.error.issues) {
        const campo = issue.path[0];
        if (campo === 'amount' && !nuevos[campo]) nuevos[campo] = issue.message;
      }
      setErrores(nuevos);
      return;
    }
    registrar.mutate({ adoptionId: adopcion.id, amount: importe, method: resultado.data.method });
  };

  return (
    <Modal
      open
      title={t('admin.payments.registerTitle')}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="outline" data-autofocus onClick={onCerrar}>
            {t('admin.adoptions.back')}
          </Button>
          <Button disabled={registrar.isPending} onClick={enviar}>
            {t('admin.payments.register')}
          </Button>
        </>
      }
    >
      <p>
        {t('admin.payments.feePeriod', {
          from: formatShortDate(cuota.periodStart),
          to: formatShortDate(cuota.periodEnd),
        })}
      </p>
      <p>{t(adopcion.status === 'pending' ? 'admin.payments.activatesPending' : 'admin.payments.advancesBilling')}</p>
      <TextField
        label={t('admin.payments.amountLabel')}
        inputMode="decimal"
        value={importe}
        error={errores.amount}
        onChange={(e) => {
          setImporte(e.target.value);
          setErrores((previos) => ({ ...previos, amount: undefined }));
        }}
      />
      <p>{t('admin.common.byTransfer')}</p>
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
