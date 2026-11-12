import { faFeather } from '@fortawesome/free-solid-svg-icons';
import { isOpenAdoptionStatus, type AdoptionDto, type PublicAnimalDto, type SimulatedOutcome } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { adoptionsApi } from '../../api/adoptions';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import { Button, ButtonLink } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PaymentModal } from '../../components/PaymentModal';
import { PlanPicker } from '../../components/PlanPicker';
import { ResendVerificationButton } from '../../components/ResendVerificationButton';
import { MY_ADOPTIONS_KEY, useMyAdoptionsOf } from '../../hooks/useAdoptions';
import { useAnimal, usePlans } from '../../hooks/usePublicData';
import { useSession } from '../../hooks/useSession';
import { errorMessage } from '../../utils/apiErrors';
import { flashState } from '../../utils/flash';
import { formatCurrency } from '../../utils/format';
import { ADOPTER_HOME } from '../../utils/redirect';
import { parseId } from '../../utils/routeParams';
import styles from './AdoptPage.module.css';

const esError = (error: unknown, code: string) => error instanceof ApiError && error.code === code;

// CU-13 Adoptar un animal y CU-14 Reintentar el pago (SCREENS §4.1).
export function AdoptPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const id = parseId(useParams().animalId);
  const { user, isLoading } = useSession();
  const animal = useAnimal(id);

  if (isLoading) return <Cargando />;
  // CU-13 paso 2: sin sesión, se inicia sesión y se vuelve aquí.
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  if (id === undefined || (animal.error instanceof ApiError && animal.error.status === 404)) {
    return (
      <div className="container">
        <EmptyState
          icon={faFeather}
          message={
            <>
              <h1 className={styles.notAvailableTitle}>{t('animalPage.notAvailable')}</h1>
              <span>{t('animalPage.notAvailableText')}</span>
            </>
          }
          action={<ButtonLink to="/animals">{t('animalPage.backToCatalog')}</ButtonLink>}
        />
      </div>
    );
  }
  if (animal.isError) return <ErrorCarga onRetry={() => void animal.refetch()} />;
  if (!animal.data) return <Cargando />;

  const datos = animal.data;
  let contenido;
  if (user.role !== 'adopter') {
    // 2a (RN-03).
    contenido = <Alert type="warning">{t('adopt.workerCannotAdopt')}</Alert>;
  } else if (!user.emailVerified) {
    // 2b: el aviso general de la plantilla no se repite en esta página.
    contenido = (
      <Alert type="warning" action={<ResendVerificationButton />}>
        {t('adopt.verifyFirst')}
      </Alert>
    );
  } else {
    contenido = <Adopcion animal={datos} />;
  }

  return (
    <div className="container">
      <nav aria-label={t('animalPage.breadcrumb')} className={styles.breadcrumb}>
        <ol>
          <li>
            <Link to="/animals">{t('nav.animals')}</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link to={`/animals/${datos.id}`}>{datos.name}</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page">{t('adopt.breadcrumb')}</li>
        </ol>
      </nav>
      <h1>{t('adopt.title', { name: datos.name })}</h1>
      <div className={styles.content}>{contenido}</div>
    </div>
  );
}

function Cargando() {
  const { t } = useTranslation();
  return (
    <div className="container" aria-busy="true">
      <p>{t('common.loading')}</p>
    </div>
  );
}

function ErrorCarga({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="container">
      <Alert
        type="error"
        title={t('adopt.errorLoading')}
        action={
          <Button variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        }
      />
    </div>
  );
}

