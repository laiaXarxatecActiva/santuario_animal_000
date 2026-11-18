import { zodResolver } from '@hookform/resolvers/zod';
import { MANUAL_PAYMENT_METHODS, manualDonationSchema, type ManualDonationBody } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Checkbox, SelectField, TextAreaField, TextField } from '../../components/FormFields';
import { ADMIN_DONATIONS_KEY } from '../../hooks/useAdmin';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { flashState } from '../../utils/flash';
import { todayInSanctuary } from '../../utils/format';
import styles from './AdminPage.module.css';

const CAMPOS = ['amount', 'date', 'method', 'donorName', 'donorEmail', 'isAnonymous', 'message'] as const;

// CU-39 A1: donación recibida fuera de la web (efectivo o transferencia).
// La fecha propuesta es hoy; se puede elegir un día anterior si se apunta tarde.
export function NewDonationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [hoy] = useState(() => todayInSanctuary());
  const form = useForm<ManualDonationBody>({
    resolver: zodResolver(manualDonationSchema, undefined, { raw: true }),
    defaultValues: {
      amount: '',
      date: hoy,
      method: '' as ManualDonationBody['method'],
      donorName: '',
      donorEmail: '',
      isAnonymous: false,
      message: '',
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const crear = useMutation({
    mutationFn: adminApi.donations.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_DONATIONS_KEY });
      void navigate('/admin/donations', {
        state: flashState({ type: 'success', message: t('admin.donations.created') }),
      });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) applyFieldErrors(e, form.setError, CAMPOS);
      else setError(errorMessage(t, e));
    },
  });

  return (
    <div className={styles.page}>
      <nav aria-label={t('animalPage.breadcrumb')} className={styles.count}>
        <Link to="/admin/donations">{t('admin.donations.title')}</Link> › {t('admin.donations.new')}
      </nav>
      <h1>{t('admin.donations.new')}</h1>
      <form noValidate className={styles.modalForm} onSubmit={handleSubmit((datos) => crear.mutate(datos))}>
        {error && <Alert type="error">{error}</Alert>}
        <TextField
          label={t('admin.payments.amountLabel')}
          inputMode="decimal"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <TextField
          label={t('admin.donations.date')}
          type="date"
          max={hoy}
          help={t('admin.donations.dateHelp')}
          error={errors.date?.message}
          {...register('date')}
        />
        <SelectField label={t('admin.payments.method')} error={errors.method?.message} {...register('method')}>
          <option value="">{t('form.choose')}</option>
          {MANUAL_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`admin.adoptions.methods.${m}`)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('form.optional', { label: t('admin.donations.donorName') })}
          autoComplete="off"
          error={errors.donorName?.message}
          {...register('donorName')}
        />
        <TextField
          label={t('form.optional', { label: t('admin.donations.donorEmail') })}
          type="email"
          autoComplete="off"
          help={t('admin.donations.emailHelp')}
          error={errors.donorEmail?.message}
          {...register('donorEmail')}
        />
        <Checkbox label={t('admin.donations.anonymousLabel')} {...register('isAnonymous')} />
        <TextAreaField
          label={t('form.optional', { label: t('admin.donations.message') })}
          rows={3}
          error={errors.message?.message}
          {...register('message')}
        />
        <div className={styles.headerActions}>
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? t('admin.common.saving') : t('admin.donations.new')}
          </Button>
        </div>
      </form>
    </div>
  );
}
