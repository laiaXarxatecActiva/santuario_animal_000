import type { ActivityLogDto } from '@sanctuary/shared';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatShortInstant } from '../../utils/format';
import styles from '../../pages/admin/AdminPage.module.css';

/** Pantalla del panel de cada registro, si la tiene. */
const RUTAS: Partial<Record<string, string>> = {
  animals: '/admin/animals/',
  users: '/admin/users/',
  adoptions: '/admin/adoptions/',
  animal_updates: '/admin/updates/',
};

/** Valor de un detalle: los cambios `[antes, después]` se muestran como «antes → después». */
function valor(dato: unknown): string {
  if (Array.isArray(dato) && dato.length === 2 && dato.every((d) => typeof d !== 'object' || d === null)) {
    return `${String(dato[0])} → ${String(dato[1])}`;
  }
  if (typeof dato === 'object' && dato !== null) return JSON.stringify(dato);
  return String(dato);
}

// CU-42: tabla del registro de actividad (en su pantalla y en la ficha de un trabajador).
export function ActivityLogTable({ entries, showUser = true }: { entries: ActivityLogDto[]; showUser?: boolean }) {
  const { t } = useTranslation();
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">{t('admin.activity.when')}</th>
          {showUser && <th scope="col">{t('admin.activity.user')}</th>}
          <th scope="col">{t('admin.activity.action')}</th>
          <th scope="col">{t('admin.activity.table')}</th>
          <th scope="col">{t('admin.activity.details')}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const tabla = t(`admin.activity.tables.${e.tableName}`, { defaultValue: e.tableName });
          const registro = `${tabla} #${e.recordId}`;
          const ruta = RUTAS[e.tableName];
          const detalles = Object.entries(e.details ?? {});
          return (
            <tr key={e.id}>
              <td>{formatShortInstant(e.createdAt)}</td>
              {showUser && <td data-label={t('admin.activity.user')}>{e.user?.name ?? t('admin.activity.system')}</td>}
              <td data-label={t('admin.activity.action')}>{t(`admin.activity.actions.${e.action}`)}</td>
              <td data-label={t('admin.activity.table')}>
                {ruta && e.action !== 'delete' ? (
                  <Link to={`${ruta}${e.recordId}`} className={styles.nameLink}>
                    {registro}
                  </Link>
                ) : (
                  registro
                )}
              </td>
              <td data-label={t('admin.activity.details')}>
                {detalles.length === 0 ? (
                  '—'
                ) : (
                  <details>
                    <summary>{t('admin.activity.showDetails')}</summary>
                    <dl className={styles.details}>
                      {detalles.map(([clave, dato]) => (
                        <Fragment key={clave}>
                          <dt>{t(`admin.activity.fields.${clave}`, { defaultValue: clave })}</dt>
                          <dd>{valor(dato)}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </details>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
