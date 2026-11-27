import { zodResolver } from '@hookform/resolvers/zod';
import {
  changePasswordFormSchema,
  deleteAccountSchema,
  profileFormSchema,
  type ProfileDto,
  type ProfileFormInput,
  type ProfileFormOutput,
} from '@sanctuary/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useBlocker, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { Alert } from '../components/Alert';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { PasswordField, TextField } from '../components/FormFields';
import { Modal } from '../components/Modal';
import { Switch } from '../components/Switch';
import { useChangePassword, useDeleteAccount, useProfile, useUpdateProfile } from '../hooks/useProfile';
import { SESSION_KEY } from '../hooks/useSession';
import { flashState } from '../utils/flash';
import { applyFieldErrors, errorMessage } from '../utils/apiErrors';
import { borradorDe, cambiosDelPerfil, soloCambios, type CampoPerfil } from '../utils/perfil';
import { formatPhone } from '../utils/phone';
import styles from './ProfilePage.module.css';

// CU-23 Gestionar el perfil, CU-24 Cambiar la contraseña y CU-25 Eliminar la
// cuenta (SCREENS §4.6). Datos y preferencias se guardan con un solo botón, en
// una barra fija que solo aparece con cambios y que antes enseña un resumen;
// la contraseña conserva el suyo. El idioma se elige en la cabecera.
export function ProfilePage() {
  const { t } = useTranslation();
  const perfil = useProfile();
  const [perfilSinGuardar, setPerfilSinGuardar] = useState(false);
  const [contrasenaEscrita, setContrasenaEscrita] = useState(false);
  // Tras eliminar la cuenta se va a la portada sin preguntar.
  const cuentaEliminada = useRef(false);
  const hayCambios = perfilSinGuardar || contrasenaEscrita;

  // Salir de la página con cambios sin guardar pide confirmación.
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hayCambios && !cuentaEliminada.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambios]);

  let contenido;
  if (perfil.isError) {
    contenido = (
      <Alert
        type="error"
        title={t('profile.errorLoading')}
        action={
          <Button variant="outline" onClick={() => void perfil.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (!perfil.data) {
    contenido = <p aria-busy="true">{t('common.loading')}</p>;
  } else {
    contenido = (
      <>
        <DatosYPreferencias perfil={perfil.data} onCambios={setPerfilSinGuardar} />
        <Contrasena onEscrita={setContrasenaEscrita} />
        {perfil.data.role === 'adopter' && <EliminarCuenta onEliminada={() => (cuentaEliminada.current = true)} />}
      </>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <h1>{t('profile.title')}</h1>
      {contenido}
      <Modal
        open={bloqueo.state === 'blocked'}
        title={t('profile.unsaved.title')}
        onClose={() => bloqueo.reset?.()}
        footer={
          <>
            <Button variant="outline" data-autofocus onClick={() => bloqueo.reset?.()}>
              {t('profile.unsaved.stay')}
            </Button>
            <Button onClick={() => bloqueo.proceed?.()}>{t('profile.unsaved.leave')}</Button>
          </>
        }
      >
        <p>{t('profile.unsaved.text')}</p>
      </Modal>
    </div>
  );
}

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * Aviso de la sección tras guardar: éxito o error general. Los errores por
 * campo del servidor ya se muestran junto a cada campo.
 */
function Resultado({ ok, error, mensaje }: { ok: boolean; error: unknown; mensaje: string }) {
  const { t } = useTranslation();
  if (error instanceof ApiError && error.details.length > 0) return null;
  if (error) return <Alert type="error">{errorMessage(t, error)}</Alert>;
  return ok ? <Alert type="success">{mensaje}</Alert> : null;
}

const CAMPOS_DATOS = ['firstName', 'lastName', 'phone'] as const;

/**
 * «Tus datos», «Notificaciones» y «Privacidad» (estas dos, solo del adoptante):
 * un único formulario con su barra de guardar y el resumen de los cambios.
 */
function DatosYPreferencias({ perfil, onCambios }: { perfil: ProfileDto; onCambios: (hay: boolean) => void }) {
  const { t } = useTranslation();
  const guardar = useUpdateProfile();
  const adoptante = perfil.role === 'adopter';
  const [revisando, setRevisando] = useState<ProfileFormOutput | null>(null);
  const [guardado, setGuardado] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ProfileFormInput, unknown, ProfileFormOutput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: borradorDe(perfil),
  });
  const borrador = useWatch({ control }) as ProfileFormInput;
  const cambios = cambiosDelPerfil(perfil, borrador);
  const hayCambios = cambios.length > 0;

  useEffect(() => onCambios(hayCambios), [hayCambios, onCambios]);
  // Cualquier cambio nuevo quita el «Cambios guardados».
  useEffect(() => {
    if (hayCambios) setGuardado(false);
  }, [hayCambios]);

  const modificado = (campo: CampoPerfil) =>
    cambios.includes(campo) ? <Badge tone="info">{t('profile.modified')}</Badge> : undefined;

  const descartar = () => {
    reset(borradorDe(perfil));
    guardar.reset();
  };

  // Primero se valida (los errores van a su campo y el foco al primero); luego, el resumen.
  const revisar = handleSubmit((datos) => {
    guardar.reset();
    setRevisando(datos);
  });

  const confirmar = () => {
    if (!revisando) return;
    guardar.mutate(soloCambios(revisando, cambios), {
      onSuccess: (nuevo) => {
        reset(borradorDe(nuevo));
        setGuardado(true);
      },
      onError: (error) => applyFieldErrors(error, setError, CAMPOS_DATOS),
      onSettled: () => setRevisando(null),
    });
  };

  // Cómo se ve cada valor en el resumen.
  const valor = (campo: CampoPerfil, datos: ProfileFormInput): string => {
    switch (campo) {
      case 'firstName':
      case 'lastName':
        return datos[campo].trim();
      case 'phone': {
        const telefono = formatPhone(datos.phone ?? '');
        return telefono === '' ? t('profile.review.noPhone') : telefono;
      }
      case 'emailNotifications':
      case 'showPublicName':
        return datos[campo] ? t('form.yes') : t('form.no');
      case 'emailFrequency':
        return datos.emailFrequency === 'monthly_digest'
          ? t('profile.notifications.monthlyDigest')
          : t('profile.notifications.perUpdate');
    }
  };
  const antes = borradorDe(perfil);

  return (
    <form noValidate onSubmit={(e) => void revisar(e)}>
      <Seccion id="perfil-datos" titulo={t('profile.data.title')}>
        <div className={styles.form}>
          <TextField
            label={t('profile.data.firstName')}
            autoComplete="given-name"
            badge={modificado('firstName')}
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <TextField
            label={t('profile.data.lastName')}
            autoComplete="family-name"
            badge={modificado('lastName')}
            error={errors.lastName?.message}
            {...register('lastName')}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <TextField
                label={t('profile.data.phone')}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                help={t('profile.data.phoneHelp')}
                badge={modificado('phone')}
                error={errors.phone?.message}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatPhone(e.target.value))}
              />
            )}
          />
          <div className={styles.readOnly}>
            <p className={styles.label}>{t('profile.data.email')}</p>
            <p>{perfil.email}</p>
            <p className={styles.help}>{t('profile.data.emailHelp')}</p>
          </div>
        </div>
      </Seccion>

      {adoptante && (
        <Seccion id="perfil-notificaciones" titulo={t('profile.notifications.title')}>
          <div className={styles.form}>
            <Controller
              control={control}
              name="emailNotifications"
              render={({ field }) => (
                <Switch
                  label={t('profile.notifications.receive')}
                  badge={modificado('emailNotifications')}
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              )}
            />
            <Controller
              control={control}
              name="emailFrequency"
              render={({ field }) => (
                <fieldset className={styles.fieldset} disabled={!borrador.emailNotifications}>
                  <legend className={`${styles.label} ${styles.legend}`}>
                    {t('profile.notifications.frequency')}
                    {modificado('emailFrequency')}
                  </legend>
                  {(
                    [
                      ['per_update', 'profile.notifications.perUpdate'],
                      ['monthly_digest', 'profile.notifications.monthlyDigest'],
                    ] as const
                  ).map(([opcion, clave]) => (
                    <label key={opcion} className={styles.radio}>
                      <input
                        type="radio"
                        name={field.name}
                        checked={field.value === opcion}
                        onChange={() => field.onChange(opcion)}
                      />
                      {t(clave)}
                    </label>
                  ))}
                </fieldset>
              )}
            />
          </div>
        </Seccion>
      )}

      {adoptante && (
        <Seccion id="perfil-privacidad" titulo={t('profile.privacy.title')}>
          <Controller
            control={control}
            name="showPublicName"
            render={({ field }) => (
              <Switch
                label={t('profile.privacy.showName')}
                help={t('profile.privacy.showNameHelp')}
                badge={modificado('showPublicName')}
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
              />
            )}
          />
        </Seccion>
      )}

      {(hayCambios || guardado) && (
        <div role="region" aria-label={t('profile.saveBar.label')} className={styles.saveBar}>
          <div className={styles.saveBarContent}>
            {hayCambios ? (
              <>
                <p className={styles.saveBarText}>{t('profile.saveBar.unsaved')}</p>
                <Resultado ok={false} error={guardar.error} mensaje="" />
                <div className={styles.saveBarActions}>
                  <Button variant="outline" onClick={descartar} disabled={guardar.isPending}>
                    {t('profile.discard')}
                  </Button>
                  <Button type="submit" disabled={guardar.isPending}>
                    {guardar.isPending ? t('profile.saving') : t('profile.saveChanges')}
                  </Button>
                </div>
              </>
            ) : (
              <Alert type="success" onClose={() => setGuardado(false)}>
                {t('profile.saved')}
              </Alert>
            )}
          </div>
        </div>
      )}

      <Modal
        open={revisando !== null}
        title={t('profile.review.title')}
        onClose={() => setRevisando(null)}
        closable={!guardar.isPending}
        footer={
          <>
            <Button variant="outline" data-autofocus onClick={() => setRevisando(null)} disabled={guardar.isPending}>
              {t('profile.review.back')}
            </Button>
            <Button onClick={confirmar} disabled={guardar.isPending}>
              {guardar.isPending ? t('profile.saving') : t('profile.review.confirm')}
            </Button>
          </>
        }
      >
        <p>{t('profile.review.intro')}</p>
        <ul className={styles.changes}>
          {cambios.map((campo) => (
            <li key={campo}>
              {t('profile.review.line', {
                field: t(`profile.review.fields.${campo}`),
                before: valor(campo, antes),
                after: valor(campo, borrador),
              })}
            </li>
          ))}
        </ul>
      </Modal>
    </form>
  );
}

