import { faPen, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { VISIBILITIES, type AdminUpdateListItemDto, type Visibility } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { adminApi } from '../../api/admin';
import pageStyles from '../../pages/admin/AdminPage.module.css';
import { ADMIN_KEY, useAdminAnimals, useAdminUpdates } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import { errorMessage } from '../../utils/apiErrors';
import { formatLongDate } from '../../utils/format';
import { Alert, type AlertType } from '../Alert';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { SelectField } from '../FormFields';
import iconStyles from '../IconButton.module.css';
import { Modal } from '../Modal';
import { Pagination } from '../Pagination';

const PAGE_SIZE = 20;

interface Filtros {
  animalId?: number;
  visibility?: Visibility;
  mias: boolean;
  page: number;
}

// Listado de actualizaciones del panel (SCREENS §5.3): filtros, tabla,
// páginas y borrado (CU-32). Con `animalId`, solo las de ese animal (pestaña
// de la ficha). Las acciones solo se muestran si `canEdit`: lo decide el servidor.
export function UpdatesList({ animalId }: { animalId?: number }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [filtros, setFiltros] = useState<Filtros>({ mias: false, page: 1 });
  const [aviso, setAviso] = useState<{ type: AlertType; message: string } | null>(null);
  const [aBorrar, setABorrar] = useState<AdminUpdateListItemDto | null>(null);
  const animales = useAdminAnimals({ pageSize: 100, sort: 'name' });
  const actualizaciones = useAdminUpdates({
    animalId: animalId ?? filtros.animalId,
    visibility: filtros.visibility,
    authorId: filtros.mias ? user?.id : undefined,
    page: filtros.page,
    pageSize: PAGE_SIZE,
  });

  const cambiar = (cambios: Partial<Filtros>) => setFiltros((f) => ({ ...f, page: 1, ...cambios }));

  const borrar = useMutation({
    mutationFn: (u: AdminUpdateListItemDto) => adminApi.updates.remove(u.id),
    onSuccess: async () => {
      setABorrar(null);
      setAviso({ type: 'success', message: t('admin.updates.deleted') });
      await queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    },
    onError: (e) => {
      setABorrar(null);
      setAviso({ type: 'error', message: errorMessage(t, e) });
    },
  });

  return (
    <>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}

      <div className={pageStyles.filters}>
        {animalId === undefined && (
          <SelectField
            label={t('admin.updates.animal')}
            value={filtros.animalId ?? ''}
            onChange={(e) => cambiar({ animalId: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">{t('form.any')}</option>
            {animales.data?.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField
          label={t('admin.media.visibility')}
          value={filtros.visibility ?? ''}
          onChange={(e) => cambiar({ visibility: (e.target.value || undefined) as Visibility | undefined })}
        >
          <option value="">{t('form.any')}</option>
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {t(`admin.media.visibility_${v}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('admin.updates.author')}
          value={filtros.mias ? 'mine' : ''}
          onChange={(e) => cambiar({ mias: e.target.value === 'mine' })}
        >
          <option value="">{t('admin.updates.allAuthors')}</option>
          <option value="mine">{t('admin.updates.mine')}</option>
        </SelectField>
      </div>

      {actualizaciones.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void actualizaciones.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('admin.updates.loadError')}
        </Alert>
      ) : !actualizaciones.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : actualizaciones.data.data.length === 0 ? (
        <p>{t('admin.updates.empty')}</p>
      ) : (
        <>
          <p className={pageStyles.count} aria-live="polite">
            {t('admin.common.results', { count: actualizaciones.data.meta.total })}
          </p>
          <table className={pageStyles.table}>
            <thead>
              <tr>
                <th scope="col">{t('admin.updates.date')}</th>
                <th scope="col">{t('admin.updates.animal')}</th>
                <th scope="col">{t('admin.updates.titleColumn')}</th>
                <th scope="col">{t('admin.media.visibility')}</th>
                <th scope="col">{t('admin.updates.author')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('admin.common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {actualizaciones.data.data.map((u) => (
                <tr key={u.id}>
                  <td data-label={t('admin.updates.date')} className={pageStyles.numeric}>
                    {formatLongDate(u.publishedAt)}
                  </td>
                  <td data-label={t('admin.updates.animal')}>{u.animal.name}</td>
                  <td className={pageStyles.nameLink}>{u.title}</td>
                  <td data-label={t('admin.media.visibility')}>
                    <Badge tone={u.visibility === 'public' ? 'neutral' : 'info'}>
                      {t(`admin.media.visibility_${u.visibility}`)}
                    </Badge>
                  </td>
                  <td data-label={t('admin.updates.author')}>{u.author.name}</td>
                  <td>
                    {u.canEdit && (
                      <div className={pageStyles.rowActions}>
                        <Link
                          to={`/admin/updates/${u.id}`}
                          className={iconStyles.iconButton}
                          aria-label={t('admin.common.edit', { name: u.title })}
                        >
                          <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          className={iconStyles.iconButton}
                          aria-label={t('admin.common.deleteNamed', { name: u.title })}
                          onClick={() => {
                            setAviso(null);
                            setABorrar(u);
                          }}
                        >
                          <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={actualizaciones.data.meta.page}
            totalPages={actualizaciones.data.meta.totalPages}
            onChange={(page) => setFiltros((f) => ({ ...f, page }))}
          />
        </>
      )}

      <Modal
        open={aBorrar !== null}
        title={t('admin.updates.confirmDelete', { title: aBorrar?.title })}
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
        <p>{t('admin.updates.confirmDeleteText')}</p>
      </Modal>
    </>
  );
}
