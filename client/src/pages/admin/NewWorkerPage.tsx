import { zodResolver } from '@hookform/resolvers/zod';
import { WORKER_ROLES, workerCreateSchema, type WorkerCreateBody } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { ADMIN_USERS_KEY } from '../../hooks/useAdmin';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { flashState } from '../../utils/flash';
import { formatPhone } from '../../utils/phone';
import styles from './AdminPage.module.css';

const CAMPOS = ['firstName', 'lastName', 'email', 'phone', 'role'] as const;

// CU-36 Crear una cuenta de trabajador (SCREENS §5.6).
export function NewWorkerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<WorkerCreateBody>({
    resolver: zodResolver(workerCreateSchema, undefined, { raw: true }),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', role: '' as WorkerCreateBody['role'] },
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  const crear = useMutation({
    mutationFn: adminApi.users.createWorker,
    onSuccess: async (usuario) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      void navigate(`/admin/users/${usuario.id}`, {
        state: flashState({ type: 'success', message: t('admin.users.created', { email: usuario.email }) }),
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
        <Link to="/admin/users">{t('admin.users.title')}</Link> › {t('admin.users.newWorker')}
      </nav>
      <h1>{t('admin.users.newWorker')}</h1>
      <form noValidate className={styles.modalForm} onSubmit={handleSubmit((datos) => crear.mutate(datos))}>
        {error && <Alert type="error">{error}</Alert>}
        <TextField
          label={t('admin.users.firstName')}
          autoComplete="off"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <TextField
          label={t('admin.users.lastName')}
          autoComplete="off"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
        <TextField
          label={t('admin.users.email')}
          type="email"
          autoComplete="off"
          error={errors.email?.message}
          {...register('email')}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextField
              label={t('form.optional', { label: t('admin.users.phone') })}
              type="tel"
              inputMode="numeric"
              help={t('profile.data.phoneHelp')}
              error={errors.phone?.message}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(formatPhone(e.target.value))}
            />
          )}
        />
        <SelectField label={t('admin.users.role')} error={errors.role?.message} {...register('role')}>
          <option value="">{t('form.choose')}</option>
          {WORKER_ROLES.map((rol) => (
            <option key={rol} value={rol}>
              {t(`admin.users.roles.${rol}`)}
            </option>
          ))}
        </SelectField>
        <p className={styles.count}>{t('admin.users.invitationHelp')}</p>
        <div className={styles.headerActions}>
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? t('admin.common.saving') : t('admin.users.create')}
          </Button>
        </div>
      </form>
    </div>
  );
}
