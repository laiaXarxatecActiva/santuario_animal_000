import { faArrowRightFromBracket, faArrowRightToBracket } from '@fortawesome/free-solid-svg-icons';
import type { ShiftAssignmentDto } from '@sanctuary/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatTime } from '../../utils/format';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Modal } from '../Modal';
import styles from './ClockInPanel.module.css';

export type TipoFichaje = 'entrada' | 'salida';

/**
 * CU-63: bloque «Fichaje» de «Mi día» (SCREENS §5.7). Dice claramente si se ha
 * fichado y ofrece el botón que toca. La salida pide confirmación.
 */
export function ClockInPanel({
  turnos,
  esHoy,
  ocupado,
  onFichar,
}: {
  turnos: readonly ShiftAssignmentDto[];
  /** Solo se ficha el día del turno; el servidor lo comprueba igualmente. */
  esHoy: boolean;
  ocupado: boolean;
  onFichar: (id: number, tipo: TipoFichaje) => void;
}) {
  const { t } = useTranslation();
  const [salidaDe, setSalidaDe] = useState<ShiftAssignmentDto | null>(null);

  return (
    <section aria-labelledby="fichaje" className={styles.panel}>
      <div className={styles.header}>
        <h2 id="fichaje">{t('work.clock.title')}</h2>
        <Link to="/admin/my-shifts">{t('work.clock.history')}</Link>
      </div>
      {turnos.length === 0 ? (
        <p className={styles.muted}>{t('work.clock.noShiftToday')}</p>
      ) : (
        turnos.map((turno) => (
          <Turno
            key={turno.id}
            turno={turno}
            esHoy={esHoy}
            ocupado={ocupado}
            onEntrada={() => onFichar(turno.id, 'entrada')}
            onSalida={() => setSalidaDe(turno)}
          />
        ))
      )}
      <Modal
        open={salidaDe !== null}
        title={t('work.clock.confirmOutTitle')}
        onClose={() => setSalidaDe(null)}
        footer={
          <>
            <Button variant="outline" data-autofocus onClick={() => setSalidaDe(null)}>
              {t('admin.common.cancel')}
            </Button>
            <Button
              disabled={ocupado}
              onClick={() => {
                if (salidaDe) onFichar(salidaDe.id, 'salida');
                setSalidaDe(null);
              }}
            >
              {t('work.shifts.checkOut')}
            </Button>
          </>
        }
      >
        <p>{t('work.clock.confirmOutText')}</p>
      </Modal>
    </section>
  );
}

function Turno({
  turno,
  esHoy,
  ocupado,
  onEntrada,
  onSalida,
}: {
  turno: ShiftAssignmentDto;
  esHoy: boolean;
  ocupado: boolean;
  onEntrada: () => void;
  onSalida: () => void;
}) {
  const { t } = useTranslation();
  const { shift, checkedInAt, checkedOutAt } = turno;
  const estado = !checkedInAt ? 'pending' : !checkedOutAt ? 'working' : 'done';
  return (
    <article
      className={styles.shift}
      data-state={estado}
      aria-label={t('work.shifts.shiftLabel', { name: shift.name, start: shift.startTime, end: shift.endTime })}
    >
      <div className={styles.shiftHeader}>
        <h3>{shift.name}</h3>
        <span className={styles.muted}>
          {shift.startTime}–{shift.endTime}
        </span>
      </div>
      {turno.zones.length > 0 && <p className={styles.muted}>{turno.zones.map((z) => z.name).join(', ')}</p>}
      <div className={styles.state}>
        <Badge tone={estado === 'pending' ? 'warning' : estado === 'working' ? 'success' : 'neutral'}>
          {t(`work.clock.states.${estado}`)}
        </Badge>
        <p className={styles.stateText}>
          {estado === 'pending'
            ? t(esHoy ? 'work.clock.notYet' : 'work.clock.notClocked')
            : estado === 'working'
              ? t(esHoy ? 'work.clock.workingSince' : 'work.clock.noExit', { time: formatTime(checkedInAt!) })
              : t('work.clock.finished', { from: formatTime(checkedInAt!), to: formatTime(checkedOutAt!) })}
        </p>
      </div>
      {esHoy && estado === 'pending' && (
        <Button block icon={faArrowRightToBracket} disabled={ocupado} onClick={onEntrada}>
          {t('work.shifts.checkIn')}
        </Button>
      )}
      {esHoy && estado === 'working' && (
        <Button block variant="outline" icon={faArrowRightFromBracket} disabled={ocupado} onClick={onSalida}>
          {t('work.shifts.checkOut')}
        </Button>
      )}
    </article>
  );
}
