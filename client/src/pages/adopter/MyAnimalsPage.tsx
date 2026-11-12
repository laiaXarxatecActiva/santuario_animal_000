import { faFeather } from '@fortawesome/free-solid-svg-icons';
import { isOpenAdoptionStatus, type AdoptionDto, type SimulatedOutcome } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { adoptionsApi } from '../../api/adoptions';
import { AdoptionStatusBadge } from '../../components/AdoptionStatusBadge';
import { Alert } from '../../components/Alert';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import { Button, ButtonLink } from '../../components/Button';
import { CardSkeletons } from '../../components/CardSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { PaymentModal } from '../../components/PaymentModal';
import { MY_ADOPTIONS_KEY, useMyAdoptions } from '../../hooks/useAdoptions';
import { errorMessage } from '../../utils/apiErrors';
import { formatCurrency, formatDate } from '../../utils/format';
import styles from './MyAnimalsPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };

// CU-15 Consultar «Mis animales» (SCREENS §4.2), con el pago de CU-14.
export function MyAnimalsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const adopciones = useMyAdoptions();
  const [aPagar, setAPagar] = useState<AdoptionDto | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const pagar = useMutation({
    mutationFn: ({ adopcion, outcome }: { adopcion: AdoptionDto; outcome: SimulatedOutcome }) =>
      adoptionsApi.pay(adopcion.id, outcome),
    onSuccess: ({ payment }, { adopcion }) => {
      const nombre = adopcion.animal.name;
      setAviso(
        payment.status === 'completed'
          ? {
              type: 'success',
              message:
                adopcion.status === 'pending'
                  ? t('adopt.success', { name: nombre })
                  : t('adopt.paid', { name: nombre }),
            }
          : { type: 'error', message: t('adopt.paymentFailed') },
      );
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
                <TarjetaAdopcion adopcion={adopcion} onPay={() => abrirPago(adopcion)} />
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
        concept={aPagar ? t('payment.conceptValue', { name: aPagar.animal.name, plan: aPagar.plan.name }) : ''}
        amount={aPagar?.plan.monthlyAmount ?? '0'}
        processing={pagar.isPending}
        onPay={(outcome) => {
          if (aPagar) pagar.mutate({ adopcion: aPagar, outcome });
        }}
        onClose={() => setAPagar(null)}
      />
    </div>
  );
}

function TarjetaAdopcion({ adopcion, onPay }: { adopcion: AdoptionDto; onPay: () => void }) {
  const { t } = useTranslation();
  const { animal, plan } = adopcion;
  const importe = formatCurrency(plan.monthlyAmount);

  return (
    <article className={styles.card}>
      <AnimalPhoto photo={animal.coverPhoto} thumbnail className={styles.photo} />
      <div className={styles.body}>
        <div className={styles.heading}>
          <h2 className={styles.name}>{animal.name}</h2>
          <AdoptionStatusBadge status={adopcion.status} />
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
        {adopcion.nextUpdateExpected && (
          <p className={styles.muted}>{t('adoption.nextUpdate', { date: formatDate(adopcion.nextUpdateExpected) })}</p>
        )}
        <EstadoPago adopcion={adopcion} onPay={onPay} />
        <div className={styles.actions}>
          <ButtonLink to={`/my-animals/${animal.id}`}>{t('myAnimals.seeProfile', { name: animal.name })}</ButtonLink>
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
