import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from './Alert';
import { Button } from './Button';
import styles from './CookieNotice.module.css';

// Aviso informativo de cookies técnicas (SCREENS §2.4, TECH_SPEC §13). No
// bloquea nada: solo informa, porque no hay cookies que necesiten permiso.
const CLAVE = 'cookie-notice';

function yaCerrado(): boolean {
  try {
    return localStorage.getItem(CLAVE) === 'accepted';
  } catch {
    return false;
  }
}

export function CookieNotice() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => !yaCerrado());
  if (!visible) return null;

  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE, 'accepted');
    } catch {
      // Sin acceso a localStorage: el aviso volverá a salir en la siguiente visita.
    }
    setVisible(false);
  };

  return (
    <div className={styles.notice}>
      <div className="container">
        <Alert
          type="info"
          label={t('cookieNotice.label')}
          action={
            <div className={styles.actions}>
              <Link to="/cookies">{t('cookieNotice.more')}</Link>
              <Button variant="outline" onClick={cerrar}>
                {t('cookieNotice.accept')}
              </Button>
            </div>
          }
        >
          {t('cookieNotice.text')}
        </Alert>
      </div>
    </div>
  );
}
