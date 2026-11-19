import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { AuthCard } from '../../components/AuthCard';
import { Button } from '../../components/Button';
import { PasswordField, TextField } from '../../components/FormFields';
import { useSetSession } from '../../hooks/useSession';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { homeFor, safeNext } from '../../utils/redirect';
import styles from './AuthPages.module.css';

// CU-09 3c: espera si el servidor no indica cuánto falta (cabecera `Retry-After`).
const ESPERA_POR_DEFECTO_S = 5;

/** Segundos en formato m:ss (125 → «2:05»). */
function formatoEspera(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * CU-09 3c: cuenta atrás del bloqueo por demasiados intentos. Devuelve los
 * segundos que faltan (`null` si no hay bloqueo) y la función para empezarlo.
 */
function useBloqueo(alTerminar: () => void) {
  const [hasta, setHasta] = useState<number | null>(null);
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    if (hasta === null) return;
    const actualizar = () => {
      const segundos = Math.ceil((hasta - Date.now()) / 1000);
      if (segundos > 0) {
        setRestante(segundos);
        return;
      }
      setHasta(null);
      setRestante(null);
      alTerminar();
    };
    actualizar();
    const id = setInterval(actualizar, 250);
    return () => clearInterval(id);
  }, [hasta, alTerminar]);

  const bloquear = (segundos: number) => {
    setRestante(segundos);
    setHasta(Date.now() + segundos * 1000);
  };
  return { restante, bloquear };
}

// CU-09 Iniciar sesión (`/login?next=/ruta`).
export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const setSession = useSetSession();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => {
      // Si ya había otra cuenta abierta en este navegador, sus datos no deben
      // seguir en la caché (igual que al cerrar sesión, CU-11).
      queryClient.clear();
      setSession(user);
      void navigate(homeFor(user, next), { replace: true });
    },
    onError: (error) => {
      // La contraseña no era válida (o no se ha podido comprobar): se borra y se conserva el email.
      setValue('password', '');
      applyFieldErrors(error, setError, ['email', 'password']);
      if (error instanceof ApiError && error.status === 429) bloquear(error.retryAfter ?? ESPERA_POR_DEFECTO_S);
    },
  });
  const { reset: limpiarError } = login;
  const { restante, bloquear } = useBloqueo(limpiarError);
  const bloqueado = restante !== null;

  return (
    <AuthCard title={t('auth.login.title')}>
      {bloqueado ? (
        <Alert type="info">{t('auth.login.locked', { time: formatoEspera(restante) })}</Alert>
      ) : (
        login.isError && <Alert type="error">{errorMessage(t, login.error)}</Alert>
      )}
      <form noValidate onSubmit={handleSubmit((datos) => login.mutate(datos))}>
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
          disabled={bloqueado}
        />
        <PasswordField
          label={t('auth.password')}
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
          disabled={bloqueado}
        />
        <Link to="/forgot-password" className={styles.inlineLink}>
          {t('auth.login.forgot')}
        </Link>
        <Button type="submit" block disabled={login.isPending || bloqueado}>
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
