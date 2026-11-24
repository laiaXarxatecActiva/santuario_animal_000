import { faMagnifyingGlass, faPlus } from '@fortawesome/free-solid-svg-icons';
import {
  ADMIN_USER_SORTS,
  ROLES,
  USER_ACCOUNT_STATUSES,
  type AdminUserSort,
  type Role,
  type UserAccountStatus,
} from '@sanctuary/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import type { AdminUsersParams } from '../../api/admin';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { Pagination } from '../../components/Pagination';
import { UserStatusBadge } from '../../components/admin/UserStatusBadge';
import { useAdminUsers } from '../../hooks/useAdmin';
import { formatShortInstant } from '../../utils/format';
import styles from './AdminPage.module.css';
import { PageIntro } from '../../components/admin/PageIntro';

const PAGE_SIZE = 20;
// Orden fijo de los parámetros en la URL.
const CLAVES = ['q', 'role', 'status', 'sort', 'page'] as const;

const entero = (valor: string | null) => (valor && /^\d+$/.test(valor) ? Number(valor) : undefined);
const de = <T extends string>(lista: readonly T[], valor: string | null): T | undefined =>
  (lista as readonly string[]).includes(valor ?? '') ? (valor as T) : undefined;

/** Filtros válidos de la URL; lo que no se reconoce se ignora. */
function leerFiltros(params: URLSearchParams): AdminUsersParams {
  return {
    q: params.get('q') || undefined,
    role: de<Role>(ROLES, params.get('role')),
    status: de<UserAccountStatus>(USER_ACCOUNT_STATUSES, params.get('status')),
    sort: de<AdminUserSort>(ADMIN_USER_SORTS, params.get('sort')),
    page: entero(params.get('page')),
  };
}

// CU-35 Gestionar usuarios: listado (SCREENS §5.3).
export function UsersAdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const usuarios = useAdminUsers({ ...filtros, pageSize: PAGE_SIZE });
  const [busqueda, setBusqueda] = useState(filtros.q ?? '');

  /** Cambia un filtro y vuelve a la primera página. */
  const cambiar = (cambios: Partial<Record<(typeof CLAVES)[number], string | undefined>>) => {
    const actuales = Object.fromEntries(CLAVES.map((c) => [c, params.get(c) ?? undefined]));
    const nuevos: Record<string, string | undefined> = { ...actuales, page: undefined, ...cambios };
    const siguiente = new URLSearchParams();
    for (const clave of CLAVES) {
      const valor = nuevos[clave];
      if (valor) siguiente.set(clave, valor);
    }
    setParams(siguiente);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('admin.users.title')}</h1>
        <ButtonLink to="/admin/users/new" icon={faPlus}>
          {t('admin.users.newWorker')}
        </ButtonLink>
      </div>
      <PageIntro pagina="users" />

      <search className={styles.filters}>
        <form
          role="search"
          className={styles.search}
          onSubmit={(e) => {
            e.preventDefault();
            cambiar({ q: busqueda.trim() || undefined });
          }}
        >
          <TextField
            type="search"
            label={t('admin.users.searchLabel')}
            placeholder={t('admin.animals.searchPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <Button type="submit" variant="outline" icon={faMagnifyingGlass}>
            {t('admin.common.search')}
          </Button>
        </form>
        <SelectField
          label={t('admin.users.role')}
          value={params.get('role') ?? ''}
          onChange={(e) => cambiar({ role: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          {ROLES.map((rol) => (
            <option key={rol} value={rol}>
              {t(`admin.users.roles.${rol}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('admin.users.status')}
          value={params.get('status') ?? ''}
          onChange={(e) => cambiar({ status: e.target.value || undefined })}
        >
          <option value="">{t('form.any')}</option>
          {USER_ACCOUNT_STATUSES.map((estado) => (
            <option key={estado} value={estado}>
              {t(`admin.users.statuses.${estado}`)}
            </option>
          ))}
        </SelectField>
      </search>

      {usuarios.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void usuarios.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.users.loadError')}
        </Alert>
      ) : !usuarios.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : usuarios.data.data.length === 0 ? (
        <p>{t('admin.users.empty')}</p>
      ) : (
        <>
          <p className={styles.count} aria-live="polite">
            {t('admin.common.results', { count: usuarios.data.meta.total })}
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('admin.users.name')}</th>
                <th scope="col">{t('admin.users.email')}</th>
                <th scope="col">{t('admin.users.role')}</th>
                <th scope="col">{t('admin.users.status')}</th>
                <th scope="col">{t('admin.users.createdAt')}</th>
                <th scope="col">{t('admin.users.lastLoginAt')}</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.data.data.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <Link to={`/admin/users/${usuario.id}`} className={styles.nameLink}>
                      {`${usuario.firstName} ${usuario.lastName}`}
                    </Link>
                  </td>
                  <td data-label={t('admin.users.email')}>{usuario.email}</td>
                  <td data-label={t('admin.users.role')}>{t(`admin.users.roles.${usuario.role}`)}</td>
                  <td data-label={t('admin.users.status')}>
                    <UserStatusBadge status={usuario.status} />
                  </td>
                  <td data-label={t('admin.users.createdAt')}>{formatShortInstant(usuario.createdAt)}</td>
                  <td data-label={t('admin.users.lastLoginAt')}>
                    {usuario.lastLoginAt ? formatShortInstant(usuario.lastLoginAt) : t('admin.users.never')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={usuarios.data.meta.page}
            totalPages={usuarios.data.meta.totalPages}
            onChange={(p) => cambiar({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
