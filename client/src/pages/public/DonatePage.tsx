import { faPrint } from '@fortawesome/free-solid-svg-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  donationSchema,
  isWorkerRole,
  type DonationData,
  type DonationInput,
  type DonationResultDto,
  type SimulatedOutcome,
} from '@sanctuary/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { donationsApi } from '../../api/donations';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Checkbox, TextAreaField, TextField } from '../../components/FormFields';
import { PaymentModal } from '../../components/PaymentModal';
import { ReceiptCard } from '../../components/ReceiptCard';
import { useSession } from '../../hooks/useSession';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import styles from './DonatePage.module.css';
import { conIdioma } from '../../i18n/idioma';

/** Cantidades sugeridas (SCREENS §3.5); la de 20 € va marcada al entrar. */
const SUGERIDAS = ['5', '10', '20', '50'] as const;
const CAMPOS = ['amount', 'donorName', 'donorEmail', 'isAnonymous', 'message'] as const;

// CU-05 Hacer una donación (SCREENS §3.5).
export function DonatePage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const [aPagar, setAPagar] = useState<DonationData | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [hecha, setHecha] = useState<DonationResultDto | null>(null);
  const grupo = useId();
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    setFocus,
    reset,
    watch,
    formState: { errors },
  } = useForm<DonationInput, unknown, DonationData>({
    resolver: zodResolver(donationSchema),
    defaultValues: { amount: '20', donorName: '', donorEmail: '', isAnonymous: false, message: '' },
  });

  // 2: un adoptante encuentra su nombre y su email ya escritos (si no los ha cambiado).
  useEffect(() => {
    if (!user || isWorkerRole(user.role)) return;
    if (!getValues('donorName')) setValue('donorName', `${user.firstName} ${user.lastName}`);
    if (!getValues('donorEmail')) setValue('donorEmail', user.email);
  }, [user, getValues, setValue]);

  const donar = useMutation({
    mutationFn: ({ datos, outcome }: { datos: DonationData; outcome: SimulatedOutcome }) =>
      donationsApi.donate({ ...datos, simulatedOutcome: outcome, ...conIdioma('language') }),
    onSuccess: (resultado) => {
      if (resultado.status === 'completed') setHecha(resultado);
      else setFallo(t('donate.failed'));
    },
    onError: (error) => {
      applyFieldErrors(error, setError, CAMPOS);
      setFallo(errorMessage(t, error));
    },
    onSettled: () => setAPagar(null),
  });

  if (hecha) {
    return (
      <div className={`container ${styles.thanks}`}>
        <h1 className="visually-hidden">{t('donate.title')}</h1>
        <Alert type="success">{hecha.donorEmail ? t('donate.thanksEmail') : t('donate.thanksNoEmail')}</Alert>
        <ReceiptCard
          titleAs="h2"
          concept={t('contributions.donation')}
          amount={hecha.amount}
          method={hecha.method}
          reference={hecha.reference}
          paidAt={hecha.paidAt ?? ''}
          refundedAt={null}
          payer={{ fullName: hecha.donorName, email: hecha.donorEmail }}
        />
        <div className={styles.thanksActions}>
          <Button variant="outline" icon={faPrint} onClick={() => window.print()}>
            {t('donate.printReceipt')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setHecha(null);
              reset();
            }}
          >
            {t('donate.another')}
          </Button>
        </div>
      </div>
    );
  }

  const importe = watch('amount');
  const sugerida = SUGERIDAS.find((s) => s === importe.trim());

  return (
    <div className={`container ${styles.page}`}>
      <section className={styles.text}>
        <h1>{t('donate.title')}</h1>
        <p className={styles.intro}>{t('donate.intro')}</p>
        <p>{t('donate.where')}</p>
      </section>

      <section className={styles.card} aria-labelledby={`${grupo}-titulo`}>
        <h2 id={`${grupo}-titulo`}>{t('donate.formTitle')}</h2>
        {fallo && (
          <Alert type="error" onClose={() => setFallo(null)}>
            {fallo}
          </Alert>
        )}
        <form
          noValidate
          onSubmit={handleSubmit((datos) => {
            setFallo(null);
            setAPagar(datos);
          })}
        >
          <fieldset className={styles.amounts}>
            <legend className={styles.legend}>{t('donate.howMuch')}</legend>
            <div className={styles.pills}>
              {SUGERIDAS.map((s) => (
                <label key={s} className={styles.pill}>
                  <input
                    type="radio"
                    name={`${grupo}-importe`}
                    checked={sugerida === s}
                    onChange={() => setValue('amount', s, { shouldValidate: errors.amount !== undefined })}
                  />
                  <span>{t('donate.suggested', { amount: s })}</span>
                </label>
              ))}
              <label className={styles.pill}>
                <input
                  type="radio"
                  name={`${grupo}-importe`}
                  checked={sugerida === undefined}
                  onChange={() => {
                    setValue('amount', '');
                    setFocus('amount');
                  }}
                />
                <span>{t('donate.other')}</span>
              </label>
            </div>
            <TextField
              label={t('donate.amount')}
              inputMode="decimal"
              help={t('donate.noMinimum')}
              error={errors.amount?.message}
              {...register('amount')}
            />
          </fieldset>
          <TextField
            label={t('donate.name')}
            autoComplete="name"
            error={errors.donorName?.message}
            {...register('donorName')}
          />
          <TextField
            label={t('donate.email')}
            type="email"
            autoComplete="email"
            help={t('donate.emailHelp')}
            error={errors.donorEmail?.message}
            {...register('donorEmail')}
          />
          {/* CU-39 A2: sin email ni cuenta de adoptante no hay forma de avisarle (p. ej., de una devolución). */}
          {(!user || isWorkerRole(user.role)) && <p className={styles.notice}>{t('donate.noNotices')}</p>}
          <Checkbox label={t('donate.anonymous')} {...register('isAnonymous')} />
          <TextAreaField
            label={t('donate.message')}
            rows={3}
            error={errors.message?.message}
            {...register('message')}
          />
          <Button type="submit" block>
            {t('donate.continue')}
          </Button>
        </form>
      </section>

      <PaymentModal
        open={aPagar !== null}
        concept={t('contributions.donation')}
        amount={aPagar?.amount ?? '0'}
        processing={donar.isPending}
        onPay={(outcome) => {
          if (aPagar) donar.mutate({ datos: aPagar, outcome });
        }}
        onClose={() => setAPagar(null)}
      />
    </div>
  );
}
