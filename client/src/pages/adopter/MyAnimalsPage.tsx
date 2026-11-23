import { faCertificate, faDownload, faFeather } from '@fortawesome/free-solid-svg-icons';
import {
  isOpenAdoptionStatus,
  PAYMENT_MODES,
  type AdoptionDto,
  type AdoptionPlanDto,
  type PaymentMode,
  type SimulatedOutcome,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { adoptionsApi } from '../../api/adoptions';
import { ActionsMenu, type ActionsMenuItem } from '../../components/ActionsMenu';
import { AdoptionStatusBadge } from '../../components/AdoptionStatusBadge';
import { Alert } from '../../components/Alert';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import { Button, ButtonLink } from '../../components/Button';
import { CardSkeletons } from '../../components/CardSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { PaymentFailedModal } from '../../components/PaymentFailedModal';
import { PaymentModal } from '../../components/PaymentModal';
import { MY_ADOPTIONS_KEY, useMyAdoptions } from '../../hooks/useAdoptions';
import { CONTRIBUTIONS_KEY } from '../../hooks/useContributions';
import { usePlans } from '../../hooks/usePublicData';
import { errorMessage } from '../../utils/apiErrors';
import { formatCurrency, formatDate, previousDay } from '../../utils/format';
import styles from './MyAnimalsPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };

// CU-15 Consultar «Mis animales» (SCREENS §4.2), con el pago de CU-14, el
// cambio de plan (CU-20) y la baja (CU-21).
export function MyAnimalsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const adopciones = useMyAdoptions();
  const [aPagar, setAPagar] = useState<AdoptionDto | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<AdoptionDto | null>(null);
  /** CU-14 3a: adopción cuyo pago se rechazó, para reintentarlo desde el aviso emergente. */
  const [rechazada, setRechazada] = useState<AdoptionDto | null>(null);
  const [cambiandoPlan, setCambiandoPlan] = useState<number | null>(null);
  const [cambiandoForma, setCambiandoForma] = useState<number | null>(null);

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: MY_ADOPTIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: CONTRIBUTIONS_KEY });
  };

  const cambiarPlan = useMutation({
    mutationFn: ({ adopcion, planId }: { adopcion: AdoptionDto; planId: number }) =>
      adoptionsApi.changePlan(adopcion.id, planId),
    onSuccess: (actualizada) => {
      setCambiandoPlan(null);
      setAviso({
        type: 'success',
        message: actualizada.nextPlan ? t('manageAdoption.planChanged') : t('manageAdoption.planKept'),
      });
    },
    onError: (error) => setAviso({ type: 'error', message: errorMessage(t, error) }),
    onSettled: refrescar,
  });

  // CU-49: forma de pago automática o manual.
  const cambiarForma = useMutation({
    mutationFn: ({ adopcion, paymentMode }: { adopcion: AdoptionDto; paymentMode: PaymentMode }) =>
      adoptionsApi.changePaymentMode(adopcion.id, paymentMode),
    onSuccess: () => {
      setCambiandoForma(null);
      setAviso({ type: 'success', message: t('paymentMode.saved') });
    },
    onError: (error) => setAviso({ type: 'error', message: errorMessage(t, error) }),
    onSettled: refrescar,
  });

  const darDeBaja = useMutation({
    mutationFn: (adopcion: AdoptionDto) => adoptionsApi.cancel(adopcion.id),
    onSuccess: () => setAviso({ type: 'success', message: t('manageAdoption.cancelled') }),
    onError: (error) => setAviso({ type: 'error', message: errorMessage(t, error) }),
    onSettled: () => {
      setADarDeBaja(null);
      refrescar();
    },
  });

  const pagar = useMutation({
    mutationFn: ({ adopcion, outcome }: { adopcion: AdoptionDto; outcome: SimulatedOutcome }) =>
      adoptionsApi.pay(adopcion.id, outcome),
    onSuccess: ({ payment }, { adopcion }) => {
      const nombre = adopcion.animal.name;
      // 3a: el pago rechazado se avisa en una ventana emergente que deja reintentar.
      if (payment.status !== 'completed') {
        setRechazada(adopcion);
        return;
      }
      setAviso({
        type: 'success',
        message:
          adopcion.status === 'pending' ? t('adopt.success', { name: nombre }) : t('adopt.paid', { name: nombre }),
      });
    },
    onError: (error) => setAviso({ type: 'error', message: errorMessage(t, error) }),
    onSettled: () => {
      setAPagar(null);
      void queryClient.invalidateQueries({ queryKey: MY_ADOPTIONS_KEY });
    },
  });

  const abrirPago = (adopcion: AdoptionDto) => {
    setAviso(null);
    setAPagar(adopcion);
  };

  let contenido;
  if (adopciones.isError) {
    contenido = (
      <Alert
        type="error"
        title={t('myAnimals.errorLoading')}
        action={
          <Button variant="outline" onClick={() => void adopciones.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (!adopciones.data) {
    contenido = <CardSkeletons count={2} />;
  } else if (adopciones.data.length === 0) {
    contenido = (
      <EmptyState
        icon={faFeather}
        message={t('myAnimals.empty')}
        action={<ButtonLink to="/animals">{t('myAnimals.seeAnimals')}</ButtonLink>}
      />
    );
  } else {
    // 3: las abiertas primero; las cerradas, en «Historial».
    const abiertas = adopciones.data.filter((a) => isOpenAdoptionStatus(a.status));
    const cerradas = adopciones.data.filter((a) => !isOpenAdoptionStatus(a.status));
    contenido = (
      <>
        {abiertas.length > 0 && (
          <ul className={styles.list}>
            {abiertas.map((adopcion) => (
              <li key={adopcion.id}>
                <TarjetaAdopcion
                  adopcion={adopcion}
                  onPay={() => abrirPago(adopcion)}
                  editandoPlan={cambiandoPlan === adopcion.id}
                  guardandoPlan={cambiarPlan.isPending}
                  onChangePlan={() => {
                    setAviso(null);
                    setCambiandoForma(null);
                    setCambiandoPlan(adopcion.id);
                  }}
                  onSavePlan={(planId) => cambiarPlan.mutate({ adopcion, planId })}
                  onClosePlan={() => setCambiandoPlan(null)}
                  editandoForma={cambiandoForma === adopcion.id}
                  guardandoForma={cambiarForma.isPending}
                  onChangeMode={() => {
                    setAviso(null);
                    setCambiandoPlan(null);
                    setCambiandoForma(adopcion.id);
                  }}
                  onSaveMode={(paymentMode) => cambiarForma.mutate({ adopcion, paymentMode })}
                  onCloseMode={() => setCambiandoForma(null)}
                  onCancel={() => {
                    setAviso(null);
                    setADarDeBaja(adopcion);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        {cerradas.length > 0 && <Historial adopciones={cerradas} />}
      </>
    );
  }

  return (
    <div className="container">
      <h1 className={styles.title}>{t('myAnimals.title')}</h1>
      {aviso && (
        <div className={styles.notice}>
          <Alert type={aviso.type} onClose={() => setAviso(null)}>
            {aviso.message}
          </Alert>
        </div>
      )}
      {contenido}
      <PaymentModal
        open={aPagar !== null}
        concept={aPagar ? t('payment.conceptValue', { name: aPagar.animal.name, plan: planACobrar(aPagar).name }) : ''}
        amount={aPagar ? planACobrar(aPagar).monthlyAmount : '0'}
        processing={pagar.isPending}
        onPay={(outcome) => {
          if (aPagar) pagar.mutate({ adopcion: aPagar, outcome });
        }}
        onClose={() => setAPagar(null)}
      />
      <PaymentFailedModal
        open={rechazada !== null}
        message={t('adopt.paymentFailed')}
        onRetry={() => {
          if (rechazada) abrirPago(rechazada);
          setRechazada(null);
        }}
        onClose={() => setRechazada(null)}
      />
      {aDarDeBaja && (
        <ConfirmarBaja
          adopcion={aDarDeBaja}
          processing={darDeBaja.isPending}
          onConfirm={() => darDeBaja.mutate(aDarDeBaja)}
          onClose={() => setADarDeBaja(null)}
        />
      )}
    </div>
  );
}

/** CU-49: en la cuota manual de una activa se cobra el plan programado, si lo hay (como en CU-43). */
const planACobrar = (adopcion: AdoptionDto) =>
  adopcion.status === 'active' ? (adopcion.nextPlan ?? adopcion.plan) : adopcion.plan;

interface TarjetaProps {
  adopcion: AdoptionDto;
  onPay: () => void;
  editandoPlan: boolean;
  guardandoPlan: boolean;
  onChangePlan: () => void;
  onSavePlan: (planId: number) => void;
  onClosePlan: () => void;
  editandoForma: boolean;
  guardandoForma: boolean;
  onChangeMode: () => void;
  onSaveMode: (paymentMode: PaymentMode) => void;
  onCloseMode: () => void;
  onCancel: () => void;
}

function TarjetaAdopcion({
  adopcion,
  onPay,
  editandoPlan,
  guardandoPlan,
  onChangePlan,
  onSavePlan,
  onClosePlan,
  editandoForma,
  guardandoForma,
  onChangeMode,
  onSaveMode,
  onCloseMode,
  onCancel,
}: TarjetaProps) {
  const { t } = useTranslation();
  const { animal, plan } = adopcion;
  const importe = formatCurrency(plan.monthlyAmount);

  // Las acciones que ofrece la API (CU-20 1a, CU-21): el servidor vuelve a comprobarlas.
  const activaSinBaja = adopcion.status === 'active' && !adopcion.cancelRequested;
  const acciones: ActionsMenuItem[] = [];
  const abiertaSinBaja = activaSinBaja || adopcion.status === 'paused' || adopcion.status === 'pending';
  if (activaSinBaja) acciones.push({ label: t('manageAdoption.changePlan'), onSelect: onChangePlan });
  // CU-49 1a: abierta y sin la baja pedida.
  if (abiertaSinBaja) acciones.push({ label: t('paymentMode.title'), onSelect: onChangeMode });
  if (abiertaSinBaja) acciones.push({ label: t('manageAdoption.cancel'), onSelect: onCancel });

  return (
    <article className={styles.card}>
      {/* La foto también abre la ficha; para teclado y lectores de pantalla ya está «Ver la ficha de…». */}
      <Link to={`/my-animals/${animal.id}`} className={styles.photoLink} aria-hidden="true" tabIndex={-1}>
        <AnimalPhoto photo={animal.coverPhoto} thumbnail className={styles.photo} />
      </Link>
      <div className={styles.body}>
        <div className={styles.heading}>
          <h2 className={styles.name}>{animal.name}</h2>
          <div className={styles.headingEnd}>
            <AdoptionStatusBadge status={adopcion.status} />
            <ActionsMenu label={t('manageAdoption.moreActions', { name: animal.name })} items={acciones} />
          </div>
        </div>
        <p className={styles.muted}>{animal.species}</p>
        <p>
          {adopcion.startDate
            ? t('adoption.planSince', { plan: plan.name, amount: importe, date: formatDate(adopcion.startDate) })
            : t('adoption.plan', { plan: plan.name, amount: importe })}
        </p>
        {adopcion.nextPlan && !adopcion.cancelRequested && (
          <p className={styles.muted}>
            {t('adoption.nextPlan', {
              plan: adopcion.nextPlan.name,
              amount: formatCurrency(adopcion.nextPlan.monthlyAmount),
            })}
          </p>
        )}
        {abiertaSinBaja && (
          <p className={styles.muted}>
            {t(adopcion.paymentMode === 'manual' ? 'paymentMode.cardManual' : 'paymentMode.cardAutomatic')}
          </p>
        )}
        {adopcion.nextUpdateExpected && (
          <p className={styles.muted}>{t('adoption.nextUpdate', { date: formatDate(adopcion.nextUpdateExpected) })}</p>
        )}
        <EstadoPago adopcion={adopcion} onPay={onPay} />
        {editandoPlan && activaSinBaja && (
          <CambioDePlan adopcion={adopcion} saving={guardandoPlan} onSave={onSavePlan} onClose={onClosePlan} />
        )}
        {editandoForma && abiertaSinBaja && (
          <CambioDeFormaDePago adopcion={adopcion} saving={guardandoForma} onSave={onSaveMode} onClose={onCloseMode} />
        )}
        <div className={styles.actions}>
          <ButtonLink to={`/my-animals/${animal.id}`}>{t('myAnimals.seeProfile', { name: animal.name })}</ButtonLink>
          {/* CU-22: certificado en PDF mientras la adopción está activa (1a). */}
          {adopcion.status === 'active' && (
            <>
              <ButtonLink
                variant="outline"
                icon={faCertificate}
                to={`/api/me/adoptions/${adopcion.id}/certificate`}
                reloadDocument
                target="_blank"
                rel="noopener"
                aria-label={t('certificate.viewOf', { name: animal.name })}
              >
                {t('certificate.view')}
              </ButtonLink>
              <ButtonLink
                variant="outline"
                icon={faDownload}
                to={`/api/me/adoptions/${adopcion.id}/certificate?download=1`}
                reloadDocument
                download
                aria-label={t('certificate.downloadOf', { name: animal.name })}
              >
                {t('certificate.download')}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/** Avisos de la tarjeta: baja solicitada (2b), pago pendiente o cuota fallida (CU-14). */
function EstadoPago({ adopcion, onPay }: { adopcion: AdoptionDto; onPay: () => void }) {
  const { t } = useTranslation();
  const nombre = adopcion.animal.name;

  if (adopcion.cancelRequested && adopcion.endDate) {
    return <Alert type="info">{t('adoption.activeUntil', { date: formatDate(adopcion.endDate) })}</Alert>;
  }
  // CU-49: cuota manual que ya se puede pagar, con el último día antes de pausarse.
  if (adopcion.status === 'active' && adopcion.canPay && adopcion.nextBillingDate && adopcion.paymentDeadline) {
    return (
      <Alert type="warning" action={<Button onClick={onPay}>{t('paymentMode.payFee')}</Button>}>
        {t('paymentMode.due', {
          name: nombre,
          date: formatDate(adopcion.nextBillingDate),
          deadline: formatDate(adopcion.paymentDeadline),
        })}
      </Alert>
    );
  }
  if (adopcion.status !== 'pending' && adopcion.status !== 'paused') return null;
  if (!adopcion.canPay) return <Alert type="info">{t('adoption.paymentExpired', { name: nombre })}</Alert>;
  return (
    <Alert type="warning" action={<Button onClick={onPay}>{t('adopt.payNow')}</Button>}>
      {adopcion.status === 'paused'
        ? t('adopt.pausedPayment', { name: nombre })
        : t('adopt.pendingPayment', { name: nombre })}
    </Alert>
  );
}

function Historial({ adopciones }: { adopciones: AdoptionDto[] }) {
  const { t } = useTranslation();
  return (
    <details className={styles.history}>
      <summary className={styles.historyTitle}>{t('myAnimals.history')}</summary>
      <ul className={styles.historyList}>
        {adopciones.map((adopcion) => {
          const animalSeFue = adopcion.endReason === 'animal_deceased' || adopcion.endReason === 'animal_transferred';
          const estado = adopcion.status === 'finished' ? 'finished' : 'cancelled';
          return (
            <li key={adopcion.id} className={styles.historyItem}>
              <strong>{adopcion.animal.name}</strong>
              <span>
                {adopcion.endDate
                  ? t(`adoption.closedOn.${estado}`, { date: formatDate(adopcion.endDate) })
                  : t(`adoption.status.${estado}`)}
              </span>
              {adopcion.endReason && (
                <span>{t(`adoption.endReason.${adopcion.endReason}`, { name: adopcion.animal.name })}</span>
              )}
              {animalSeFue && <Link to="/animals">{t('myAnimals.continueWithOther')}</Link>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** CU-20 pasos 2-3: desplegable en la tarjeta con los planes activos (SCREENS §4.2). */
function CambioDePlan({
  adopcion,
  saving,
  onSave,
  onClose,
}: {
  adopcion: AdoptionDto;
  saving: boolean;
  onSave: (planId: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const planes = usePlans();
  const nombre = useId();
  const inicial = adopcion.nextPlan?.id ?? adopcion.plan.id;
  const [elegido, setElegido] = useState(inicial);

  // El plan actual siempre aparece, aunque ya no se ofrezca a nuevas adopciones.
  const opciones: Pick<AdoptionPlanDto, 'id' | 'name' | 'monthlyAmount'>[] = planes.data ?? [];
  const lista = opciones.some((p) => p.id === adopcion.plan.id) ? opciones : [adopcion.plan, ...opciones];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Elegir lo que ya estaba no cambia nada (3a): se cierra sin llamar a la API.
        if (elegido === inicial) onClose();
        else onSave(elegido);
      }}
    >
      <fieldset className={styles.planForm} disabled={saving}>
        <legend className={styles.planLegend}>{t('manageAdoption.changePlan')}</legend>
        {adopcion.nextBillingDate && (
          <p className={styles.muted}>
            {t('manageAdoption.appliesFrom', { date: formatDate(adopcion.nextBillingDate) })}
          </p>
        )}
        {planes.isError && <Alert type="error">{t('manageAdoption.plansError')}</Alert>}
        {lista.map((plan) => (
          <label key={plan.id} className={styles.planOption}>
            <input
              type="radio"
              name={nombre}
              value={plan.id}
              checked={elegido === plan.id}
              onChange={() => setElegido(plan.id)}
            />
            {t('manageAdoption.planOption', { plan: plan.name, amount: formatCurrency(plan.monthlyAmount) })}
            {plan.id === adopcion.plan.id && ` ${t('manageAdoption.currentPlan')}`}
          </label>
        ))}
        <div className={styles.actions}>
          <Button type="submit">{t('manageAdoption.save')}</Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

/** CU-49: desplegable en la tarjeta para elegir entre el pago automático y el manual. */
function CambioDeFormaDePago({
  adopcion,
  saving,
  onSave,
  onClose,
}: {
  adopcion: AdoptionDto;
  saving: boolean;
  onSave: (paymentMode: PaymentMode) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const nombre = useId();
  const [elegida, setElegida] = useState<PaymentMode>(adopcion.paymentMode);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Elegir la que ya tenía no cambia nada: se cierra sin llamar a la API.
        if (elegida === adopcion.paymentMode) onClose();
        else onSave(elegida);
      }}
    >
      <fieldset className={styles.planForm} disabled={saving}>
        <legend className={styles.planLegend}>{t('paymentMode.title')}</legend>
        <p className={styles.muted}>{t('paymentMode.appliesNext')}</p>
        {PAYMENT_MODES.map((modo) => (
          <label key={modo} className={styles.planOption}>
            <input
              type="radio"
              name={nombre}
              value={modo}
              checked={elegida === modo}
              onChange={() => setElegida(modo)}
            />
            <span>
              <strong>{t(`paymentMode.${modo}`)}</strong> · {t(`paymentMode.${modo}Help`)}
            </span>
          </label>
        ))}
        <div className={styles.actions}>
          <Button type="submit">{t('manageAdoption.save')}</Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

/** CU-21 pasos 2-3: explica qué pasará y pide confirmación. */
function ConfirmarBaja({
  adopcion,
  processing,
  onConfirm,
  onClose,
}: {
  adopcion: AdoptionDto;
  processing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  let explicacion: string;
  if (adopcion.status === 'pending') explicacion = t('manageAdoption.cancelPending');
  else if (adopcion.status === 'paused') explicacion = t('manageAdoption.cancelPaused');
  else if (adopcion.nextBillingDate) {
    explicacion = t('manageAdoption.cancelActive', { date: formatDate(previousDay(adopcion.nextBillingDate)) });
  } else explicacion = t('manageAdoption.cancelActiveNoDate');

  return (
    <Modal
      open
      title={t('manageAdoption.cancelTitle', { name: adopcion.animal.name })}
      closable={!processing}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            {t('manageAdoption.back')}
          </Button>
          <Button onClick={onConfirm} disabled={processing}>
            {t('manageAdoption.confirmCancel')}
          </Button>
        </>
      }
    >
      <p>{explicacion}</p>
    </Modal>
  );
}
