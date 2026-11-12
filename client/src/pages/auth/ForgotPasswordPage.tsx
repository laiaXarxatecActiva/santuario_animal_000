import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@sanctuary/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { authApi } from '../../api/auth';
import { Alert } from '../../components/Alert';
import { AuthCard } from '../../components/AuthCard';
import { Button } from '../../components/Button';
import { TextField } from '../../components/FormFields';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import styles from './AuthPages.module.css';

// CU-10 pasos 1-3: pedir el enlace. La respuesta es siempre la misma.
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  const envio = useMutation({
    mutationFn: authApi.forgotPassword,
    onError: (error) => applyFieldErrors(error, setError, ['email']),
  });

  return (
    <AuthCard title={t('auth.forgot.title')}>
      {envio.isSuccess ? (
        <Alert type="info">{t('auth.forgot.sent')}</Alert>
      ) : (
        <>
          <p className={styles.intro}>{t('auth.forgot.intro')}</p>
          {envio.isError && <Alert type="error">{errorMessage(t, envio.error)}</Alert>}
          <form noValidate onSubmit={handleSubmit((datos) => envio.mutate(datos))}>
            <TextField
              label={t('auth.email')}
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" block disabled={envio.isPending}>
              {envio.isPending ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
            </Button>
          </form>
        </>
      )}
      <hr />
      <p className={styles.footer}>
        <Link to="/login">{t('auth.forgot.backToLogin')}</Link>
      </p>
    </AuthCard>
  );
}