/** Adoptante verificado: formulario o, si ya tiene una adopción abierta, su estado (5a). */
function Adopcion({ animal }: { animal: PublicAnimalDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mias = useMyAdoptionsOf(animal.id, true);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [pagoFallido, setPagoFallido] = useState(false);

  const pagar = useMutation({
    mutationFn: ({ adopcion, outcome }: { adopcion: AdoptionDto; outcome: SimulatedOutcome }) =>
      adoptionsApi.pay(adopcion.id, outcome),
    onSuccess: ({ adoption, payment }, { adopcion }) => {
      void queryClient.invalidateQueries({ queryKey: ['animal', animal.id] });
      if (payment.status === 'completed') {
        void queryClient.invalidateQueries({ queryKey: MY_ADOPTIONS_KEY });
        const mensaje =
          adopcion.status === 'pending'
            ? t('adopt.success', { name: animal.name })
            : t('adopt.paid', { name: animal.name });
        void navigate(ADOPTER_HOME, { state: flashState({ type: 'success', message: mensaje }) });
        return;
      }
      // 6a: el pago fallido se queda en la página y se puede reintentar.
      queryClient.setQueryData<AdoptionDto[]>([...MY_ADOPTIONS_KEY, animal.id], [adoption]);
      setPagoAbierto(false);
      setPagoFallido(true);
    },
    onError: () => {
      setPagoAbierto(false);
      void queryClient.invalidateQueries({ queryKey: MY_ADOPTIONS_KEY });
    },
  });

  if (mias.isError) return <ErrorCarga onRetry={() => void mias.refetch()} />;
  if (!mias.data) return <Cargando />;

  const abierta = mias.data.find((a) => isOpenAdoptionStatus(a.status));
  if (!abierta) {
    return (
      <Formulario
        animal={animal}
        onCreated={(adopcion) => {
          queryClient.setQueryData<AdoptionDto[]>([...MY_ADOPTIONS_KEY, animal.id], [adopcion]);
          setPagoFallido(false);
          setPagoAbierto(true);
        }}
      />
    );
  }

  const abrirPago = () => {
    pagar.reset();
    setPagoFallido(false);
    setPagoAbierto(true);
  };

  return (
    <>
      {pagar.isError && <Alert type="error">{errorMessage(t, pagar.error)}</Alert>}
      {abierta.canPay ? (
        <Alert
          type={pagoFallido ? 'error' : 'warning'}
          action={<Button onClick={abrirPago}>{t('adopt.payNow')}</Button>}
        >
          {pagoFallido
            ? t('adopt.paymentFailed')
            : abierta.status === 'paused'
              ? t('adopt.pausedPayment', { name: animal.name })
              : t('adopt.pendingPayment', { name: animal.name })}
        </Alert>
      ) : (
        <Alert
          type="info"
          action={
            <ButtonLink variant="outline" to={`/animals/${animal.id}`}>
              {t('adopt.seeAnimal', { name: animal.name })}
            </ButtonLink>
          }
        >
          {t('adopt.alreadyOpen', { name: animal.name })}
        </Alert>
      )}
      <PaymentModal
        open={pagoAbierto && abierta.canPay}
        concept={t('payment.conceptValue', { name: animal.name, plan: abierta.plan.name })}
        amount={abierta.plan.monthlyAmount}
        processing={pagar.isPending}
        onPay={(outcome) => pagar.mutate({ adopcion: abierta, outcome })}
        // 6b: si cierra la ventana, la adopción queda pendiente y puede pagarla después.
        onClose={() => setPagoAbierto(false)}
      />
    </>
  );
}

/** Elegir el plan y crear la adopción pendiente (pasos 3 a 5). */
function Formulario({ animal, onCreated }: { animal: PublicAnimalDto; onCreated: (a: AdoptionDto) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const planes = usePlans();
  const [elegido, setElegido] = useState<number | undefined>();

  const crear = useMutation({
    mutationFn: adoptionsApi.create,
    onSuccess: onCreated,
    onError: (error) => {
      if (esError(error, 'PLAN_NOT_AVAILABLE')) {
        // 5c: se recargan los planes y se pide elegir de nuevo.
        setElegido(undefined);
        void queryClient.invalidateQueries({ queryKey: ['plans'] });
      } else if (esError(error, 'ANIMAL_NOT_ADOPTABLE')) {
        void queryClient.invalidateQueries({ queryKey: ['animal', animal.id] });
      } else if (esError(error, 'ADOPTION_ALREADY_OPEN')) {
        void queryClient.invalidateQueries({ queryKey: MY_ADOPTIONS_KEY });
      }
    },
  });

  if (!animal.isAdoptable) return <Alert type="info">{t('adopt.notAdoptable')}</Alert>;
  if (planes.isError) return <ErrorCarga onRetry={() => void planes.refetch()} />;
  if (!planes.data) return <Cargando />;

  // El plan elegido, si sigue activo; si no, el plan por defecto (Usual).
  const plan = planes.data.find((p) => p.id === elegido) ?? planes.data.find((p) => p.isDefault) ?? planes.data[0];

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (plan) crear.mutate({ animalId: animal.id, planId: plan.id });
      }}
    >
      {crear.isError && <Alert type="error">{errorMessage(t, crear.error)}</Alert>}
      <Alert type="info">{t('adopt.symbolic', { name: animal.name })}</Alert>
      <PlanPicker plans={planes.data} value={plan?.id} onChange={setElegido} disabled={crear.isPending} />

      {plan && (
        <section className={styles.summary} aria-labelledby="adopt-summary">
          <AnimalPhoto photo={animal.coverPhoto} thumbnail className={styles.summaryPhoto} />
          <div>
            <h2 id="adopt-summary" className={styles.summaryTitle}>
              {t('adopt.summary')}
            </h2>
            <p>{t('adopt.summaryPlan', { name: animal.name, plan: plan.name })}</p>
            <p>{t('adopt.summaryAmount', { amount: formatCurrency(plan.monthlyAmount) })}</p>
          </div>
        </section>
      )}

      <div className={styles.actions}>
        <ButtonLink variant="outline" to={`/animals/${animal.id}`}>
          {t('adopt.back')}
        </ButtonLink>
        <Button type="submit" disabled={!plan || crear.isPending}>
          {crear.isPending ? t('adopt.continuing') : t('adopt.continue')}
        </Button>
      </div>
    </form>
  );
}
