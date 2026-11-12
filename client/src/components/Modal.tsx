import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import iconStyles from './IconButton.module.css';
import styles from './Modal.module.css';

// Ventana emergente sobre <dialog> nativo (DESIGN_SYSTEM §8.4). El navegador
// atrapa el foco y lo devuelve al botón que la abrió al cerrarse.
interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  /** `false` mientras no se puede cerrar (por ejemplo, durante un pago en curso). */
  closable?: boolean;
  children: ReactNode;
  /** Botones del pie. */
  footer?: ReactNode;
}

export function Modal({ open, ...props }: ModalProps) {
  return open ? <Ventana {...props} /> : null;
}

function Ventana({ title, onClose, closable = true, children, footer }: Omit<ModalProps, 'open'>) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    dialogo.showModal();
    return () => dialogo.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.modal}
      aria-labelledby={tituloId}
      onCancel={(e) => {
        // Esc: se cierra desde React (o no se cierra si no se puede).
        e.preventDefault();
        if (closable) onClose();
      }}
    >
      <div className={styles.header}>
        <h2 id={tituloId} className={styles.title}>
          {title}
        </h2>
        {closable && (
          <button type="button" className={iconStyles.iconButton} aria-label={t('modal.close')} onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  );
}
