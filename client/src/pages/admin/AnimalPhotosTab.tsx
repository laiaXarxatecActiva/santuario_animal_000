import { faCamera, faUpload } from '@fortawesome/free-solid-svg-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  VISIBILITIES,
  photoPatchBodySchema,
  type AdminPhotoDto,
  type PhotoPatchBody,
  type PhotoUploadResultDto,
} from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { MediaUploader, validarPendientes, type PendingMedia } from '../../components/admin/MediaUploader';
import { PhotoGrid } from '../../components/admin/PhotoGrid';
import { Alert, type AlertType } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SelectField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { ADMIN_ANIMALS_KEY, adminAnimalKey, adminPhotosKey, useAdminPhotos } from '../../hooks/useAdmin';
import { applyFieldErrors, errorMessage } from '../../utils/apiErrors';
import { useAnimalTab } from './AnimalAdminPage';
import styles from './AnimalPhotosTab.module.css';
import pageStyles from './AdminPage.module.css';

interface Aviso {
  type: AlertType;
  message: string;
  /** Líneas debajo del mensaje (los archivos rechazados). */
  items?: string[];
}

/** FormData de la subida: los archivos y, en `meta`, el texto alternativo y la visibilidad de cada uno. */
export function datosDeSubida(items: readonly PendingMedia[], conVisibilidad = true): FormData {
  const datos = new FormData();
  datos.append(
    'meta',
    JSON.stringify(items.map(({ altText, visibility }) => (conVisibilidad ? { altText, visibility } : { altText }))),
  );
  for (const item of items) datos.append('files', item.file);
  return datos;
}

