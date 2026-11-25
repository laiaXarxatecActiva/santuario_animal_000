import type { HistoryEventDto } from '@sanctuary/shared';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useHistory } from '../hooks/useHistory';
import { formatCurrency, formatShortDate } from '../utils/format';
import { Alert } from './Alert';
import { Button } from './Button';
import { FilterSelect } from './FilterSelect';
import styles from './AdoptionHistory.module.css';

interface AdoptionHistoryProps {
  /** Animales de todas sus adopciones, para el filtro (solo si hay más de uno). */
  animals: readonly { id: number; name: string }[];
}

/** Texto de un suceso (SCREENS §4.2). */
function texto(t: TFunction, suceso: HistoryEventDto): string {
  const name = suceso.animal.name;
  const cuota = {
    name,
    amount: suceso.amount ? formatCurrency(suceso.amount) : '',
    date: suceso.periodStart ? formatShortDate(suceso.periodStart) : '',
  };
  switch (suceso.type) {
    case 'adopted':
      return t('history.events.adopted', { name, plan: suceso.planName });
    case 'payment_completed':
    case 'payment_failed':
    case 'payment_refunded':
      return t(`history.events.${suceso.type}`, cuota);
    case 'plan_change_requested':
    case 'plan_changed':
      return t(`history.events.${suceso.type}`, { name, from: suceso.previousPlanName, to: suceso.planName });
    case 'plan_change_cancelled':
      return t('history.events.plan_change_cancelled', { name, plan: suceso.planName });
    case 'payment_mode_changed':
      return t('history.events.payment_mode_changed', {
        name,
        mode: suceso.paymentMode ? t(`paymentMode.${suceso.paymentMode}`) : '',
      });
    case 'ended': {
      const cierre = t(`history.events.ended_${suceso.endStatus ?? 'finished'}`, { name });
      return suceso.endReason ? `${cierre} ${t(`adoption.endReason.${suceso.endReason}`, { name })}` : cierre;
    }
    default:
      return t(`history.events.${suceso.type}`, { name });
  }
}

/** CU-15: lo que ha pasado en las adopciones durante el último año, de 10 en 10. */
export function AdoptionHistory({ animals }: AdoptionHistoryProps) {
  const { t } = useTranslation();
  const [animalId, setAnimalId] = useState<number | undefined>();
  const historial = useHistory(animalId);
  // Sin repetidos: si llega un suceso nuevo entre una página y otra, el último de
  // una página vuelve a venir al principio de la siguiente.
  const sucesos = [...new Map((historial.data?.pages.flatMap((p) => p.data) ?? []).map((s) => [s.id, s])).values()];

  let contenido;
  if (historial.isError) {
    contenido = (
      <Alert
        type="error"
        title={t('history.error')}
        action={
          <Button variant="outline" onClick={() => void historial.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (!historial.data) {
    contenido = <p className={styles.muted}>{t('common.loading')}</p>;
  } else if (sucesos.length === 0) {
    contenido = <p className={styles.muted}>{t('history.empty')}</p>;
  } else {
    contenido = (
      <>
        <ul className={styles.list}>
          {sucesos.map((suceso) => {
            const animalSeFue = suceso.endReason === 'animal_deceased' || suceso.endReason === 'animal_transferred';
            return (
              <li key={suceso.id} className={styles.item}>
                <time dateTime={suceso.date} className={styles.date}>
                  {formatShortDate(suceso.date)}
                </time>
                <p className={styles.text}>
                  {texto(t, suceso)}
                  {animalSeFue && (
                    <>
                      {' '}
                      <Link to="/animals">{t('myAnimals.continueWithOther')}</Link>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
        {historial.hasNextPage && (
          <div className={styles.more}>
            <Button
              variant="outline"
              disabled={historial.isFetchingNextPage}
              onClick={() => void historial.fetchNextPage()}
            >
              {historial.isFetchingNextPage ? t('common.loading') : t('history.loadMore')}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <section className={styles.history} aria-labelledby="historial-titulo">
      <div className={styles.heading}>
        <div>
          <h2 id="historial-titulo" className={styles.title}>
            {t('history.title')}
          </h2>
          <p className={styles.muted}>{t('history.intro')}</p>
        </div>
        {animals.length > 1 && (
          <FilterSelect
            label={t('history.animal')}
            className={styles.filter}
            labelClassName={styles.label}
            value={animalId === undefined ? '' : String(animalId)}
            options={[
              { value: '', label: t('history.allAnimals') },
              ...animals.map((a) => ({ value: String(a.id), label: a.name })),
            ]}
            onChange={(id) => setAnimalId(id === '' ? undefined : Number(id))}
          />
        )}
      </div>
      {contenido}
      {historial.data && (
        <p className={styles.note}>
          {t('history.olderNote')} <Link to="/my-contributions">{t('history.olderLink')}</Link>
        </p>
      )}
    </section>
  );
}
