import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { workApi } from '../../api/work';
import { QUALIFICATIONS_KEY, useQualifications, useUserQualifications } from '../../hooks/useWork';
import { errorMessage } from '../../utils/apiErrors';
import { Alert } from '../Alert';
import { Button } from '../Button';
import { CheckboxGroup } from './CheckboxGroup';
import styles from '../../pages/admin/AdminPage.module.css';

type Aviso = { type: 'success' | 'error'; message: string };

/** CU-53 paso 3: cualificaciones de un trabajador, en su ficha (SCREENS §5.6). */
export function UserQualifications({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const todas = useQualifications();
  const suyas = useUserQualifications(userId);
  const [elegidas, setElegidas] = useState<number[] | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const valor = elegidas ?? suyas.data?.qualifications.map((q) => q.id) ?? [];

  const guardar = useMutation({
    mutationFn: (ids: number[]) => workApi.qualifications.setOfUser(userId, ids),
    onSuccess: async () => {
      setElegidas(null);
      setAviso({ type: 'success', message: t('work.qualifications.userSaved') });
      await queryClient.invalidateQueries({ queryKey: QUALIFICATIONS_KEY });
    },
    onError: (error) => setAviso({ type: 'error', message: errorMessage(t, error) }),
  });

  return (
    <section aria-labelledby="cualificaciones" className={styles.page}>
      <h2 id="cualificaciones">{t('work.qualifications.title')}</h2>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}
      {todas.isError || suyas.isError ? (
        <p>{t('work.qualifications.loadError')}</p>
      ) : !todas.data || !suyas.data ? (
        <p aria-busy="true">{t('common.loading')}</p>
      ) : todas.data.length === 0 ? (
        <p>{t('work.qualifications.empty')}</p>
      ) : (
        <form
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            guardar.mutate(valor);
          }}
        >
          <CheckboxGroup
            id="cualificaciones-trabajador"
            legend={t('work.qualifications.userHelp')}
            options={todas.data.map((q) => ({ value: q.id, label: q.name }))}
            value={valor}
            onChange={setElegidas}
          />
          <div>
            <Button type="submit" variant="outline" disabled={guardar.isPending}>
              {guardar.isPending ? t('admin.common.saving') : t('work.qualifications.userSave')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
