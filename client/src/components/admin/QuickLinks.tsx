import { faSliders } from '@fortawesome/free-solid-svg-icons';
import type { Role } from '@sanctuary/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accesosDeSerie, accesosDisponibles, gruposDeAccesos } from '../../utils/panelLinks';
import { Button, ButtonLink } from '../Button';
import { Checkbox } from '../FormFields';
import { Modal } from '../Modal';
import styles from './QuickLinks.module.css';

/** Cada persona tiene los suyos en este navegador, aunque lo compartan varias. */
const clave = (userId: number) => `quick-links:${userId}`;

/**
 * Los accesos elegidos, solo los que su rol puede usar. Sin nada guardado, o con
 * datos dañados, los de serie.
 */
function leerAccesos(userId: number, role: Role): string[] {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(clave(userId)) ?? 'null');
    if (!Array.isArray(guardado)) return accesosDeSerie(role);
    return accesosDisponibles(role)
      .map((e) => e.to)
      .filter((to) => guardado.includes(to));
  } catch {
    return accesosDeSerie(role);
  }
}

function guardarAccesos(userId: number, accesos: string[]) {
  try {
    localStorage.setItem(clave(userId), JSON.stringify(accesos));
  } catch {
    // Sin acceso a localStorage: el cambio dura hasta recargar.
  }
}

/**
 * Accesos rápidos del escritorio del panel (SCREENS §5.2): de serie, las acciones
 * de crear de su rol; con «Personalizar», cada persona elige entre esas acciones
 * y las páginas de su menú. Se muestran en el orden de la lista.
 */
export function QuickLinks({ userId, role }: { userId: number; role: Role }) {
  const { t } = useTranslation();
  const [elegidos, setElegidos] = useState(() => leerAccesos(userId, role));
  const [editando, setEditando] = useState(false);
  const visibles = accesosDisponibles(role).filter((e) => elegidos.includes(e.to));

  return (
    <section className={styles.quickLinks} aria-labelledby="accesos">
      <div className={styles.heading}>
        <h2 id="accesos">{t('admin.dashboard.quickLinks')}</h2>
        <Button variant="ghost" icon={faSliders} onClick={() => setEditando(true)}>
          {t('admin.dashboard.quickLinksCustomize')}
        </Button>
      </div>
      {visibles.length === 0 ? (
        <p className={styles.empty}>{t('admin.dashboard.quickLinksEmpty')}</p>
      ) : (
        <ul className={styles.list}>
          {visibles.map((enlace) => (
            <li key={enlace.to}>
              <ButtonLink to={enlace.to} variant="outline" icon={enlace.icon}>
                {t(enlace.key)}
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
      {editando && (
        <Personalizar
          role={role}
          elegidos={elegidos}
          onClose={() => setEditando(false)}
          onSave={(nuevos) => {
            guardarAccesos(userId, nuevos);
            setElegidos(nuevos);
            setEditando(false);
          }}
        />
      )}
    </section>
  );
}

function Personalizar({
  role,
  elegidos,
  onClose,
  onSave,
}: {
  role: Role;
  elegidos: string[];
  onClose: () => void;
  onSave: (accesos: string[]) => void;
}) {
  const { t } = useTranslation();
  const [marcados, setMarcados] = useState(() => new Set(elegidos));
  const formId = 'personalizar-accesos';

  const alternar = (to: string) =>
    setMarcados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(to)) nuevo.delete(to);
      else nuevo.add(to);
      return nuevo;
    });

  return (
    <Modal
      open
      title={t('admin.dashboard.quickLinksDialogTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={() => setMarcados(new Set(accesosDeSerie(role)))}>
            {t('admin.dashboard.quickLinksReset')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId}>
            {t('admin.dashboard.quickLinksSave')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            accesosDisponibles(role)
              .map((enlace) => enlace.to)
              .filter((to) => marcados.has(to)),
          );
        }}
      >
        <p className={styles.help}>{t('admin.dashboard.quickLinksDialogHelp')}</p>
        {gruposDeAccesos(role).map((grupo) => (
          <fieldset key={grupo.key} className={styles.group}>
            <legend className={styles.legend}>{grupo.key && t(grupo.key)}</legend>
            <div className={styles.options}>
              {grupo.links.map((enlace) => (
                <Checkbox
                  key={enlace.to}
                  label={t(enlace.key)}
                  checked={marcados.has(enlace.to)}
                  onChange={() => alternar(enlace.to)}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </form>
    </Modal>
  );
}
