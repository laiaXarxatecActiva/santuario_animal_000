import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@sanctuary/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authApi } from '../../api/auth';
import { Alert } from '../../components/Alert';
import { AuthCard } from '../../components/AuthCard';
import { Button } from '../../components/Button';
import { Checkbox, PasswordField, TextField } from '../../components/FormFields';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { flashState } from '../../utils/flash';
import { safeNext } from '../../utils/redirect';
import styles from './AuthPages.module.css';
import { conIdioma } from '../../i18n/idioma';

const CAMPOS = ['firstName', 'lastName', 'email', 'password', 'passwordConfirm', 'privacyAccepted'] as const;

// CU-07 Registrarse (`/register?next=/ruta`). El registro no abre sesión: la
// respuesta es la misma tanto si el email es nuevo como si ya tenía cuenta, así
// que después se lleva a iniciar sesión, conservando el destino.
export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', passwordConfirm: '' },
  });

  const registro = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      void navigate(loginHref, {
        replace: true,
        state: flashState({ type: 'success', message: t('auth.register.success') }),
      });
    },
    onError: (error) => applyFieldErrors(error, setError, CAMPOS),
  });

  return (
    <AuthCard title={t('auth.register.title')}>
      <p className={styles.intro}>{t('auth.register.intro')}</p>
      {registro.isError && <Alert type="error">{errorMessage(t, registro.error)}</Alert>}
      <form
        noValidate
        onSubmit={handleSubmit((datos) => registro.mutate({ ...datos, ...conIdioma('preferredLanguage') }))}
      >
        <TextField
          label={t('auth.register.firstName')}
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <TextField
          label={t('auth.register.lastName')}
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label={t('auth.password')}
          autoComplete="new-password"
          help={t('auth.register.passwordHelp')}
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          label={t('auth.register.passwordConfirm')}
          autoComplete="new-password"
          error={errors.passwordConfirm?.message}
          {...register('passwordConfirm')}
        />
        <Checkbox
          label={<Trans i18nKey="auth.register.privacy" components={[<Link key="privacidad" to="/privacy" />]} />}
          error={errors.privacyAccepted?.message}
          {...register('privacyAccepted')}
        />
        <Button type="submit" block disabled={registro.isPending}>
          {registro.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
      </form>
      <hr />
      <p className={styles.footer}>
        {t('auth.register.hasAccount')} <Link to={loginHref}>{t('auth.register.login')}</Link>
      </p>
    </AuthCard>
  );
}
