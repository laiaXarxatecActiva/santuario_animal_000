import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { SESSION_KEY } from '../hooks/useSession';
import { errorMessage } from '../utils/apiErrors';
import { Button } from './Button';
import styles from './ResendVerificationButton.module.css';

// CU-08 A1: reenviar el email de verificación.
export function ResendVerificationButton() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const reenviar = useMutation({
    mutationFn: authApi.resendVerification,
    onError: (error) => {
      // Si ya estaba verificado (por ejemplo, desde otra pestaña), se actualiza la sesión.
      if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_VERIFIED') {
        void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      }
    },
  });

  if (reenviar.isSuccess) return <p>{t('auth.verify.resent')}</p>;
  return (
    <div className={styles.wrapper}>
      <Button variant="outline" onClick={() => reenviar.mutate()} disabled={reenviar.isPending}>
        {reenviar.isPending ? t('auth.verify.resending') : t('auth.verify.resend')}
      </Button>
      {reenviar.isError && <p className={styles.error}>{errorMessage(t, reenviar.error)}</p>}
    </div>
  );
}
