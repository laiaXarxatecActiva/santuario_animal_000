import type { SessionUser } from '@sanctuary/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { onUnauthorized } from '../api/client';
import { flashState } from '../utils/flash';
import { SESSION_KEY } from './useSession';

/**
 * Si una llamada responde 401 mientras había sesión (ha caducado o se ha
 * cerrado en otro dispositivo), vacía la caché y lleva a iniciar sesión,
 * conservando la página para volver después.
 */
export function useSessionExpiry(): void {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(
    () =>
      onUnauthorized(() => {
        if (!queryClient.getQueryData<SessionUser | null>(SESSION_KEY)) return;
        queryClient.clear();
        queryClient.setQueryData(SESSION_KEY, null);
        void navigate(`/login?next=${encodeURIComponent(`${pathname}${search}`)}`, {
          replace: true,
          state: flashState({ type: 'info', message: t('auth.sessionExpired') }),
        });
      }),
    [queryClient, navigate, pathname, search, t],
  );
}
