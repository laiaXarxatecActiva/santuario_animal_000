import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@sanctuary/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authApi } from '../../api/auth';
import { Alert } from '../../components/Alert';
import { AuthCard } from '../../components/AuthCard';
import { Button } from '../../components/Button';
import { PasswordField, TextField } from '../../components/FormFields';
import { useSetSession } from '../../hooks/useSession';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { homeFor, safeNext } from '../../utils/redirect';
import styles from './AuthPages.module.css';

// CU-09 Iniciar sesión (`/login?next=/ruta`).
export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const setSession = useSetSession();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => {
      setSession(user);
      void navigate(homeFor(user, next), { replace: true });
    },
    onError: (error) => applyFieldErrors(error, setError, ['email', 'password']),
  });

  return (
    <AuthCard title={t('auth.login.title')}>
      {login.isError && <Alert type="error">{errorMessage(t, login.error)}</Alert>}
      <form noValidate onSubmit={handleSubmit((datos) => login.mutate(datos))}>
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label={t('auth.password')}
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Link to="/forgot-password" className={styles.inlineLink}>
          {t('auth.login.forgot')}
        </Link>
        <Button type="submit" block disabled={login.isPending}>
          {login.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>
      <hr />
      <p className={styles.footer}>
        {t('auth.login.noAccount')}{' '}
        <Link to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>{t('auth.login.register')}</Link>
      </p>
    </AuthCard>
  );
}
