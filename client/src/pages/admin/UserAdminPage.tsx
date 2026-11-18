import { isWorkerRole, WORKER_ROLES, type AdminUserDetailDto, type AdminUserPatchBody } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { adminApi } from '../../api/admin';
import { AdoptionStatusBadge } from '../../components/AdoptionStatusBadge';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { UserStatusBadge } from '../../components/admin/UserStatusBadge';
import { ADMIN_USERS_KEY, useAdminUser } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import { errorMessage } from '../../utils/apiErrors';
import { formatCurrency, formatShortDate, formatShortInstant } from '../../utils/format';
import { formatPhone } from '../../utils/phone';
import { parseId } from '../../utils/routeParams';
import styles from './AdminPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };
type RolTrabajador = (typeof WORKER_ROLES)[number];

// CU-35 paso 3 (ficha) y CU-36 4a (reenviar la invitación). SCREENS §5.6.
export function UserAdminPage() {
  const { t } = useTranslation();
  const id = parseId(useParams().id);
  const usuario = useAdminUser(id);

  if (usuario.isError || id === undefined) {
    return (
      <div className={styles.page}>
        <h1>{t('admin.users.notFound')}</h1>
        <p>
          <Link to="/admin/users">{t('admin.users.backToList')}</Link>
        </p>
      </div>
    );
  }
  if (!usuario.data) return <p aria-busy="true">{t('common.loading')}</p>;
  return <Ficha usuario={usuario.data} />;
}

function Ficha({ usuario }: { usuario: AdminUserDetailDto }) {
  const { t } = useTranslation();
  const { user: yo } = useSession();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [rol, setRol] = useState<RolTrabajador>(usuario.role === 'admin' ? 'admin' : 'caretaker');
  const nombre = `${usuario.firstName} ${usuario.lastName}`;
  const esAdoptante = usuario.role === 'adopter';
  const adopcionesAbiertas = usuario.adoptions.some((a) => ['pending', 'active', 'paused'].includes(a.status));

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
  const fallo = (error: unknown) => setAviso({ type: 'error', message: errorMessage(t, error) });

  const cambiar = useMutation({
    mutationFn: (cambios: AdminUserPatchBody) => adminApi.users.update(usuario.id, cambios),
    onSuccess: async (_datos, cambios) => {
      setConfirmando(false);
      const mensaje =
        cambios.role !== undefined
          ? t('admin.users.roleChanged')
          : cambios.isActive
            ? t('admin.users.reactivated')
            : t('admin.users.deactivated');
      setAviso({ type: 'success', message: mensaje });
      await refrescar();
    },
    onError: (error) => {
      setConfirmando(false);
      fallo(error);
    },
  });

  const reenviar = useMutation({
    mutationFn: () => adminApi.users.resendInvitation(usuario.id),
    onSuccess: () =>
      setAviso({ type: 'success', message: t('admin.users.invitationResent', { email: usuario.email }) }),
    onError: fallo,
  });

  return (
    <div className={styles.page}>
      <nav aria-label={t('animalPage.breadcrumb')} className={styles.count}>
        <Link to="/admin/users">{t('admin.users.title')}</Link> › {nombre}
      </nav>
      <div className={styles.header}>
        <h1>{nombre}</h1>
        <div className={styles.headerActions}>
          {usuario.invitationPending && (
            <Button variant="outline" disabled={reenviar.isPending} onClick={() => reenviar.mutate()}>
              {t('admin.users.resendInvitation')}
            </Button>
          )}
          {/* 4b: la propia cuenta no se desactiva (el servidor también lo impide). */}
          {usuario.status === 'active' && usuario.id !== yo?.id && (
            <Button variant="outline" onClick={() => setConfirmando(true)}>
              {t('admin.users.deactivate')}
            </Button>
          )}
          {/* 4c: una cuenta anonimizada no se reactiva. */}
          {usuario.status === 'inactive' && (
            <Button disabled={cambiar.isPending} onClick={() => cambiar.mutate({ isActive: true })}>
              {t('admin.users.reactivate')}
            </Button>
          )}
        </div>
      </div>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      <dl className={styles.details}>
        <dt>{t('admin.users.email')}</dt>
        <dd>{usuario.email}</dd>
        <dt>{t('admin.users.phone')}</dt>
        <dd>{usuario.phone ? formatPhone(usuario.phone) : '—'}</dd>
        <dt>{t('admin.users.role')}</dt>
        <dd>{t(`admin.users.roles.${usuario.role}`)}</dd>
        <dt>{t('admin.users.status')}</dt>
        <dd>
          <UserStatusBadge status={usuario.status} />
        </dd>
        <dt>{t('admin.users.emailVerified')}</dt>
        <dd>{usuario.emailVerified ? t('form.yes') : t('form.no')}</dd>
        <dt>{t('admin.users.createdAt')}</dt>
        <dd>{formatShortInstant(usuario.createdAt)}</dd>
        <dt>{t('admin.users.lastLoginAt')}</dt>
        <dd>{usuario.lastLoginAt ? formatShortInstant(usuario.lastLoginAt) : t('admin.users.never')}</dd>
      </dl>

      {/* A1: el rol solo cambia entre cuidador y administrador. */}
      {isWorkerRole(usuario.role) && usuario.status === 'active' && (
        <form
          className={styles.search}
          onSubmit={(e) => {
            e.preventDefault();
            if (rol !== usuario.role) cambiar.mutate({ role: rol });
          }}
        >
          <SelectField
            label={t('admin.users.role')}
            value={rol}
            onChange={(e) => setRol(e.target.value as RolTrabajador)}
          >
            {WORKER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`admin.users.roles.${r}`)}
              </option>
            ))}
          </SelectField>
          <Button type="submit" variant="outline" disabled={cambiar.isPending}>
            {t('admin.users.changeRole')}
          </Button>
        </form>
      )}

      {esAdoptante && <Adopciones usuario={usuario} />}
      {esAdoptante && <Aportaciones usuario={usuario} />}

      <Modal
        open={confirmando}
        title={t('admin.users.confirmDeactivate', { name: nombre })}
        onClose={() => setConfirmando(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmando(false)}>
              {t('admin.common.cancel')}
            </Button>
            <Button disabled={cambiar.isPending} onClick={() => cambiar.mutate({ isActive: false })}>
              {t('admin.users.deactivateConfirm')}
            </Button>
          </>
        }
      >
        <p>{t('admin.users.deactivateSessions')}</p>
        {esAdoptante && adopcionesAbiertas && <p>{t('admin.users.deactivateAdoptions')}</p>}
      </Modal>
    </div>
  );
}