const CAMPOS_CONTRASENA = ['currentPassword', 'newPassword', 'newPasswordConfirm'] as const;
const VACIO = { currentPassword: '', newPassword: '', newPasswordConfirm: '' };

function Contrasena({ onEscrita }: { onEscrita: (escrita: boolean) => void }) {
  const { t } = useTranslation();
  const cambiar = useChangePassword();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(changePasswordFormSchema), defaultValues: VACIO });
  // Con algo escrito se puede enviar, y salir de la página pide confirmación.
  const escritas = useWatch({ control });
  const escrita = Object.values(escritas).some((valor) => Boolean(valor));
  useEffect(() => onEscrita(escrita), [escrita, onEscrita]);

  return (
    <Seccion id="perfil-contrasena" titulo={t('profile.password.title')}>
      <form
        noValidate
        className={styles.form}
        onSubmit={handleSubmit(({ currentPassword, newPassword }) =>
          cambiar.mutate(
            { currentPassword, newPassword },
            {
              onSuccess: () => reset(VACIO),
              onError: (error) => applyFieldErrors(error, setError, CAMPOS_CONTRASENA),
            },
          ),
        )}
      >
        <PasswordField
          label={t('profile.password.current')}
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          label={t('profile.password.new')}
          autoComplete="new-password"
          help={t('profile.password.newHelp')}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordField
          label={t('profile.password.confirm')}
          autoComplete="new-password"
          error={errors.newPasswordConfirm?.message}
          {...register('newPasswordConfirm')}
        />
        <Resultado ok={cambiar.isSuccess} error={cambiar.error} mensaje={t('profile.password.changed')} />
        <div>
          <Button type="submit" variant="outline" disabled={cambiar.isPending || !escrita}>
            {cambiar.isPending ? t('profile.password.submitting') : t('profile.password.submit')}
          </Button>
        </div>
      </form>
    </Seccion>
  );
}

