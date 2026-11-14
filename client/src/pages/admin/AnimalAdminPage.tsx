import { faArrowUpRightFromSquare, faChevronDown, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ANIMAL_STATUSES, ARCHIVED_ANIMAL_STATUSES, type AdminAnimalDto, type AnimalStatus } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router';
import { adminApi } from '../../api/admin';
import { Alert } from '../../components/Alert';
import { AnimalStatusBadges } from '../../components/AnimalStatusBadges';
import { Button, ButtonLink } from '../../components/Button';
import { TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { ADMIN_KEY, adminAnimalKey, useAdminAnimal } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import { errorMessage } from '../../utils/apiErrors';
import { flashState } from '../../utils/flash';
import { formatDate } from '../../utils/format';
import { parseId } from '../../utils/routeParams';
import styles from './AnimalAdminPage.module.css';
import pageStyles from './AdminPage.module.css';

export type Aviso = { type: 'success' | 'error'; message: string };

/** Lo que reciben las pestañas de la ficha. */
export interface AnimalTabContext {
  animal: AdminAnimalDto;
  avisar: (aviso: Aviso | null) => void;
}

export const useAnimalTab = () => useOutletContext<AnimalTabContext>();

const esArchivado = (s: AnimalStatus) => (ARCHIVED_ANIMAL_STATUSES as readonly AnimalStatus[]).includes(s);

/** Hoy en el navegador, como `YYYY-MM-DD`. */
const hoyLocal = () => new Intl.DateTimeFormat('sv-SE').format(new Date());

// CU-28 ficha del animal en el panel (SCREENS §5.4): encabezado, estado,
// borrado y pestañas.
export function AnimalAdminPage() {
  const { t } = useTranslation();
  const id = parseId(useParams().id);
  const animal = useAdminAnimal(id);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  if (animal.isError || id === undefined) {
    return (
      <div className={pageStyles.page}>
        <h1>{t('admin.animals.notFound')}</h1>
        <p>
          <Link to="/admin/animals">{t('admin.animals.backToList')}</Link>
        </p>
      </div>
    );
  }
  if (!animal.data) return <p aria-busy="true">{t('common.loading')}</p>;
  const datos = animal.data;

  return (
    <div className={pageStyles.page}>
      <nav aria-label={t('animalPage.breadcrumb')} className={pageStyles.muted}>
        <Link to="/admin/animals">{t('admin.animals.title')}</Link> › {datos.name}
      </nav>
      <Cabecera animal={datos} avisar={setAviso} />
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}
      <nav aria-label={t('admin.animal.tabs')} className={styles.tabs}>
        <NavLink to={`/admin/animals/${datos.id}`} end className={styles.tab}>
          {t('admin.animal.tabData')}
        </NavLink>
        <NavLink to={`/admin/animals/${datos.id}/photos`} className={styles.tab}>
          {t('admin.animal.tabPhotos')}
        </NavLink>
      </nav>
      <Outlet context={{ animal: datos, avisar: setAviso } satisfies AnimalTabContext} />
    </div>
  );
}