function Adopciones({ usuario }: { usuario: AdminUserDetailDto }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="adopciones" className={styles.page}>
      <h2 id="adopciones">{t('admin.users.adoptions')}</h2>
      {usuario.adoptions.length === 0 ? (
        <p>{t('admin.users.noAdoptions')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('admin.users.animal')}</th>
              <th scope="col">{t('admin.users.plan')}</th>
              <th scope="col">{t('admin.users.status')}</th>
              <th scope="col">{t('admin.users.startDate')}</th>
              <th scope="col">{t('admin.users.nextBilling')}</th>
            </tr>
          </thead>
          <tbody>
            {usuario.adoptions.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/admin/animals/${a.animal.id}`} className={styles.nameLink}>
                    {a.animal.name}
                  </Link>
                </td>
                <td data-label={t('admin.users.plan')}>{a.plan.name}</td>
                <td data-label={t('admin.users.status')}>
                  <AdoptionStatusBadge status={a.status} />
                  {a.cancelRequested && a.status === 'active' && ` · ${t('admin.users.cancelRequested')}`}
                </td>
                <td data-label={t('admin.users.startDate')}>{a.startDate ? formatShortDate(a.startDate) : '—'}</td>
                <td data-label={t('admin.users.nextBilling')}>
                  {a.nextBillingDate ? formatShortDate(a.nextBillingDate) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Cuotas y donaciones juntas, de la más reciente a la más antigua. */
function Aportaciones({ usuario }: { usuario: AdminUserDetailDto }) {
  const { t } = useTranslation();
  const filas = [
    ...usuario.payments.map((p) => ({
      clave: `p${p.id}`,
      fecha: p.date,
      concepto: t('admin.users.feeFor', { name: p.animal.name }),
      importe: p.amount,
      estado: p.status,
    })),
    ...usuario.donations.map((d) => ({
      clave: `d${d.id}`,
      fecha: d.date,
      concepto: t('contributions.donation'),
      importe: d.amount,
      estado: d.status,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <section aria-labelledby="aportaciones" className={styles.page}>
      <h2 id="aportaciones">{t('admin.users.contributions')}</h2>
      {filas.length === 0 ? (
        <p>{t('contributions.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('contributions.date')}</th>
              <th scope="col">{t('contributions.concept')}</th>
              <th scope="col" className={styles.numeric}>
                {t('contributions.amount')}
              </th>
              <th scope="col">{t('contributions.status')}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave}>
                <td>{formatShortInstant(f.fecha)}</td>
                <td data-label={t('contributions.concept')}>{f.concepto}</td>
                <td data-label={t('contributions.amount')} className={styles.numeric}>
                  {formatCurrency(f.importe)}
                </td>
                <td data-label={t('contributions.status')}>{t(`contributions.paymentStatus.${f.estado}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
