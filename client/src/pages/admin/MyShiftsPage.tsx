import type { MyShiftDto } from '@sanctuary/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { TextField } from '../../components/FormFields';
import { PageIntro } from '../../components/admin/PageIntro';
import { useMyShifts } from '../../hooks/useWork';
import { formatShortDate, formatTime, formatWeekdayDate } from '../../utils/format';
import styles from './AdminPage.module.css';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const dia = (valor: string) => (DIA.test(valor) ? valor : undefined);

// CU-63: los fichajes propios (SCREENS §5.7, «Mis fichajes»). Sin fechas, las últimas 4 semanas.
export function MyShiftsPage() {
  const { t } = useTranslation();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const consulta = useMyShifts(dia(desde), dia(hasta));
  const datos = consulta.data;

  const duracion = (minutos: number) =>
    t('work.clock.duration', { hours: Math.floor(minutos / 60), minutes: minutos % 60 });
  const hora = (instante: string | null) =>
    instante ? formatTime(instante) : <Badge tone="warning">{t('work.clock.states.pending')}</Badge>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('work.clock.historyTitle')}</h1>
      </div>
      <PageIntro pagina="myShifts" />
      <search className={styles.filters}>
        <TextField
          type="date"
          label={t('admin.payments.from')}
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <TextField
          type="date"
          label={t('admin.payments.to')}
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
      </search>

      {consulta.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void consulta.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('work.clock.loadError')}
        </Alert>
      ) : !datos ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : (
        <>
          <p className={styles.count}>
            {t('work.clock.range', { from: formatShortDate(datos.from), to: formatShortDate(datos.to) })}
          </p>
          {datos.data.length === 0 ? (
            <p>{t('work.clock.historyEmpty')}</p>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t('work.clock.day')}</th>
                    <th scope="col">{t('work.clock.shift')}</th>
                    <th scope="col">{t('work.clock.in')}</th>
                    <th scope="col">{t('work.clock.out')}</th>
                    <th scope="col">{t('work.clock.worked')}</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.data.map((a: MyShiftDto) => (
                    <tr key={a.id}>
                      <td className={styles.nameLink}>{formatWeekdayDate(a.date)}</td>
                      <td data-label={t('work.clock.shift')}>
                        {a.shift.name}{' '}
                        <span className={styles.muted}>
                          {a.shift.startTime}–{a.shift.endTime}
                        </span>
                      </td>
                      <td data-label={t('work.clock.in')}>{hora(a.checkedInAt)}</td>
                      <td data-label={t('work.clock.out')}>{hora(a.checkedOutAt)}</td>
                      <td data-label={t('work.clock.worked')}>
                        {a.workedMinutes === null ? '—' : duracion(a.workedMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                <strong>{t('work.clock.total', { duration: duracion(datos.totalWorkedMinutes) })}</strong>
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
