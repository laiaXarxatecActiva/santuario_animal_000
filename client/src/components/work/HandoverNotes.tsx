import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { handoverNoteBodySchema, type HandoverNoteBody, type HandoverNoteDto, type NamedRef } from '@sanctuary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { workApi } from '../../api/work';
import { HANDOVER_KEY, useHandoverNotes } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { erroresDeApi, erroresPorCampo } from '../../utils/erroresPorCampo';
import { formatShortInstant } from '../../utils/format';
import { Alert } from '../Alert';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { SelectField, TextAreaField } from '../FormFields';
import { Modal } from '../Modal';
import styles from '../../pages/admin/AdminPage.module.css';
import notaStyles from './HandoverNotes.module.css';

/**
 * CU-71: notas de relevo de las últimas 24 horas de mis zonas, en «Mi día».
 * `zonas` son en las que puedo escribir (las de mi turno de hoy; el administrador, todas).
 */
export function HandoverNotes({ zonas }: { zonas: NamedRef[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const notas = useHandoverNotes();
  const [escribir, setEscribir] = useState(false);
  const [aviso, setAviso] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const leer = useMutation({
    mutationFn: (id: number) => workApi.handover.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HANDOVER_KEY }),
    onError: (e) => setAviso({ type: 'error', message: errorMessage(t, e) }),
  });

  return (
    <section aria-labelledby="notas-relevo" className={notaStyles.section}>
      <div className={styles.header}>
        <h2 id="notas-relevo">{t('work.handover.title')}</h2>
        {zonas.length > 0 && (
          <Button
            variant="outline"
            icon={faPenToSquare}
            onClick={() => {
              setAviso(null);
              setEscribir(true);
            }}
          >
            {t('work.handover.write')}
          </Button>
        )}
      </div>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}
      {notas.isError ? (
        <p className={styles.muted}>{t('work.handover.loadError')}</p>
      ) : !notas.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : notas.data.length === 0 ? (
        <p className={styles.muted}>{t('work.handover.empty')}</p>
      ) : (
        <div className={notaStyles.list}>
          {notas.data.map((nota) => (
            <Nota key={nota.id} nota={nota} ocupado={leer.isPending} onLeer={() => leer.mutate(nota.id)} />
          ))}
        </div>
      )}
      {escribir && (
        <NuevaNota
          zonas={zonas}
          onClose={() => setEscribir(false)}
          onSaved={async () => {
            setEscribir(false);
            setAviso({ type: 'success', message: t('work.handover.saved') });
            await queryClient.invalidateQueries({ queryKey: HANDOVER_KEY });
          }}
        />
      )}
    </section>
  );
}

function Nota({ nota, ocupado, onLeer }: { nota: HandoverNoteDto; ocupado: boolean; onLeer: () => void }) {
  const { t } = useTranslation();
  return (
    <article className={nota.isRead ? notaStyles.note : `${notaStyles.note} ${notaStyles.unread}`}>
      <p className={styles.muted}>
        {t('work.handover.meta', {
          author: nota.author.name,
          zone: nota.zone.name,
          date: formatShortInstant(nota.createdAt),
        })}{' '}
        {!nota.isRead && <Badge tone="new">{t('work.handover.new')}</Badge>}
      </p>
      <p className={styles.preWrap}>{nota.body}</p>
      {!nota.isRead && (
        <div>
          <Button variant="ghost" disabled={ocupado} onClick={onLeer}>
            {t('work.handover.markRead')}
          </Button>
        </div>
      )}
    </article>
  );
}

function NuevaNota({
  zonas,
  onClose,
  onSaved,
}: {
  zonas: NamedRef[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [zoneId, setZoneId] = useState(String(zonas[0]?.id ?? ''));
  const [texto, setTexto] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: (datos: HandoverNoteBody) => workApi.handover.create(datos),
    onSuccess: onSaved,
    onError: (e) => {
      if (e instanceof ApiError && e.details.length > 0) setErrores(erroresDeApi(e.details));
      else setError(errorMessage(t, e));
    },
  });
  const formId = 'nota-relevo';
  return (
    <Modal
      open
      title={t('work.handover.writeTitle')}
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
        className={styles.modalForm}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const datos: HandoverNoteBody = { zoneId: Number(zoneId), body: texto };
          const resultado = handoverNoteBodySchema.safeParse(datos);
          if (!resultado.success) {
            setErrores(erroresPorCampo(resultado.error.issues));
            return;
          }
          setErrores({});
          guardar.mutate(datos);
        }}
      >
        {error && <Alert type="error">{error}</Alert>}
        <SelectField
          label={t('work.handover.zone')}
          value={zoneId}
          error={errores.zoneId}
          onChange={(e) => setZoneId(e.target.value)}
        >
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label={t('work.handover.body')}
          help={t('work.handover.bodyHelp')}
          rows={4}
          maxLength={1000}
          value={texto}
          error={errores.body}
          onChange={(e) => setTexto(e.target.value)}
        />
      </form>
    </Modal>
  );
}
