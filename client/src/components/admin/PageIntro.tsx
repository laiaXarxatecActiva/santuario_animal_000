import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button';
import styles from './PageIntro.module.css';

const clave = (pagina: string) => `page-intro:${pagina}`;

/**
 * Explicación breve de para qué sirve una página del panel (DESIGN_SYSTEM §8.10),
 * pensada para quien empieza. «Entendido» la oculta en este navegador; el enlace
 * «¿Para qué sirve esta página?» la vuelve a mostrar.
 */
export function PageIntro({ pagina }: { pagina: string }) {
  const { t } = useTranslation();
  const [oculta, setOculta] = useState(() => localStorage.getItem(clave(pagina)) === 'hidden');

  const cambiar = (ocultar: boolean) => {
    setOculta(ocultar);
    if (ocultar) localStorage.setItem(clave(pagina), 'hidden');
    else localStorage.removeItem(clave(pagina));
  };

  if (oculta) {
    return (
      <button type="button" className={styles.show} onClick={() => cambiar(false)}>
        <FontAwesomeIcon icon={faCircleQuestion} aria-hidden="true" />
        {t('admin.intro.show')}
      </button>
    );
  }
  return (
    <div className={styles.intro}>
      <p>{t(`admin.intro.pages.${pagina}`)}</p>
      <Button variant="ghost" onClick={() => cambiar(true)}>
        {t('admin.intro.dismiss')}
      </Button>
    </div>
  );
}
