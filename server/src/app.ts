import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { DEFAULT_SANCTUARY_EMAIL } from './config/env.js';
import type { Reloj } from './dominio/reloj.js';
import { createJobRunner, type JobRunner } from './jobs/registry.js';
import { createLoadUser } from './middlewares/auth.js';
import { createErrorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { requireJson } from './middlewares/require-json.js';
import { createRequireSameOrigin } from './middlewares/require-same-origin.js';
import { createSessionMiddleware } from './middlewares/session.js';
import { createAdminRoutes } from './routes/admin.routes.js';
import { createAdoptionRoutes } from './routes/adoption.routes.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createContributionRoutes } from './routes/contribution.routes.js';
import { createDonationRoutes } from './routes/donation.routes.js';
import { createFeedRoutes } from './routes/feed.routes.js';
import { createNotificationRoutes } from './routes/notification.routes.js';
import { createProfileRoutes } from './routes/profile.routes.js';
import { createPublicRoutes } from './routes/public.routes.js';
import type { EmailService } from './services/email/email.service.js';
import type { PaymentGateway } from './services/payment/payment.service.js';
import { createLocalStorage } from './services/storage/local.storage.js';
import { createAdoptionService } from './servicios/adoption.service.js';
import { createAuthService } from './servicios/auth.service.js';
import { createAnimalAdminService } from './servicios/animal-admin.service.js';
import { createContactService } from './servicios/contact.service.js';
import { createContributionService } from './servicios/contribution.service.js';
import { createDonationService } from './servicios/donation.service.js';
import { createDashboardService } from './servicios/dashboard.service.js';
import { createPlanAdminService } from './servicios/plan-admin.service.js';
import { createUserAdminService } from './servicios/user-admin.service.js';
import { createAdoptionAdminService } from './servicios/adoption-admin.service.js';
import { createPaymentAdminService } from './servicios/payment-admin.service.js';
import { createFeedService } from './servicios/feed.service.js';
import { createNotificationService } from './servicios/notification.service.js';
import { createMediaUploader } from './servicios/media-upload.service.js';
import { createPhotoAdminService } from './servicios/photo-admin.service.js';
import { createProfileService } from './servicios/profile.service.js';
import { createPublicCatalogService } from './servicios/public-catalog.service.js';
import { createSpeciesAdminService } from './servicios/species-admin.service.js';
import { createUpdateAdminService } from './servicios/update-admin.service.js';

export interface AppOptions {
  db: Pool;
  reloj: Reloj;
  /** Carpeta de los archivos subidos, servida en `/uploads`. */
  uploadsDir: string;
  /** Firma de la cookie de sesión (SESSION_SECRET). */
  sessionSecret: string;
  /** URL del cliente, para los enlaces de los emails. */
  clientUrl: string;
  email: EmailService;
  /** Pasarela de pago (simulada; TECH_SPEC §11.1). */
  payments: PaymentGateway;
  /** Producción: cookie `secure` y `trust proxy` (TECH_SPEC §13). */
  production?: boolean;
  /** Borra periódicamente las sesiones caducadas. Desactivado en las pruebas. */
  pruneSessions?: boolean;
  /** Registra las peticiones y los errores inesperados. */
  logger?: Logger;
  /** Sustituye el registro de errores inesperados (500). */
  logError?: (error: unknown) => void;
  /** Buzón del santuario para el formulario de contacto (SANCTUARY_EMAIL). */
  sanctuaryEmail?: string;
  /** Ejecutor de las tareas programadas; por defecto, uno con estas mismas dependencias. */
  jobs?: JobRunner;
}

// Configuración de Express sin `listen`, para que Supertest pueda importarla.
export function createApp(options: AppOptions): Express {
  const { db, reloj, uploadsDir, logger, production = false } = options;
  const app = express();

  app.disable('x-powered-by');
  if (production) app.set('trust proxy', 1);
  // Cabeceras de seguridad (TECH_SPEC §13): CSP, nosniff, Referrer-Policy no-referrer
  // (los enlaces con token no se filtran por el Referer), HSTS, etc.
  app.use(helmet());
  if (logger) {
    app.use(pinoHttp({ logger }));
  }

  const logEmailError = logger
    ? (error: unknown) => logger.error({ err: error }, 'No se ha podido enviar un email')
    : undefined;
  const authService = createAuthService({
    db,
    reloj,
    email: options.email,
    clientUrl: options.clientUrl,
    logEmailError,
  });
  const adoptionService = createAdoptionService({
    db,
    reloj,
    payments: options.payments,
    email: options.email,
    clientUrl: options.clientUrl,
    logEmailError,
  });

  // Fotos y vídeos (TECH_SPEC §11.3), en la carpeta que se sirve en /uploads.
  const media = createMediaUploader(
    createLocalStorage(uploadsDir),
    logger ? (error) => logger.error({ err: error }, 'No se ha podido borrar un archivo subido') : undefined,
  );

  const jobs =
    options.jobs ??
    createJobRunner({
      db,
      reloj,
      payments: options.payments,
      email: options.email,
      clientUrl: options.clientUrl,
      logError: logger ? (error, contexto) => logger.error({ err: error }, contexto) : undefined,
    });

  app.use('/api', createRequireSameOrigin([options.clientUrl]), express.json({ limit: '100kb' }), requireJson);
  app.use(
    '/api',
    createSessionMiddleware({
      pool: db,
      secret: options.sessionSecret,
      secure: production,
      prune: options.pruneSessions ?? false,
      logError: logger
        ? (error) => logger.error({ err: error }, 'No se han podido borrar las sesiones caducadas')
        : undefined,
    }),
    createLoadUser(authService.findSessionUser),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', createAuthRoutes(authService, { secureCookies: production }));
  app.use('/api', createAdoptionRoutes(adoptionService));
  app.use('/api', createFeedRoutes(createFeedService({ db })));
  app.use('/api', createContributionRoutes(createContributionService({ db })));
  app.use(
    '/api',
    createDonationRoutes(
      createDonationService({ db, reloj, payments: options.payments, email: options.email, logEmailError }),
      createContactService({
        email: options.email,
        sanctuaryEmail: options.sanctuaryEmail ?? DEFAULT_SANCTUARY_EMAIL,
        logEmailError,
      }),
    ),
  );
  app.use('/api', createNotificationRoutes(createNotificationService({ db })));
  app.use('/api', createProfileRoutes(createProfileService({ db, reloj }), { secureCookies: production }));
  app.use(
    '/api/admin',
    createAdminRoutes({
      dashboard: createDashboardService({ db, reloj }),
      species: createSpeciesAdminService({ db }),
      plans: createPlanAdminService({ db }),
      users: createUserAdminService({
        db,
        reloj,
        email: options.email,
        clientUrl: options.clientUrl,
        logEmailError,
      }),
      payments: createPaymentAdminService({
        db,
        reloj,
        payments: options.payments,
        email: options.email,
        clientUrl: options.clientUrl,
        logEmailError,
      }),
      adoptions: createAdoptionAdminService({
        db,
        reloj,
        payments: options.payments,
        email: options.email,
        clientUrl: options.clientUrl,
        logEmailError,
      }),
      animals: createAnimalAdminService({
        db,
        reloj,
        email: options.email,
        clientUrl: options.clientUrl,
        logEmailError,
      }),
      photos: createPhotoAdminService({ db, media }),
      updates: createUpdateAdminService({
        db,
        reloj,
        media,
        email: options.email,
        clientUrl: options.clientUrl,
        logEmailError,
      }),
      jobs,
    }),
  );
  app.use('/api', createPublicRoutes(createPublicCatalogService({ db, reloj })));

  // Los errores de cliente de express.static (archivo inexistente, ruta
  // maliciosa) siguen adelante y terminan en el 404 estándar.
  app.use('/uploads', express.static(uploadsDir, { index: false, dotfiles: 'deny' }));

  app.use(['/api', '/uploads'], notFoundHandler);
  app.use(
    createErrorHandler({
      logError: options.logError ?? (logger ? (error) => logger.error({ err: error }, 'Error inesperado') : undefined),
    }),
  );

  return app;
}
