import { faPlus } from '@fortawesome/free-solid-svg-icons';
import type { DashboardDto, UpdateAlertDto } from '@sanctuary/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { useDashboard } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import styles from './DashboardPage.module.css';

const PLAZO_DIAS = 14;

// CU-27 Consultar el escritorio del panel (SCREENS §5.2). Los ingresos del
// administrador llegan en la fase 2.
export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const escritorio = useDashboard();

  return (
    <div className={styles.page}>
      <h1>{t('admin.dashboard.title', { name: user?.firstName ?? '' })}</h1>
      {escritorio.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void escritorio.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.dashboard.loadError')}
        </Alert>
      ) : escritorio.data ? (
        <Contenido datos={escritorio.data} />
      ) : (
        <div className={styles.skeleton} aria-busy="true" aria-label={t('common.loading')} />
      )}
    </div>
  );
}

function Contenido({ datos }: { datos: DashboardDto }) {
  const { t } = useTranslation();
  const totalAnimales = Object.values(datos.animalsByStatus).reduce((a, b) => a + b, 0);
  const enTratamiento = datos.animalsByStatus.in_treatment;

  return (
    <>
      <ul className={styles.stats} aria-label={t('admin.dashboard.summary')}>
        <Cifra valor={totalAnimales} etiqueta={t('admin.dashboard.animals', { count: totalAnimales })}>
          {enTratamiento > 0 && t('admin.dashboard.inTreatment', { count: enTratamiento })}
        </Cifra>
        <Cifra
          valor={datos.activeAdoptions}
          etiqueta={t('admin.dashboard.activeAdoptions', { count: datos.activeAdoptions })}
        />
        <Cifra valor={datos.pendingAdoptions} etiqueta={t('admin.dashboard.pendingAdoptions')} />
      </ul>

      <section className={styles.alerts} aria-labelledby="alertas">
        <h2 id="alertas">{t('admin.dashboard.alertsTitle')}</h2>
        {datos.updateAlerts.length === 0 ? (
          <Alert type="success">{t('admin.dashboard.allUpToDate')}</Alert>
        ) : (
          datos.updateAlerts.map((alerta) => <AlertaActualizacion key={alerta.animal.id} alerta={alerta} />)
        )}
      </section>

      <section className={styles.quickLinks} aria-labelledby="accesos">
        <h2 id="accesos">{t('admin.dashboard.quickLinks')}</h2>
        <div className={styles.quickLinksList}>
          <ButtonLink to="/admin/animals/new" variant="outline" icon={faPlus}>
            {t('admin.dashboard.newAnimal')}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function Cifra({ valor, etiqueta, children }: { valor: number; etiqueta: string; children?: ReactNode }) {
  return (
    <li className={styles.stat}>
      <span className={styles.value}>{valor}</span>
      <span className={styles.label}>{etiqueta}</span>
      {children && <span className={styles.detail}>{children}</span>}
    </li>
  );
}

/** RN-14: sin botón de cerrar; desaparece al publicar la actualización. */
function AlertaActualizacion({ alerta }: { alerta: UpdateAlertDto }) {
  const { t } = useTranslation();
  const adoptantes = t('admin.dashboard.adopters', { count: alerta.activeAdopters });
  const nombre = alerta.animal.name;
  const texto =
    alerta.level === 'error'
      ? t('admin.dashboard.alertError', { name: nombre, days: alerta.daysWithoutUpdate, adopters: adoptantes })
      : t('admin.dashboard.alertWarning', {
          name: nombre,
          count: PLAZO_DIAS - alerta.daysWithoutUpdate,
          adopters: adoptantes,
        });
  return (
    <Alert
      type={alerta.level}
      action={
        <ButtonLink to={`/admin/updates/new?animalId=${alerta.animal.id}`}>
          {t('admin.dashboard.publishUpdate')}
        </ButtonLink>
      }
    >
      {texto}
    </Alert>
  );
}
