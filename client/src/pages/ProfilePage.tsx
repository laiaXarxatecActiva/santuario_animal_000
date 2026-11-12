import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordFormSchema, profileDataSchema, type EmailFrequency, type ProfileDto } from '@sanctuary/shared';
import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { PasswordField, TextField } from '../components/FormFields';
import { Switch } from '../components/Switch';
import { useChangePassword, useProfile, useUpdateProfile } from '../hooks/useProfile';
import { applyFieldErrors, errorMessage } from '../utils/apiErrors';
import { formatPhone } from '../utils/phone';
import styles from './ProfilePage.module.css';

// CU-23 Gestionar el perfil y CU-24 Cambiar la contraseña (SCREENS §4.6). Cada
// sección tiene su propio botón y sus propios avisos. «Eliminar cuenta» (CU-25)
// llegará con la Fase 2.
export function ProfilePage() {
  const { t } = useTranslation();
  const perfil = useProfile();

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
    const adoptante = perfil.data.role === 'adopter';
    contenido = (
      <>
        <TusDatos perfil={perfil.data} />
        {adoptante && <Notificaciones perfil={perfil.data} />}
        {adoptante && <Privacidad perfil={perfil.data} />}
        <Contrasena />
      </>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <h1>{t('profile.title')}</h1>
      {contenido}
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

function TusDatos({ perfil }: { perfil: ProfileDto }) {
  const { t } = useTranslation();
  const guardar = useUpdateProfile();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileDataSchema),
    defaultValues: { firstName: perfil.firstName, lastName: perfil.lastName, phone: formatPhone(perfil.phone ?? '') },
  });

  return (
    <Seccion id="perfil-datos" titulo={t('profile.data.title')}>
      <form
        noValidate
        className={styles.form}
        onSubmit={handleSubmit((datos) =>
          guardar.mutate(datos, { onError: (error) => applyFieldErrors(error, setError, CAMPOS_DATOS) }),
        )}
      >
        <TextField
          label={t('profile.data.firstName')}
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <TextField
          label={t('profile.data.lastName')}
          autoComplete="family-name"
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
        <Resultado ok={guardar.isSuccess} error={guardar.error} mensaje={t('profile.saved')} />
        <div>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? t('profile.saving') : t('profile.data.submit')}
          </Button>
        </div>
      </form>
    </Seccion>
  );
}

function Notificaciones({ perfil }: { perfil: ProfileDto }) {
  const { t } = useTranslation();
  const guardar = useUpdateProfile();
  const [recibir, setRecibir] = useState(perfil.emailNotifications);
  const [frecuencia, setFrecuencia] = useState<EmailFrequency>(perfil.emailFrequency);
  const opciones: { valor: EmailFrequency; clave: string }[] = [
    { valor: 'per_update', clave: 'profile.notifications.perUpdate' },
    { valor: 'monthly_digest', clave: 'profile.notifications.monthlyDigest' },
  ];

  return (
    <Seccion id="perfil-notificaciones" titulo={t('profile.notifications.title')}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate({ emailNotifications: recibir, emailFrequency: frecuencia });
        }}
      >
        <Switch
          label={t('profile.notifications.receive')}
          checked={recibir}
          onChange={(e) => setRecibir(e.target.checked)}
        />
        <fieldset className={styles.fieldset} disabled={!recibir}>
          <legend className={styles.label}>{t('profile.notifications.frequency')}</legend>
          {opciones.map(({ valor, clave }) => (
            <label key={valor} className={styles.radio}>
              <input
                type="radio"
                name="email-frequency"
                checked={frecuencia === valor}
                onChange={() => setFrecuencia(valor)}
              />
              {t(clave)}
            </label>
          ))}
        </fieldset>
        <Resultado ok={guardar.isSuccess} error={guardar.error} mensaje={t('profile.saved')} />
        <div>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? t('profile.saving') : t('profile.save')}
          </Button>
        </div>
      </form>
    </Seccion>
  );
}

function Privacidad({ perfil }: { perfil: ProfileDto }) {
  const { t } = useTranslation();
  const guardar = useUpdateProfile();
  const [mostrar, setMostrar] = useState(perfil.showPublicName);

  return (
    <Seccion id="perfil-privacidad" titulo={t('profile.privacy.title')}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate({ showPublicName: mostrar });
        }}
      >
        <Switch
          label={t('profile.privacy.showName')}
          help={t('profile.privacy.showNameHelp')}
          checked={mostrar}
          onChange={(e) => setMostrar(e.target.checked)}
        />
        <Resultado ok={guardar.isSuccess} error={guardar.error} mensaje={t('profile.saved')} />
        <div>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? t('profile.saving') : t('profile.save')}
          </Button>
        </div>
      </form>
    </Seccion>
  );
}

const CAMPOS_CONTRASENA = ['currentPassword', 'newPassword', 'newPasswordConfirm'] as const;
const VACIO = { currentPassword: '', newPassword: '', newPasswordConfirm: '' };

function Contrasena() {
  const { t } = useTranslation();
  const cambiar = useChangePassword();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(changePasswordFormSchema), defaultValues: VACIO });

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
          <Button type="submit" disabled={cambiar.isPending}>
            {cambiar.isPending ? t('profile.password.submitting') : t('profile.password.submit')}
          </Button>
        </div>
      </form>
    </Seccion>
  );
}
