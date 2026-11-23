import { faDownload, faFilePdf } from '@fortawesome/free-solid-svg-icons';
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
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { donationsApi } from '../../api/donations';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { Checkbox, TextAreaField, TextField } from '../../components/FormFields';
import { PaymentFailedModal } from '../../components/PaymentFailedModal';
import { PaymentModal } from '../../components/PaymentModal';
import { ReceiptCard } from '../../components/ReceiptCard';
import { useSession } from '../../hooks/useSession';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import styles from './DonatePage.module.css';
import { conIdioma, idiomaActual } from '../../i18n/idioma';

/** Cantidades sugeridas (SCREENS §3.5); la de 20 € va marcada al entrar. */
const SUGERIDAS = ['5', '10', '20', '50'] as const;
const CAMPOS = [
  'amount',
  'donorName',
  'donorSurname',
  'donorEmail',
  'donorPhone',
  'isAnonymous',
  'message',
  'acceptPrivacy',
  'taxCertificate',
  'donorTaxId',
  'donorAddress',
  'donorPostalCode',
  'donorProvince',
  'donorCountry',
] as const;

/** CU-05: el recibo (o el certificado) en PDF, con la firma que devuelve la donación. */
const urlRecibo = (d: DonationResultDto) =>
  `/api/donations/${d.id}/receipt.pdf?token=${encodeURIComponent(d.receiptToken)}&lang=${idiomaActual()}`;

// CU-05 Hacer una donación (SCREENS §3.5).
export function DonatePage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const [aPagar, setAPagar] = useState<DonationData | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [hecha, setHecha] = useState<DonationResultDto | null>(null);
  /** 5a: donación cuyo pago se rechazó, para reintentarla desde el aviso emergente. */
  const [rechazada, setRechazada] = useState<DonationData | null>(null);
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
    defaultValues: {
      amount: '20',
      donorName: '',
      donorSurname: '',
      donorEmail: '',
      donorPhone: '',
      isAnonymous: false,
      message: '',
      taxCertificate: false,
      donorCountry: t('donate.defaultCountry'),
    },
  });

  // 2: un adoptante encuentra sus datos ya escritos (si no los ha cambiado).
  useEffect(() => {
    if (!user || isWorkerRole(user.role)) return;
    if (!getValues('donorName')) setValue('donorName', user.firstName);
    if (!getValues('donorSurname')) setValue('donorSurname', user.lastName);
    if (!getValues('donorEmail')) setValue('donorEmail', user.email);
  }, [user, getValues, setValue]);

  const donar = useMutation({
    mutationFn: ({ datos, outcome }: { datos: DonationData; outcome: SimulatedOutcome }) =>
      donationsApi.donate({ ...datos, simulatedOutcome: outcome, ...conIdioma('language') }),
    onSuccess: (resultado, { datos }) => {
      if (resultado.status === 'completed') setHecha(resultado);
      else setRechazada(datos);
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
        <Alert type="success">{t('donate.thanksEmail')}</Alert>
        <ReceiptCard
          titleAs="h2"
          concept={t('contributions.donation')}
          amount={hecha.amount}
          method={hecha.method}
          reference={hecha.reference}
          paidAt={hecha.paidAt ?? ''}
          refundedAt={null}
          payer={{
            fullName: [hecha.donorName, hecha.donorSurname].filter(Boolean).join(' ') || null,
            email: hecha.donorEmail,
          }}
        />
        <div className={styles.thanksActions}>
          <ButtonLink
            variant="outline"
            icon={faFilePdf}
            to={urlRecibo(hecha)}
            reloadDocument
            target="_blank"
            rel="noopener"
          >
            {t('donate.viewReceipt')}
          </ButtonLink>
          <ButtonLink variant="outline" icon={faDownload} to={`${urlRecibo(hecha)}&download=1`} reloadDocument download>
            {t('donate.downloadReceipt')}
          </ButtonLink>
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
  const conCertificado = watch('taxCertificate');
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
          <div className={styles.row}>
            <TextField
              label={t('donate.name')}
              autoComplete="given-name"
              error={errors.donorName?.message}
              {...register('donorName')}
            />
            <TextField
              label={t('donate.surname')}
              autoComplete="family-name"
              error={errors.donorSurname?.message}
              {...register('donorSurname')}
            />
          </div>
          <TextField
            label={t('donate.email')}
            type="email"
            autoComplete="email"
            help={t('donate.emailHelp')}
            error={errors.donorEmail?.message}
            {...register('donorEmail')}
          />
          <TextField
            label={t('donate.phone')}
            type="tel"
            autoComplete="tel-national"
            help={t('donate.phoneHelp')}
            error={errors.donorPhone?.message}
            {...register('donorPhone')}
          />
          <Checkbox label={t('donate.anonymous')} {...register('isAnonymous')} />
          <TextAreaField
            label={t('donate.message')}
            rows={3}
            error={errors.message?.message}
            {...register('message')}
          />
          <Checkbox label={t('donate.taxCertificate')} {...register('taxCertificate')} />
          {conCertificado && (
            <fieldset className={styles.tax}>
              <legend className={styles.legend}>{t('donate.taxTitle')}</legend>
              <p className={styles.help}>{t('donate.taxHelp')}</p>
              <TextField
                label={t('donate.taxId')}
                autoComplete="off"
                error={errors.donorTaxId?.message}
                {...register('donorTaxId')}
              />
              <TextField
                label={t('donate.address')}
                autoComplete="street-address"
                error={errors.donorAddress?.message}
                {...register('donorAddress')}
              />
              <div className={styles.row}>
                <TextField
                  label={t('donate.postalCode')}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  error={errors.donorPostalCode?.message}
                  {...register('donorPostalCode')}
                />
                <TextField
                  label={t('donate.province')}
                  autoComplete="address-level1"
                  error={errors.donorProvince?.message}
                  {...register('donorProvince')}
                />
              </div>
              <TextField
                label={t('donate.country')}
                autoComplete="country-name"
                error={errors.donorCountry?.message}
                {...register('donorCountry')}
              />
            </fieldset>
          )}
          <Checkbox
            label={<Trans i18nKey="auth.register.privacy" components={[<Link key="privacidad" to="/privacy" />]} />}
            error={errors.acceptPrivacy?.message}
            {...register('acceptPrivacy')}
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
      <PaymentFailedModal
        open={rechazada !== null}
        message={t('donate.failed')}
        onRetry={() => {
          setAPagar(rechazada);
          setRechazada(null);
        }}
        onClose={() => setRechazada(null)}
      />
    </div>
  );
}
