import {
  isWorkerRole,
  WORKER_ROLES,
  type AdminUserDetailDto,
  type AdminUserLinkedDataDto,
  type AdminUserPatchBody,
} from '@sanctuary/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { adminApi } from '../../api/admin';
import { AdoptionStatusBadge } from '../../components/AdoptionStatusBadge';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { SelectField, TextAreaField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { ActivityLogTable } from '../../components/admin/ActivityLogTable';
import { UserStatusBadge } from '../../components/admin/UserStatusBadge';
import { UserQualifications } from '../../components/work/UserQualifications';
import { ADMIN_USERS_KEY, adminUserKey, useAdminActivityLogs, useAdminUser } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import { errorMessage } from '../../utils/apiErrors';
import { flashState } from '../../utils/flash';
import { formatCurrency, formatShortDate, formatShortInstant } from '../../utils/format';
import { formatPhone } from '../../utils/phone';
import { parseId } from '../../utils/routeParams';
import styles from './AdminPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };
type RolTrabajador = (typeof WORKER_ROLES)[number];

// CU-35 paso 3 (ficha), CU-36 4a (reenviar la invitación), CU-48 (cerrar sesiones)
// y CU-75/CU-76 (eliminar o anonimizar la cuenta). SCREENS §5.6.
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
  const [cerrandoSesiones, setCerrandoSesiones] = useState(false);
  const [enviandoEnlace, setEnviandoEnlace] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [anonimizando, setAnonimizando] = useState(false);
  const navigate = useNavigate();
  const propia = usuario.id === yo?.id;
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

  // CU-51: el enlace llega al trabajador; el administrador nunca ve la contraseña.
  const enviarCambioPassword = useMutation({
    mutationFn: () => adminApi.users.sendPasswordReset(usuario.id),
    onSuccess: () => {
      setEnviandoEnlace(false);
      setAviso({ type: 'success', message: t('admin.users.passwordResetSent', { email: usuario.email }) });
    },
    onError: (error) => {
      setEnviandoEnlace(false);
      fallo(error);
    },
  });

  const cerrarSesiones = useMutation({
    mutationFn: (reason: string) => adminApi.users.logoutAll(usuario.id, { reason }),
    onSuccess: ({ closedSessions }) => {
      setCerrandoSesiones(false);
      setAviso({ type: 'success', message: t('admin.users.logoutAllDone', { count: closedSessions }) });
    },
    onError: (error) => {
      setCerrandoSesiones(false);
      fallo(error);
    },
  });

  // CU-75: al borrarla, la ficha deja de existir y se vuelve al listado.
  const borrar = useMutation({
    mutationFn: (datos: { force: boolean; reason: string }) =>
      adminApi.users.remove(usuario.id, {
        ...(datos.force ? { force: true } : {}),
        ...(datos.reason ? { reason: datos.reason } : {}),
      }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: adminUserKey(usuario.id) });
      await refrescar();
      await navigate('/admin/users', {
        state: flashState({ type: 'success', message: t('admin.users.deleted', { name: nombre }) }),
      });
    },
    onError: (error) => {
      setEliminando(false);
      fallo(error);
    },
  });

  // CU-76.
  const anonimizar = useMutation({
    mutationFn: (reason: string) => adminApi.users.anonymize(usuario.id, reason ? { reason } : {}),
    onSuccess: async () => {
      setEliminando(false);
      setAnonimizando(false);
      setAviso({ type: 'success', message: t('admin.users.anonymized') });
      await refrescar();
    },
    onError: (error) => {
      setEliminando(false);
      setAnonimizando(false);
      fallo(error);
    },
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
          {/* CU-51 1a: solo a un trabajador activo que no sea quien mira (el servidor también lo comprueba). */}
          {isWorkerRole(usuario.role) && usuario.status === 'active' && usuario.id !== yo?.id && (
            <Button variant="outline" onClick={() => setEnviandoEnlace(true)}>
              {t('admin.users.sendPasswordReset')}
            </Button>
          )}
          {/* CU-48: una cuenta inactiva o anonimizada ya no tiene sesiones. */}
          {usuario.status === 'active' && (
            <Button variant="outline" onClick={() => setCerrandoSesiones(true)}>
              {t('admin.users.logoutAll')}
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
          {/* CU-76: la propia cuenta no se anonimiza, ni una ya anonimizada (el servidor también lo impide). */}
          {!propia && usuario.status !== 'anonymized' && (
            <Button variant="outline" onClick={() => setAnonimizando(true)}>
              {t('admin.users.anonymizeAccount')}
            </Button>
          )}
          {/* CU-75 1a: la propia cuenta no se borra. */}
          {!propia && (
            <Button variant="danger" onClick={() => setEliminando(true)}>
              {t('admin.users.deleteAccount')}
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
      {isWorkerRole(usuario.role) && <UserQualifications userId={usuario.id} />}
      {isWorkerRole(usuario.role) && <Actividad userId={usuario.id} />}

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

      <Modal
        open={enviandoEnlace}
        title={t('admin.users.confirmPasswordReset', { name: nombre })}
        onClose={() => setEnviandoEnlace(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEnviandoEnlace(false)}>
              {t('admin.common.cancel')}
            </Button>
            <Button disabled={enviarCambioPassword.isPending} onClick={() => enviarCambioPassword.mutate()}>
              {t('admin.users.passwordResetConfirm')}
            </Button>
          </>
        }
      >
        <p>{t('admin.users.passwordResetExplain')}</p>
      </Modal>

      {eliminando && (
        <VentanaEliminar
          usuario={usuario}
          nombre={nombre}
          enviando={borrar.isPending || anonimizar.isPending}
          onCerrar={() => setEliminando(false)}
          onBorrar={(force, reason) => borrar.mutate({ force, reason })}
          onAnonimizar={(reason) => anonimizar.mutate(reason)}
        />
      )}

      {anonimizando && (
        <VentanaAnonimizar
          nombre={nombre}
          enviando={anonimizar.isPending}
          onCerrar={() => setAnonimizando(false)}
          onConfirmar={(reason) => anonimizar.mutate(reason)}
        />
      )}

      {cerrandoSesiones && (
        <VentanaCerrarSesiones
          nombre={nombre}
          propia={propia}
          enviando={cerrarSesiones.isPending}
          onCerrar={() => setCerrandoSesiones(false)}
          onConfirmar={(motivo) => cerrarSesiones.mutate(motivo)}
        />
      )}
    </div>
  );
}

/** CU-48 paso 2: pide el motivo, que queda en el registro de actividad (CU-42). */
function VentanaCerrarSesiones({
  nombre,
  propia,
  enviando,
  onCerrar,
  onConfirmar,
}: {
  nombre: string;
  /** 3a: en la propia cuenta se mantiene la sesión actual. */
  propia: boolean;
  enviando: boolean;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirmar = () => {
    if (motivo.trim() === '') {
      setError(t('admin.users.logoutAllReasonRequired'));
      return;
    }
    onConfirmar(motivo.trim());
  };

  return (
    <Modal
      open
      title={t('admin.users.confirmLogoutAll', { name: nombre })}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="outline" data-autofocus onClick={onCerrar}>
            {t('admin.common.cancel')}
          </Button>
          <Button disabled={enviando} onClick={confirmar}>
            {t('admin.users.logoutAllConfirm')}
          </Button>
        </>
      }
    >
      <p>{t('admin.users.logoutAllExplain')}</p>
      {propia && <p>{t('admin.users.logoutAllSelf')}</p>}
      <TextAreaField
        label={t('admin.users.logoutAllReason')}
        rows={3}
        maxLength={500}
        value={motivo}
        error={error ?? undefined}
        onChange={(e) => {
          setMotivo(e.target.value);
          setError(null);
        }}
      />
    </Modal>
  );
}

const DATOS_ENLAZADOS = [
  'adoptions',
  'payments',
  'donations',
  'incidents',
  'handoverNotes',
  'animalUpdates',
  'tasks',
  'activityLogs',
] as const satisfies readonly (keyof AdminUserLinkedDataDto)[];

/**
 * CU-75 pasos 2-3: sin datos enlazados, solo confirma; con datos, los enumera y
 * ofrece cancelar, anonimizar o borrar de todos modos (3a/3b). El motivo es opcional.
 */
function VentanaEliminar({
  usuario,
  nombre,
  enviando,
  onCerrar,
  onBorrar,
  onAnonimizar,
}: {
  usuario: AdminUserDetailDto;
  nombre: string;
  enviando: boolean;
  onCerrar: () => void;
  onBorrar: (force: boolean, motivo: string) => void;
  onAnonimizar: (motivo: string) => void;
}) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState('');
  const datos = useQuery({
    queryKey: [...adminUserKey(usuario.id), 'linked-data'],
    queryFn: () => adminApi.users.linkedData(usuario.id),
    staleTime: 0,
  });
  const conDatos = (datos.data?.total ?? 0) > 0;
  const puedeAnonimizar = usuario.status !== 'anonymized';

  return (
    <Modal
      open
      title={t('admin.users.confirmDelete', { name: nombre })}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="outline" data-autofocus onClick={onCerrar}>
            {t('admin.common.cancel')}
          </Button>
          {datos.data && conDatos && puedeAnonimizar && (
            <Button variant="outline" disabled={enviando} onClick={() => onAnonimizar(motivo.trim())}>
              {t('admin.users.anonymizeConfirm')}
            </Button>
          )}
          {datos.data && (
            <Button variant="danger" disabled={enviando} onClick={() => onBorrar(conDatos, motivo.trim())}>
              {conDatos ? t('admin.users.deleteForce') : t('admin.users.deleteConfirm')}
            </Button>
          )}
        </>
      }
    >
      {datos.isError ? (
        <p>{errorMessage(t, datos.error)}</p>
      ) : !datos.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : (
        <>
          {conDatos && (
            <>
              <p>{t('admin.users.deleteHasData')}</p>
              <ul>
                {DATOS_ENLAZADOS.filter((clave) => datos.data[clave] > 0).map((clave) => (
                  <li key={clave}>{t(`admin.users.linkedData.${clave}`, { count: datos.data[clave] })}</li>
                ))}
              </ul>
            </>
          )}
          {/* Borrar no se puede deshacer: la advertencia es roja. */}
          <Alert type="error">{conDatos ? t('admin.users.deleteForceWarning') : t('admin.users.deleteExplain')}</Alert>
          <TextAreaField
            label={t('admin.users.deleteReason')}
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </>
      )}
    </Modal>
  );
}

/** CU-76 «Borrar datos personales»: explica qué pasará; el motivo es opcional. */
function VentanaAnonimizar({
  nombre,
  enviando,
  onCerrar,
  onConfirmar,
}: {
  nombre: string;
  enviando: boolean;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState('');
  return (
    <Modal
      open
      title={t('admin.users.confirmAnonymize', { name: nombre })}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="outline" data-autofocus onClick={onCerrar}>
            {t('admin.common.cancel')}
          </Button>
          <Button variant="danger" disabled={enviando} onClick={() => onConfirmar(motivo.trim())}>
            {t('admin.users.anonymizeConfirm')}
          </Button>
        </>
      }
    >
      {/* Se conservan los pagos, pero los datos personales no se recuperan: advertencia amarilla. */}
      <Alert type="warning">{t('admin.users.anonymizeExplain')}</Alert>
      <TextAreaField
        label={t('admin.users.deleteReason')}
        rows={3}
        maxLength={500}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
    </Modal>
  );
}

const ACTIVIDAD_RECIENTE = 10;

/** SCREENS §5.6: la actividad reciente de un trabajador (CU-42). */
function Actividad({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const registro = useAdminActivityLogs({ userId, pageSize: ACTIVIDAD_RECIENTE });
  return (
    <section aria-labelledby="actividad" className={styles.page}>
      <h2 id="actividad">{t('admin.activity.workerTitle')}</h2>
      {registro.isError ? (
        <p>{t('admin.activity.loadError')}</p>
      ) : !registro.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : registro.data.data.length === 0 ? (
        <p>{t('admin.activity.workerEmpty')}</p>
      ) : (
        <>
          <ActivityLogTable entries={registro.data.data} showUser={false} />
          {registro.data.meta.total > ACTIVIDAD_RECIENTE && (
            <Link to={`/admin/activity?userId=${userId}`} className={styles.nameLink}>
              {t('admin.activity.seeAll')}
            </Link>
          )}
        </>
      )}
    </section>
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
