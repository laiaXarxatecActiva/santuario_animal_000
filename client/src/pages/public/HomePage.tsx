import { faHandHoldingHeart, faHeart } from '@fortawesome/free-solid-svg-icons';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AdoptionSteps } from '../../components/AdoptionSteps';
import { Alert } from '../../components/Alert';
import { AnimalCard } from '../../components/AnimalCard';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import { Button, ButtonLink } from '../../components/Button';
import { CardSkeletons } from '../../components/CardSkeleton';
import { useHome } from '../../hooks/usePublicData';
import styles from './HomePage.module.css';

// CU-01 Consultar la página de inicio (SCREENS §3.1).
export function HomePage() {
  const { t } = useTranslation();
  const home = useHome();
  const destacados = home.data?.featured ?? [];
  // La foto destacada es la portada del primer animal destacado.
  const fotoDestacada = destacados[0]?.coverPhoto ?? null;

  return (
    <>
      <section className={`container ${styles.hero}`}>
        <div className={styles.heroText}>
          <h1 className={styles.display}>{t('home.title')}</h1>
          <hr className="decorative-rule" />
          <p className={styles.intro}>{t('home.intro')}</p>
          <div className={styles.ctas}>
            <ButtonLink to="/animals" icon={faHandHoldingHeart}>
              {t('home.ctaAdopt')}
            </ButtonLink>
            <ButtonLink to="/donate" variant="secondary" icon={faHeart}>
              {t('home.ctaDonate')}
            </ButtonLink>
          </div>
        </div>
        <AnimalPhoto photo={fotoDestacada} lazy={false} className={styles.heroPhoto} />
      </section>

      {home.data && (
        <section className={styles.band}>
          <p className={`container ${styles.counter}`}>
            <Trans i18nKey="home.sheltered" count={home.data.shelteredCount} />
          </p>
        </section>
      )}

      {home.isPending && (
        <div className={`container ${styles.section}`}>
          <CardSkeletons count={4} />
        </div>
      )}

      {home.isError && (
        <div className={`container ${styles.section}`}>
          <Alert
            type="error"
            title={t('home.errorLoading')}
            action={
              <Button variant="outline" onClick={() => void home.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        </div>
      )}

      {destacados.length > 0 && (
        <section className={`container ${styles.section}`} aria-labelledby="destacados">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="destacados">{t('home.featuredTitle')}</h2>
              <hr className="decorative-rule" />
            </div>
            <Link to="/animals" className={styles.seeAll}>
              {t('home.seeAll')} ›
            </Link>
          </div>
          <ul className={`card-grid ${styles.featured}`}>
            {destacados.map((animal) => (
              <li key={animal.id}>
                <AnimalCard animal={animal} />
              </li>
            ))}
          </ul>
          <ButtonLink to="/animals" variant="outline" block className={styles.seeAllMobile}>
            {t('home.seeAllAnimals')}
          </ButtonLink>
        </section>
      )}

      <section className={`container ${styles.section}`} aria-labelledby="como-funciona">
        <h2 id="como-funciona">{t('home.stepsTitle')}</h2>
        <hr className="decorative-rule" />
        <AdoptionSteps />
        <ButtonLink to="/how-it-works" variant="outline" className={styles.learnMore}>
          {t('home.learnMore')}
        </ButtonLink>
      </section>
    </>
  );
}