// CU-29 Gestionar fotos y vídeos de un animal: pestaña «Fotos» (SCREENS §5.4).
export function AnimalPhotosTab() {
  const { t } = useTranslation();
  const { animal } = useAnimalTab();
  const fotos = useAdminPhotos(animal.id);
  const queryClient = useQueryClient();
  const [pendientes, setPendientes] = useState<PendingMedia[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [orden, setOrden] = useState<number[] | null>(null);
  const [editando, setEditando] = useState<AdminPhotoDto | null>(null);
  const [aBorrar, setABorrar] = useState<AdminPhotoDto | null>(null);

  const refrescar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminPhotosKey(animal.id) }),
      queryClient.invalidateQueries({ queryKey: adminAnimalKey(animal.id) }),
      queryClient.invalidateQueries({ queryKey: [...ADMIN_ANIMALS_KEY, 'list'] }),
    ]);
  const fallo = (e: unknown) => setAvisos([{ type: 'error', message: errorMessage(t, e) }]);

  const subir = useMutation({
    mutationFn: (items: PendingMedia[]) => adminApi.photos.upload(animal.id, datosDeSubida(items)),
    onSuccess: async (resultado: PhotoUploadResultDto) => {
      setPendientes([]);
      const nuevos: Aviso[] = [];
      if (resultado.created.length > 0) {
        nuevos.push({ type: 'success', message: t('admin.photos.uploaded', { count: resultado.created.length }) });
      }
      if (resultado.rejected.length > 0) {
        nuevos.push({
          type: 'error',
          message: t('admin.photos.rejectedTitle'),
          items: resultado.rejected.map((r) =>
            t('admin.photos.rejected', { name: r.fileName, message: t(`errors.${r.code}`, r.message) }),
          ),
        });
      }
      setAvisos(nuevos);
      await refrescar();
    },
    onError: fallo,
  });

  const portada = useMutation({
    mutationFn: (foto: AdminPhotoDto) => adminApi.photos.setCover(animal.id, foto.id),
    onSuccess: async () => {
      setAvisos([{ type: 'success', message: t('admin.photos.coverChanged') }]);
      await refrescar();
    },
    onError: fallo,
  });

  const reordenar = useMutation({
    mutationFn: (photoIds: number[]) => adminApi.photos.reorder(animal.id, photoIds),
    onMutate: (photoIds) => setOrden(photoIds),
    onError: fallo,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: adminPhotosKey(animal.id) });
      setOrden(null);
    },
  });

  const borrar = useMutation({
    mutationFn: (foto: AdminPhotoDto) => adminApi.photos.remove(foto.id),
    onSuccess: async (_r, foto) => {
      setABorrar(null);
      setAvisos([
        foto.isCover
          ? { type: 'warning', message: t('admin.photos.deletedCover') }
          : { type: 'success', message: t('admin.photos.deleted') },
      ]);
      await refrescar();
    },
    onError: (e) => {
      setABorrar(null);
      fallo(e);
    },
  });

  const enviar = () => {
    const { items, ok } = validarPendientes(pendientes);
    setPendientes(items);
    if (ok) {
      setAvisos([]);
      subir.mutate(items);
    }
  };

  const galeria = (() => {
    const lista = fotos.data ?? [];
    if (!orden) return lista;
    return orden.flatMap((id) => lista.filter((f) => f.id === id));
  })();
  const ocupado = portada.isPending || reordenar.isPending || borrar.isPending;

  return (
    <div className={styles.tab}>
      {avisos.map((aviso, i) => (
        <Alert key={i} type={aviso.type} onClose={() => setAvisos((a) => a.filter((x) => x !== aviso))}>
          {aviso.message}
          {aviso.items && (
            <ul className={styles.rejected}>
              {aviso.items.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
          )}
        </Alert>
      ))}

      <section className={styles.section} aria-labelledby="subir-fotos">
        <h2 id="subir-fotos">{t('admin.photos.uploadTitle')}</h2>
        <MediaUploader items={pendientes} onChange={setPendientes} disabled={subir.isPending} />
        <div>
          <Button icon={faUpload} disabled={pendientes.length === 0 || subir.isPending} onClick={enviar}>
            {subir.isPending ? t('admin.photos.uploading') : t('admin.photos.upload', { count: pendientes.length })}
          </Button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="galeria">
        <h2 id="galeria">{t('admin.photos.gallery')}</h2>
        {fotos.isError ? (
          <Alert
            type="error"
            action={
              <Button variant="outline" onClick={() => void fotos.refetch()}>
                {t('common.retry')}
              </Button>
            }
          >
            {t('admin.photos.loadError')}
          </Alert>
        ) : !fotos.data ? (
          <p aria-busy="true">{t('common.loading')}</p>
        ) : galeria.length === 0 ? (
          <EmptyState icon={faCamera} message={t('admin.photos.empty')} />
        ) : (
          <PhotoGrid
            photos={galeria}
            disabled={ocupado}
            onReorder={(ids) => reordenar.mutate(ids)}
            onSetCover={(foto) => portada.mutate(foto)}
            onEdit={setEditando}
            onDelete={setABorrar}
          />
        )}
      </section>

      {editando && (
        <FormularioFoto
          foto={editando}
          onClose={() => setEditando(null)}
          onSaved={async () => {
            setEditando(null);
            setAvisos([{ type: 'success', message: t('admin.photos.saved') }]);
            await refrescar();
          }}
        />
      )}

      <Modal
        open={aBorrar !== null}
        title={t('admin.photos.confirmDelete')}
        onClose={() => setABorrar(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setABorrar(null)}>
              {t('admin.common.cancel')}
            </Button>
            <Button disabled={borrar.isPending} onClick={() => aBorrar && borrar.mutate(aBorrar)}>
              {borrar.isPending ? t('admin.common.deleting') : t('admin.common.delete')}
            </Button>
          </>
        }
      >
        <p>{t('admin.photos.confirmDeleteText')}</p>
        {aBorrar?.isCover && <Alert type="warning">{t('admin.photos.deleteCoverWarning')}</Alert>}
      </Modal>
    </div>
  );
}

const CAMPOS = ['altText', 'visibility'] as const;

/** CU-29 A1: texto alternativo y visibilidad. */
function FormularioFoto({
  foto,
  onClose,
  onSaved,
}: {
  foto: AdminPhotoDto;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<PhotoPatchBody>({
    resolver: zodResolver(photoPatchBodySchema),
    defaultValues: { altText: foto.altText, visibility: foto.visibility },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const guardar = useMutation({
    mutationFn: (datos: PhotoPatchBody) => adminApi.photos.update(foto.id, datos),
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) applyFieldErrors(e, form.setError, CAMPOS);
      else setError(errorMessage(t, e));
    },
  });

  const formId = 'formulario-foto';
  return (
    <Modal
      open
      title={t('admin.photos.editTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={guardar.isPending}>
            {guardar.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className={pageStyles.modalForm}
        onSubmit={handleSubmit((datos) => guardar.mutate(datos))}
      >
        {error && <Alert type="error">{error}</Alert>}
        <TextField
          label={t('admin.media.altText')}
          maxLength={300}
          error={errors.altText?.message}
          {...register('altText')}
        />
        <SelectField label={t('admin.media.visibility')} error={errors.visibility?.message} {...register('visibility')}>
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {t(`admin.media.visibility_${v}`)}
            </option>
          ))}
        </SelectField>
      </form>
    </Modal>
  );
}