/** CU-25: sección final con la explicación y la confirmación con contraseña. */
function EliminarCuenta({ onEliminada }: { onEliminada: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const eliminar = useDeleteAccount();
  const [abierta, setAbierta] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(deleteAccountSchema), defaultValues: { password: '' } });

  const cerrar = () => {
    setAbierta(false);
    reset({ password: '' });
    eliminar.reset();
  };

  const confirmar = handleSubmit((datos) =>
    eliminar.mutate(datos, {
      // 5: sin sesión ni datos en caché, a la portada con el aviso.
      onSuccess: async (respuesta) => {
        onEliminada();
        queryClient.clear();
        queryClient.setQueryData(SESSION_KEY, null);
        await navigate('/', { state: flashState({ type: 'success', message: respuesta.message }) });
      },
      onError: (error) => applyFieldErrors(error, setError, ['password']),
    }),
  );

  const errorGeneral =
    eliminar.error && !(eliminar.error instanceof ApiError && eliminar.error.code === 'INVALID_PASSWORD')
      ? errorMessage(t, eliminar.error)
      : null;

  return (
    <section className={`${styles.section} ${styles.danger}`} aria-labelledby="perfil-eliminar">
      <h2 id="perfil-eliminar">{t('profile.delete.title')}</h2>
      <p>{t('profile.delete.consequences')}</p>
      <div>
        <Button variant="outline" onClick={() => setAbierta(true)}>
          {t('profile.delete.open')}
        </Button>
      </div>
      <Modal
        open={abierta}
        title={t('profile.delete.confirmTitle')}
        onClose={cerrar}
        closable={!eliminar.isPending}
        footer={
          <>
            <Button variant="outline" data-autofocus onClick={cerrar} disabled={eliminar.isPending}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void confirmar()} disabled={eliminar.isPending}>
              {eliminar.isPending ? t('profile.delete.submitting') : t('profile.delete.submit')}
            </Button>
          </>
        }
      >
        <form noValidate className={styles.form} onSubmit={(e) => void confirmar(e)}>
          <p>{t('profile.delete.confirmText')}</p>
          {errorGeneral && <Alert type="error">{errorGeneral}</Alert>}
          <PasswordField
            label={t('profile.delete.password')}
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
        </form>
      </Modal>
    </section>
  );
}
