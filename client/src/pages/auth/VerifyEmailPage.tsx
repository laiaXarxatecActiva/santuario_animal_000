import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { authApi } from '../../api/auth';
import { Alert } from '../../components/Alert';
import { AuthCard } from '../../components/AuthCard';
import { ButtonLink } from '../../components/Button';
import { ResendVerificationButton } from '../../components/ResendVerificationButton';
import { SESSION_KEY, useSession } from '../../hooks/useSession';
import { errorMessage } from '../../utils/apiErrors';

// CU-08 Verificar el email (`/verify-email?token=...`). Es una consulta y no
// una mutación para que React Query no envíe el token dos veces.
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const queryClient = useQueryClient();
  const { user } = useSession();

  const verificacion = useQuery({
    queryKey: ['verify-email', token],
    queryFn: async () => {
      const resultado = await authApi.verifyEmail(token);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      return resultado;
    },
    enabled: token !== '',
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const puedeReenviar = user !== null && !user.emailVerified;

  return (
    <AuthCard title={t('auth.verify.title')}>
      {token === '' || verificacion.isError ? (
        <>
          <Alert type="error">
            {verificacion.isError ? errorMessage(t, verificacion.error) : t('auth.verify.invalid')}
          </Alert>
          {puedeReenviar && <ResendVerificationButton />}
        </>
      ) : verificacion.data ? (
        <>
          <Alert type={verificacion.data.status === 'verified' ? 'success' : 'info'}>
            {verificacion.data.status === 'verified' ? t('auth.verify.verified') : t('auth.verify.alreadyVerified')}
          </Alert>
          <ButtonLink to="/animals" block>
            {t('auth.verify.seeAnimals')}
          </ButtonLink>
        </>
      ) : (
        <p role="status">{t('auth.verify.checking')}</p>
      )}
    </AuthCard>
  );
}
