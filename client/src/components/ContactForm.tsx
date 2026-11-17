import { zodResolver } from '@hookform/resolvers/zod';
import { contactSchema, type ContactInput } from '@sanctuary/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { donationsApi } from '../api/donations';
import { applyFieldErrors, errorMessage } from '../utils/apiErrors';
import { Alert } from './Alert';
import { Button } from './Button';
import { Checkbox, TextAreaField, TextField } from './FormFields';
import styles from './ContactForm.module.css';

const CAMPOS = ['name', 'email', 'subject', 'message', 'acceptPrivacy'] as const;
type Aviso = { type: 'success' | 'error'; message: string };

// CU-06 Enviar el formulario de contacto (SCREENS §3.6). Si falla, se conserva lo escrito.
export function ContactForm() {
  const { t } = useTranslation();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', subject: '', message: '' },
  });

  const enviar = useMutation({
    mutationFn: donationsApi.contact,
    onSuccess: (respuesta) => {
      setAviso({ type: 'success', message: respuesta.message });
      reset();
    },
    onError: (error) => {
      applyFieldErrors(error, setError, CAMPOS);
      // 3b: el límite de envíos tiene su propio mensaje.
      const message = error instanceof ApiError && error.status === 429 ? t('contact.tooMany') : errorMessage(t, error);
      setAviso({ type: 'error', message });
    },
  });

  return (
    <section className={styles.card} aria-labelledby="contacto">
      <h2 id="contacto">{t('contact.title')}</h2>
      <p>{t('contact.intro')}</p>
      {aviso && (
        <Alert type={aviso.type} onClose={() => setAviso(null)}>
          {aviso.message}
        </Alert>
      )}
      <form
        noValidate
        onSubmit={handleSubmit((datos) => {
          setAviso(null);
          enviar.mutate(datos);
        })}
      >
        <TextField label={t('contact.name')} autoComplete="name" error={errors.name?.message} {...register('name')} />
        <TextField
          label={t('contact.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField label={t('contact.subject')} error={errors.subject?.message} {...register('subject')} />
        <TextAreaField label={t('contact.message')} error={errors.message?.message} {...register('message')} />
        <Checkbox
          label={<Trans i18nKey="auth.register.privacy" components={[<Link key="privacidad" to="/privacy" />]} />}
          error={errors.acceptPrivacy?.message}
          {...register('acceptPrivacy')}
        />
        <Button type="submit" block disabled={enviar.isPending}>
          {enviar.isPending ? t('contact.sending') : t('contact.send')}
        </Button>
      </form>
    </section>
  );
}