function Cabecera({ animal, avisar }: { animal: AdminAnimalDto; avisar: (a: Aviso | null) => void }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [archivarComo, setArchivarComo] = useState<AnimalStatus | null>(null);
  const [fecha, setFecha] = useState(hoyLocal);
  const [borrando, setBorrando] = useState(false);
  const archivado = esArchivado(animal.status);

  const cambiarEstado = useMutation({
    mutationFn: (cambio: { status: AnimalStatus; date?: string }) => adminApi.animals.changeStatus(animal.id, cambio),
    onSuccess: async (actualizado) => {
      setArchivarComo(null);
      queryClient.setQueryData(adminAnimalKey(animal.id), actualizado);
      avisar({
        type: 'success',
        message: t('admin.animal.statusChanged', { status: t(`admin.animalStatus.${actualizado.status}`) }),
      });
      await queryClient.invalidateQueries({ queryKey: [...ADMIN_KEY, 'animals', 'list'] });
    },
    onError: (e) => {
      setArchivarComo(null);
      avisar({ type: 'error', message: errorMessage(t, e) });
    },
  });

  const borrar = useMutation({
    mutationFn: () => adminApi.animals.remove(animal.id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: adminAnimalKey(animal.id) });
      await queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      await navigate('/admin/animals', {
        state: flashState({ type: 'success', message: t('admin.animal.deleted', { name: animal.name }) }),
      });
    },
    onError: (e) => {
      setBorrando(false);
      avisar({ type: 'error', message: errorMessage(t, e) });
    },
  });

  const elegirEstado = (status: AnimalStatus) => {
    setMenu(false);
    avisar(null);
    if (esArchivado(status)) {
      setFecha(hoyLocal());
      setArchivarComo(status);
    } else {
      cambiarEstado.mutate({ status });
    }
  };

  /** A4 y RN-17: con historial de adopciones no se borra; se explica sin preguntar. */
  const pedirBorrado = () => {
    if (animal.hasAdoptionHistory) avisar({ type: 'error', message: t('errors.ANIMAL_HAS_ADOPTIONS') });
    else setBorrando(true);
  };

  return (
    <div className={pageStyles.header}>
      <div>
        <h1>{animal.name}</h1>
        <div className={pageStyles.badges}>
          <AnimalStatusBadges status={animal.status} isPublished={animal.isPublished} />
          {animal.statusChangedAt && (
            <span className={pageStyles.muted}>
              {t('admin.animal.statusSince', { date: formatDate(animal.statusChangedAt) })}
            </span>
          )}
        </div>
      </div>
      <div className={pageStyles.headerActions}>
        {animal.isPublished && !archivado && (
          <ButtonLink
            to={`/animals/${animal.id}`}
            variant="ghost"
            icon={faArrowUpRightFromSquare}
            target="_blank"
            rel="noopener"
          >
            {t('admin.animal.viewOnSite')}
          </ButtonLink>
        )}
        {!archivado && (
          <div className={styles.menu}>
            <Button variant="outline" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              {t('admin.animal.changeStatus')}
              <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
            </Button>
            {menu && (
              <ul className={styles.menuPanel}>
                {ANIMAL_STATUSES.filter((s) => s !== animal.status).map((s) => (
                  <li key={s}>
                    <button type="button" className={styles.menuItem} onClick={() => elegirEstado(s)}>
                      {t(`admin.animalStatus.${s}`)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {user?.role === 'admin' && (
          <Button variant="ghost" icon={faTrashCan} onClick={pedirBorrado}>
            {t('admin.animal.delete')}
          </Button>
        )}
      </div>

      <Modal
        open={archivarComo !== null}
        title={t(archivarComo === 'deceased' ? 'admin.animal.confirmDeceased' : 'admin.animal.confirmTransferred', {
          name: animal.name,
        })}
        onClose={() => setArchivarComo(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setArchivarComo(null)}>
              {t('admin.common.cancel')}
            </Button>
            <Button
              disabled={cambiarEstado.isPending || fecha === ''}
              onClick={() => archivarComo && cambiarEstado.mutate({ status: archivarComo, date: fecha })}
            >
              {cambiarEstado.isPending ? t('admin.animal.registering') : t('admin.animal.register')}
            </Button>
          </>
        }
      >
        <div className={pageStyles.modalForm}>
          <p>
            {animal.openAdoptions > 0
              ? t('admin.animal.closesAdoptions', { count: animal.openAdoptions })
              : t('admin.animal.noOpenAdoptions')}
          </p>
          <TextField
            type="date"
            label={t('admin.animal.eventDate')}
            value={fecha}
            max={hoyLocal()}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={borrando}
        title={t('admin.animal.confirmDelete', { name: animal.name })}
        onClose={() => setBorrando(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setBorrando(false)}>
              {t('admin.common.cancel')}
            </Button>
            <Button disabled={borrar.isPending} onClick={() => borrar.mutate()}>
              {borrar.isPending ? t('admin.common.deleting') : t('admin.common.delete')}
            </Button>
          </>
        }
      >
        <p>{t('admin.animal.confirmDeleteText')}</p>
      </Modal>
    </div>
  );
}
