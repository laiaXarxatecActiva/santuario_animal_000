import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/Alert';
import { formatDate } from '../../utils/format';
import { LEGAL_UPDATED } from './legal';
import styles from './LegalPages.module.css';

// Lo que la web guarda en el navegador: todo técnico (SCREENS §3.9).
const COOKIES = [
  { name: 'sid', purpose: 'sidPurpose', duration: 'sidDuration', type: 'sidType' },
  { name: 'theme', purpose: 'themePurpose', duration: 'untilDeleted', type: 'localStorage' },
  { name: 'cookie-notice', purpose: 'noticePurpose', duration: 'untilDeleted', type: 'localStorage' },
] as const;
const COLUMNAS = ['purpose', 'duration', 'type'] as const;

export function CookiesPage() {
  const { t } = useTranslation();
  return (
    <div className={`container ${styles.page}`}>
      <h1>{t('legal.cookies.title')}</h1>
      <p className={styles.updated}>{t('legal.lastUpdated', { date: formatDate(LEGAL_UPDATED) })}</p>
      <Alert type="info">{t('legal.academicNote')}</Alert>
      <p>{t('legal.cookies.intro')}</p>

      <table className={styles.table}>
        <caption>{t('legal.cookies.tableTitle')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('legal.cookies.name')}</th>
            {COLUMNAS.map((c) => (
              <th key={c} scope="col">
                {t(`legal.cookies.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COOKIES.map((cookie) => (
            <tr key={cookie.name}>
              <td>
                <code>{cookie.name}</code>
              </td>
              {COLUMNAS.map((c) => (
                <td key={c} data-label={t(`legal.cookies.${c}`)}>
                  {t(`legal.cookies.${cookie[c]}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-labelledby="borrar-cookies">
        <h2 id="borrar-cookies">{t('legal.cookies.deleteTitle')}</h2>
        <p>{t('legal.cookies.deleteText')}</p>
      </section>
    </div>
  );
}
