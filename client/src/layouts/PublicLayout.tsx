import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { Alert } from '../components/Alert';
import { CookieNotice } from '../components/CookieNotice';
import { Footer } from '../components/Footer';
import { PublicHeader } from '../components/PublicHeader';
import { ResendVerificationButton } from '../components/ResendVerificationButton';
import { useSession } from '../hooks/useSession';
import { readFlash } from '../utils/flash';
import styles from './PublicLayout.module.css';

// Plantilla de la web pública (SCREENS §2).
export function PublicLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useSession();
  // El aviso de la navegación se cierra solo para esta entrada del historial.
  const [flashCerrado, setFlashCerrado] = useState<string | null>(null);
  const flash = flashCerrado === location.key ? undefined : readFlash(location.state);

  // Aviso de página (SCREENS §2.2). En /verify-email y /adopt/… la página ya
  // tiene su propio botón de reenviar.
  const sinVerificar =
    user !== null &&
    user.role === 'adopter' &&
    !user.emailVerified &&
    location.pathname !== '/verify-email' &&
    !location.pathname.startsWith('/adopt/');

  return (
    <>
      <a href="#main" className={styles.skipLink}>
        {t('common.skipToContent')}
      </a>
      <PublicHeader />
      <main id="main" tabIndex={-1} className={styles.main}>
        {(sinVerificar || flash) && (
          <div className={`container ${styles.notices}`}>
            {sinVerificar && (
              <Alert type="warning" action={<ResendVerificationButton />}>
                {t('auth.verify.notice')}
              </Alert>
            )}
            {flash && (
              <Alert type={flash.type} onClose={() => setFlashCerrado(location.key)}>
                {flash.message}
              </Alert>
            )}
          </div>
        )}
        <Outlet />
      </main>
      <Footer />
      <CookieNotice />
    </>
  );
}
