import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { BarChart } from '../../components/charts/BarChart';
import { BarList } from '../../components/charts/BarList';
import { TextField } from '../../components/FormFields';
import { useAdminStats } from '../../hooks/useAdmin';
import { formatCurrency, formatCurrencyAxis, formatNumber, formatShortMonth } from '../../utils/format';
import pageStyles from './AdminPage.module.css';
import styles from './StatsAdminPage.module.css';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const dia = (valor: string | null) => (valor && DIA.test(valor) ? valor : undefined);

// CU-41 Consultar estadísticas (solo administrador, solo lectura).
export function StatsAdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const rango = { from: dia(params.get('from')), to: dia(params.get('to')) };
  const stats = useAdminStats(rango);

  const cambiar = (clave: 'from' | 'to', valor: string) => {
    const siguiente = new URLSearchParams(params);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    setParams(siguiente);
  };

  const datos = stats.data;
  const meses = (lista: { month: string }[]) => lista.map((m) => formatShortMonth(m.month));

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.header}>
        <h1>{t('admin.stats.title')}</h1>
      </div>

      {/* Paso 2: por defecto, los últimos 12 meses. */}
      <search className={pageStyles.filters}>
        <TextField
          type="date"
          label={t('admin.stats.from')}
          value={params.get('from') ?? ''}
          onChange={(e) => cambiar('from', e.target.value)}
        />
        <TextField
          type="date"
          label={t('admin.stats.to')}
          value={params.get('to') ?? ''}
          onChange={(e) => cambiar('to', e.target.value)}
        />
      </search>

      {stats.isError && (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void stats.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.stats.loadError')}
        </Alert>
      )}

      {datos && (
        <>
          <p className={styles.note}>
            {t('admin.stats.range', { from: formatShortMonth(datos.range.from), to: formatShortMonth(datos.range.to) })}
          </p>
          <div className={styles.grid}>
            <section className={styles.card}>
              <h2>{t('admin.stats.revenue')}</h2>
              <BarChart
                title={t('admin.stats.revenue')}
                labels={meses(datos.revenueByMonth)}
                formatAxis={formatCurrencyAxis}
                series={[
                  {
                    name: t('admin.stats.fees'),
                    values: datos.revenueByMonth.map((m) => Number(m.fees)),
                    display: datos.revenueByMonth.map((m) => formatCurrency(m.fees)),
                  },
                  {
                    name: t('admin.stats.donations'),
                    values: datos.revenueByMonth.map((m) => Number(m.donations)),
                    display: datos.revenueByMonth.map((m) => formatCurrency(m.donations)),
                  },
                ]}
              />
            </section>

            <section className={styles.card}>
              <h2>{t('admin.stats.adoptions')}</h2>
              <BarChart
                title={t('admin.stats.adoptions')}
                labels={meses(datos.adoptionsByMonth)}
                formatAxis={formatNumber}
                series={[
                  {
                    name: t('admin.stats.started'),
                    values: datos.adoptionsByMonth.map((m) => m.started),
                    display: datos.adoptionsByMonth.map((m) => formatNumber(m.started)),
                  },
                  {
                    name: t('admin.stats.ended'),
                    values: datos.adoptionsByMonth.map((m) => m.ended),
                    display: datos.adoptionsByMonth.map((m) => formatNumber(m.ended)),
                  },
                ]}
              />
            </section>

            <section className={styles.card}>
              <h2>{t('admin.stats.mostAdopted')}</h2>
              <p className={styles.note}>{t('admin.stats.currentNote')}</p>
              <BarList
                label={t('admin.stats.mostAdopted')}
                items={datos.mostAdopted.map((f) => ({
                  key: f.animal.id,
                  label: <Link to={`/admin/animals/${f.animal.id}`}>{f.animal.name}</Link>,
                  value: f.activeAdoptions,
                  display: formatNumber(f.activeAdoptions),
                }))}
              />
            </section>

            <section className={styles.card}>
              <h2>{t('admin.stats.byPlan')}</h2>
              <p className={styles.note}>{t('admin.stats.currentNote')}</p>
              <BarList
                label={t('admin.stats.byPlan')}
                items={datos.activeByPlan.map((p) => ({
                  key: p.plan.id,
                  label: p.plan.name,
                  value: p.count,
                  display: formatNumber(p.count),
                }))}
              />
            </section>

            <section className={styles.card}>
              <h2>{t('admin.stats.withoutAdopters')}</h2>
              <p className={styles.note}>{t('admin.stats.currentNote')}</p>
              {datos.withoutAdopters.length === 0 ? (
                <p className={styles.note}>{t('admin.stats.allAdopted')}</p>
              ) : (
                <ul className={styles.list}>
                  {datos.withoutAdopters.map((a) => (
                    <li key={a.id}>
                      <Link to={`/admin/animals/${a.id}`}>{a.name}</Link>
                      <span className={styles.note}>{a.species}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
