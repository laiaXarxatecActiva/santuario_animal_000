import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  updateCreateBodySchema,
  updateEditBodySchema,
  type AdminPhotoDto,
  type AdminUpdateDto,
  type Visibility,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { MediaUploader, validarPendientes, type PendingMedia } from '../../components/admin/MediaUploader';
import { Alert } from '../../components/Alert';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import { Button } from '../../components/Button';
import { RadioGroup, SelectField, TextAreaField, TextField } from '../../components/FormFields';
import iconStyles from '../../components/IconButton.module.css';
import { ADMIN_KEY, useAdminUpdate, useAnimalsForUpdates } from '../../hooks/useAdmin';
import { errorMessage } from '../../utils/apiErrors';
import { flashState } from '../../utils/flash';
import { parseId } from '../../utils/routeParams';
import pageStyles from './AdminPage.module.css';
import styles from './UpdateFormPage.module.css';

const esquemaNueva = updateCreateBodySchema.omit({ meta: true });
const esquemaEdicion = updateEditBodySchema.omit({ meta: true, removePhotoIds: true });

type Campo = 'animalId' | 'title' | 'body' | 'visibility';
interface Valores {
  animalId: string;
  title: string;
  body: string;
  visibility: Visibility;
}

// CU-31 Publicar una actualización (`/admin/updates/new`, SCREENS §5.5) y
// CU-32 Editar una actualización (`/admin/updates/:id`).
export function UpdateFormPage() {
  const { t } = useTranslation();
  const id = parseId(useParams().id);
  const [params] = useSearchParams();
  const actualizacion = useAdminUpdate(id);
  const esEdicion = useParams().id !== undefined;

  const titulo = esEdicion ? t('admin.updates.editTitle') : t('admin.updates.new');
  const cabecera = (
    <>
      <nav aria-label={t('animalPage.breadcrumb')} className={pageStyles.muted}>
        <Link to="/admin/updates">{t('admin.updates.title')}</Link> › {titulo}
      </nav>
      <h1>{titulo}</h1>
    </>
  );

  if (esEdicion) {
    if (actualizacion.isError || id === undefined) {
      return (
        <div className={pageStyles.page}>
          {cabecera}
          <Alert type="error">{t('admin.updates.notFound')}</Alert>
        </div>
      );
    }
    if (!actualizacion.data) return <p aria-busy="true">{t('common.loading')}</p>;
    return (
      <div className={`${pageStyles.page} ${styles.page}`}>
        {cabecera}
        {actualizacion.data.canEdit ? (
          <Formulario key={actualizacion.data.id} actualizacion={actualizacion.data} />
        ) : (
          <Alert type="info">{t('admin.updates.cannotEdit')}</Alert>
        )}
      </div>
    );
  }

  return (
    <div className={`${pageStyles.page} ${styles.page}`}>
      {cabecera}
      <Formulario animalIdInicial={params.get('animalId') ?? ''} />
    </div>
  );
}

