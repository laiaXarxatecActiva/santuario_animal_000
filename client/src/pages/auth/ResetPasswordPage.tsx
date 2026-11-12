import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@sanctuary/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { AuthCard } from '../../components/AuthCard';
import { Button } from '../../components/Button';
import { PasswordField } from '../../components/FormFields';
import { useSetSession } from '../../hooks/useSession';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { flashState } from '../../utils/flash';
import styles from './AuthPages.module.css';

// CU-10 pasos 4-6 (`/reset-password?token=...`). También servirá a los
// trabajadores invitados para elegir su contraseña (CU-36).
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const setSession = useSetSession();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', passwordConfirm: '' },
  });

  const cambio = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      // El servidor ha cerrado todas las sesiones de la cuenta.
      setSession(null);
      void navigate('/login', {
        replace: true,
        state: flashState({ type: 'success', message: t('auth.reset.success') }),
      });
    },
    onError: (error) => applyFieldErrors(error, setError, ['password', 'passwordConfirm']),
  });

  const tokenInvalido = token === '' || (cambio.error instanceof ApiError && cambio.error.code === 'INVALID_TOKEN');
  const pedirOtro = (
    <Link to="/forgot-password" className={styles.inlineLink}>
      {t('auth.reset.requestAnother')}
    </Link>
  );

  if (token === '') {
    return (
      <AuthCard title={t('auth.reset.title')}>
        <Alert type="error">{t('auth.verify.invalid')}</Alert>
        {pedirOtro}
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.reset.title')}>
      {cambio.isError && (
        <Alert type="error">
          {errorMessage(t, cambio.error)}
          {tokenInvalido && <span className={styles.linkList}>{pedirOtro}</span>}
        </Alert>
      )}
      <form noValidate onSubmit={handleSubmit((datos) => cambio.mutate(datos))}>
        <PasswordField
          label={t('auth.reset.password')}
          autoComplete="new-password"
          help={t('auth.register.passwordHelp')}
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          label={t('auth.reset.passwordConfirm')}
          autoComplete="new-password"
          error={errors.passwordConfirm?.message}
          {...register('passwordConfirm')}
        />
        <Button type="submit" block disabled={cambio.isPending}>
          {cambio.isPending ? t('auth.reset.submitting') : t('auth.reset.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