function Formulario({
  actualizacion,
  animalIdInicial = '',
}: {
  actualizacion?: AdminUpdateDto;
  animalIdInicial?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const animales = useAnimalsForUpdates();
  const [valores, setValores] = useState<Valores>({
    animalId: animalIdInicial,
    title: actualizacion?.title ?? '',
    body: actualizacion?.body ?? '',
    visibility: actualizacion?.visibility ?? 'adopters',
  });
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [error, setError] = useState<{ message: string; items?: string[] } | null>(null);
  const [pendientes, setPendientes] = useState<PendingMedia[]>([]);
  const [quitadas, setQuitadas] = useState<number[]>([]);
  const fotos: AdminPhotoDto[] = (actualizacion?.photos ?? []).filter((f) => !quitadas.includes(f.id));

  const cambiar = (campo: Campo, valor: string) => {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores(({ [campo]: _quitado, ...resto }) => resto);
  };

  const guardar = useMutation({
    mutationFn: (datos: FormData) =>
      actualizacion ? adminApi.updates.update(actualizacion.id, datos) : adminApi.updates.create(datos),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      await navigate('/admin/updates', {
        state: flashState({
          type: 'success',
          message: actualizacion ? t('admin.updates.saved') : t('admin.updates.published'),
        }),
      });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'FILES_REJECTED') {
        setError({ message: errorMessage(t, e), items: e.details.map((d) => d.message) });
        return;
      }
      const deCampo = e instanceof ApiError ? e.details.filter((d) => d.field in valores) : [];
      if (deCampo.length > 0) setErrores(Object.fromEntries(deCampo.map((d) => [d.field, d.message])));
      else setError({ message: errorMessage(t, e) });
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const resultado = (actualizacion ? esquemaEdicion : esquemaNueva).safeParse(valores);
    const medios = validarPendientes(pendientes);
    setPendientes(medios.items);
    if (!resultado.success) {
      const nuevos: Partial<Record<Campo, string>> = {};
      for (const issue of resultado.error.issues) {
        const campo = issue.path[0] as Campo;
        nuevos[campo] ??= issue.message;
      }
      setErrores(nuevos);
    }
    if (!resultado.success || !medios.ok) return;

    const datos = new FormData();
    if (!actualizacion) datos.append('animalId', valores.animalId);
    datos.append('title', resultado.data.title);
    datos.append('body', resultado.data.body);
    datos.append('visibility', resultado.data.visibility);
    datos.append('meta', JSON.stringify(medios.items.map(({ altText }) => ({ altText }))));
    if (actualizacion) datos.append('removePhotoIds', JSON.stringify(quitadas));
    for (const item of medios.items) datos.append('files', item.file);
    guardar.mutate(datos);
  };

  return (
    <form noValidate className={styles.form} onSubmit={enviar}>
      {error && (
        <Alert type="error" onClose={() => setError(null)}>
          {error.message}
          {error.items && (
            <ul className={styles.list}>
              {error.items.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      {actualizacion ? (
        <p>
          <strong>{t('admin.updates.animal')}:</strong> <span>{actualizacion.animal.name}</span>
        </p>
      ) : (
        <SelectField
          label={t('admin.updates.animal')}
          value={valores.animalId}
          error={errores.animalId}
          onChange={(e) => cambiar('animalId', e.target.value)}
        >
          <option value="">{t('admin.updates.chooseAnimal')}</option>
          {animales.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
      )}

      <TextField
        label={t('admin.updates.titleField')}
        value={valores.title}
        maxLength={200}
        error={errores.title}
        onChange={(e) => cambiar('title', e.target.value)}
      />
      <TextAreaField
        label={t('admin.updates.body')}
        rows={10}
        value={valores.body}
        error={errores.body}
        onChange={(e) => cambiar('body', e.target.value)}
      />

      <section className={styles.media} aria-labelledby="fotos-actualizacion">
        <h2 id="fotos-actualizacion" className={styles.subtitle}>
          {t('form.optional', { label: t('admin.updates.media') })}
        </h2>
        {fotos.length > 0 && (
          <ul className={styles.current}>
            {fotos.map((foto) => (
              <li key={foto.id} className={styles.photo}>
                <AnimalPhoto photo={foto} thumbnail ratio="1/1" />
                <button
                  type="button"
                  className={iconStyles.iconButton}
                  aria-label={t('admin.media.remove', { name: foto.altText })}
                  onClick={() => setQuitadas((q) => [...q, foto.id])}
                >
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <MediaUploader
          items={pendientes}
          onChange={setPendientes}
          showVisibility={false}
          disabled={guardar.isPending}
        />
      </section>

      <RadioGroup
        legend={t('admin.media.visibility')}
        name="visibility"
        value={valores.visibility}
        onChange={(v) => cambiar('visibility', v)}
        options={[
          { value: 'adopters', label: t('admin.media.visibility_adopters') },
          { value: 'public', label: t('admin.media.visibility_public') },
        ]}
      />

      <div>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending
            ? t('admin.common.saving')
            : actualizacion
              ? t('admin.updates.save')
              : t('admin.updates.publish')}
        </Button>
      </div>
    </form>
  );
}
