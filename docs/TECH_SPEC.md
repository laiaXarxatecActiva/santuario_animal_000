# Santuario de Animales — Especificación técnica

## 1. Propósito y uso de este documento

**Reglas:**

- No añadir dependencias de pago ni servicios que requieran tarjeta de crédito.
- No cambiar la estructura de la base de datos sin actualizar `seedsql.sql` y, si hace falta, `TEST_DATA.sql`.
- No mover reglas de negocio a React: viven en los modelos del servidor.
- Comprobar siempre el rol en el servidor.
- Implementar las fases en orden y no empezar una fase sin cerrar los criterios de aceptación de la anterior.
- Citar el identificador del caso de uso (`CU-xx`) en las pruebas y en los mensajes de commit relacionados.

## 2. Resumen del sistema

La aplicación tiene tres caras sobre una misma base de datos PostgreSQL:

| Cara | Usuarios | Propósito |
| --- | --- | --- |
| Web pública | Visitantes y adoptantes | Mostrar los animales, explicar la adopción simbólica, recibir donaciones |
| Área del adoptante («Mis animales») | Adoptantes | Ver sus animales, actualizaciones, aportaciones; gestionar adopciones y perfil |
| Panel de gestión | Cuidadores y administradores | CRUD de animales, actualizaciones, adopciones, pagos, donaciones y usuarios |

**Conceptos clave:**

- **Adopción simbólica:** cuota mensual con uno de tres planes, Simbólica (1 €), Usual (5 €) o Extraordinaria (12 €). A cambio, el adoptante recibe una actualización del animal cada dos semanas. El animal nunca sale del santuario y puede tener varios adoptantes a la vez.
- **Donación:** pago único de importe libre (sin mínimo, mayor que 0), con o sin cuenta y sin vínculo con ningún animal.
- **Pagos simulados:** no se mueve dinero real. Un servicio interno decide si el pago sale bien o mal.
- **Especies:** por ahora el santuario solo acoge **buitres** (buitre leonado, buitre negro, alimoche común y quebrantahuesos). La estructura permite añadir otras especies, como el lince ibérico, sin cambios en el código ni en la base de datos.

## 3. Restricciones del proyecto

| Restricción | Consecuencia técnica |
| --- | --- |
| **Presupuesto 0 €** | Solo software libre o gratuito. Ningún servicio que pida tarjeta de crédito, ni siquiera para un periodo de prueba. Las opciones de despliegue (Fase 4) deben tener plan gratuito. |
| **Local primero** | Todo debe funcionar en el ordenador de desarrollo sin conexión a servicios externos. El despliegue es la última fase. |
| **Proyecto académico** | La pasarela de pago es simulada. Los emails en desarrollo van a un buzón local de pruebas (Mailpit), nunca a direcciones reales. |
| **Desarrollo asistido por IA** | Convenciones explícitas, estructura predecible y pruebas automáticas para validar lo generado. |
| **Idioma** | Interfaz y documentación en castellano. Código, SQL, nombres de archivos y directorios, rutas de la API y valores de estado en inglés. La estructura debe permitir añadir valenciano e inglés (Fase 3). |
| **Versión de PostgreSQL** | El SQL debe funcionar en PostgreSQL 14 o superior, para usar la versión que haya instalada en cada ordenador. Probado en PostgreSQL 16. |

## 4. Tecnologías

Todas son gratuitas y de código abierto. Se usa la última versión estable disponible al iniciar el proyecto, respetando las versiones mínimas.

### 4.1 Base

| Capa | Tecnología | Versión mínima | Motivo |
| --- | --- | --- | --- |
| Lenguaje | TypeScript | 5.x | Tipado en cliente y servidor; tipos compartidos |
| Entorno de ejecución | Node.js (LTS) | 22 | Soporte nativo de `--env-file` y `fetch` |
| Servidor | Express | 5.x | Gestiona errores de funciones `async` sin envoltorios |
| Base de datos | PostgreSQL | 14 | Requisito del proyecto |
| Cliente | React | 19 | Requisito del proyecto |
| Empaquetador del cliente | Vite | — | Arranque rápido, proxy de desarrollo hacia la API |
| Gestor de paquetes | npm (workspaces) | 10 | Incluido con Node; monorepo sin herramientas extra |

### 4.2 Librerías del servidor

| Necesidad | Librería | Notas |
| --- | --- | --- |
| Acceso a datos | `pg` (node-postgres) | SQL escrito a mano y **siempre parametrizado** (`$1, $2…`). Sin ORM. |
| Sesiones | `express-session` + `connect-pg-simple` | Sesiones guardadas en la tabla `user_sessions` |
| Hash de contraseñas | `bcryptjs` | JavaScript puro, sin compilación nativa. Coste 10. Compatible con los hashes `$2a$` de `TEST_DATA.sql`. |
| Validación | `zod` | Esquemas compartidos con el cliente en `shared/` |
| Subida de archivos | `multer` | Fotos y vídeos |
| Procesado de imágenes | `sharp` | Redimensionado y miniaturas |
| Email | `nodemailer` | SMTP hacia Mailpit en desarrollo |
| Tareas programadas | `node-cron` | Cobro mensual y mantenimiento |
| Seguridad HTTP | `helmet`, `express-rate-limit` | Cabeceras seguras y límite de intentos de login |
| Registro de logs | `pino` + `pino-http` | Logs estructurados |
| PDF (Fase 3) | `pdfkit` | Certificado de adopción y recibos en PDF |
| Ejecución en desarrollo | `tsx` | Ejecuta TypeScript con recarga |

### 4.3 Librerías del cliente

| Necesidad | Librería | Notas |
| --- | --- | --- |
| Navegación | `react-router` | Rutas públicas, del adoptante y del panel |
| Datos del servidor | `@tanstack/react-query` | Caché, estados de carga y reintentos |
| Formularios | `react-hook-form` + `@hookform/resolvers` | Validación con los mismos esquemas Zod del servidor |
| Textos e idiomas | `i18next` + `react-i18next` | Desde la Fase 1 con solo `es`, para añadir idiomas sin rehacer la interfaz |
| Estilos | CSS Modules + variables CSS | Sin frameworks de pago; tema y contraste centralizados |
| Iconos | `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome` | Font Awesome Free (`DESIGN_SYSTEM.md` §6.1) |
| Fuentes | `@fontsource-variable/fraunces`, `@fontsource-variable/nunito-sans` | Instaladas en el proyecto, sin Google Fonts (`DESIGN_SYSTEM.md` §4) |

### 4.4 Herramientas de desarrollo

| Necesidad | Herramienta |
| --- | --- |
| Pruebas unitarias e integración | Vitest, Supertest, React Testing Library |
| Pruebas extremo a extremo (desde la Fase 2) | Playwright |
| Calidad de código | ESLint + Prettier |
| Buzón de email de pruebas | Mailpit (interfaz web en `http://localhost:8025`) |
| Contenedores (opcional) | Docker Compose para PostgreSQL y Mailpit |

## 5. Arquitectura

El proyecto sigue el patrón **Modelo-Vista-Controlador (MVC)**, con una capa adicional de **Servicios**.

```mermaid
flowchart LR
    V["Vista<br/>React + TypeScript<br/>(client/)"] <-- "HTTP / JSON<br/>cookie de sesión" --> R["Rutas + middlewares<br/>autenticación, rol,<br/>validación Zod"]
    R --> C["Controladores<br/>orquestan la petición"]
    C <--> M["Modelos<br/>SQL con pg + reglas<br/>de negocio"]
    C <--> S["Servicios<br/>pago simulado, email,<br/>archivos, tareas"]
    S <--> M
    M <--> DB[("PostgreSQL")]
    J["Tareas programadas<br/>(node-cron)"] --> S
```

### 5.1 Responsabilidades de cada capa

| Capa | Hace | No hace |
| --- | --- | --- |
| **Rutas** (`routes/`) | Asociar método y URL a un controlador; aplicar middlewares (`requireAuth`, `requireRole`, `validate`) | Lógica de negocio |
| **Middlewares** (`middlewares/`) | Autenticación, comprobación de rol, validación de entrada, gestión de errores | Consultas a la base de datos, salvo cargar el usuario de la sesión |
| **Controladores** (`controllers/`) | Leer la petición ya validada, llamar a modelos y servicios, construir la respuesta HTTP | SQL; reglas de negocio |
| **Modelos** (`models/`) | SQL parametrizado, transacciones, reglas de negocio (por ejemplo, «no dos adopciones abiertas del mismo animal») y conversión de `snake_case` a `camelCase` | Conocer `req`/`res` o enviar emails |
| **Servicios** (`services/`) | Lógica que no pertenece a una tabla: pago simulado, email, almacenamiento de archivos, tareas programadas, PDF | Acceder a `req`/`res` |
| **Vista** (`client/`) | Mostrar datos y formularios; validar en el cliente para mejorar la experiencia | Acceder a la base de datos; decidir permisos (solo oculta botones; el servidor decide) |

### 5.2 Flujo de una petición

1. El navegador envía la petición con la cookie de sesión (`sid`).
2. `express-session` carga la sesión desde `user_sessions`, y el middleware `loadUser` carga el usuario.
3. La ruta aplica `requireAuth` y `requireRole(...)` si corresponde.
4. `validate(schema)` valida `body`, `params` y `query` con Zod. Si falla, responde con un error 400.
5. El controlador llama a uno o varios modelos o servicios. Las operaciones con varios pasos usan una transacción.
6. El controlador responde con JSON en `camelCase`.
7. Cualquier error llega al `errorHandler` central, que lo convierte al formato estándar ([§10.1](#101-convenciones)).

### 5.3 Reglas de negocio y base de datos

Las reglas críticas se aplican **dos veces**: en el modelo, para dar un mensaje claro al usuario, y en la base de datos, como red de seguridad. La base de datos ya incluye:

| Regla | Dónde está en la base de datos |
| --- | --- |
| Un adoptante no puede tener dos adopciones abiertas (pendiente, activa o pausada) del mismo animal | Índice único parcial `adoptions_one_open_per_user_animal` |
| Solo los adoptantes adoptan; los trabajadores no | Trigger `adoptions_check_user_role` |
| Solo cuidadores y administradores escriben actualizaciones | Trigger `animal_updates_check_author` |
| La portada es una imagen pública del mismo animal | Trigger `animals_check_cover_photo` |
| Un animal fallecido o trasladado no es adoptable | `CHECK animals_archived_not_adoptable` |
| No hay dos cuotas válidas para el mismo mes de una adopción | Índice único parcial `payments_one_valid_per_period` |
| Las adopciones cerradas indican el motivo; las abiertas no | `CHECK adoptions_end_reason_consistent` |
| Emails únicos sin distinguir mayúsculas | Índice único `users_email_lower_key` |
| No se borran especies, animales, planes ni usuarios con historial | Claves foráneas `ON DELETE RESTRICT` |

Los modelos deben capturar estos errores de PostgreSQL (`23505` por clave duplicada, `23503` por clave foránea y `23514` por `CHECK` o trigger) y convertirlos en errores 409 o 422 con un mensaje en castellano.

## 6. Estructura del repositorio

Monorepo con **npm workspaces**: un único repositorio y un único `npm install`.

```text
sanctuary/
├── package.json                  scripts globales y workspaces
├── .env.example                  variables de entorno de ejemplo (sin secretos)
├── docker-compose.yml            PostgreSQL + Mailpit (opcional)
├── docs/
│   ├── TECH_SPEC.md
│   └── USE_CASES.md
├── database/
│   ├── seedsql.sql               estructura (borra y recrea todo)
│   ├── TEST_DATA.sql             datos de prueba (vacía e inserta)
│   └── migrations/               cambios posteriores numerados (desde la Fase 4)
├── shared/                       código común a cliente y servidor
│   └── src/
│       ├── schemas/              esquemas Zod (animal.schema.ts, adoption.schema.ts…)
│       ├── types/                tipos de las respuestas de la API
│       └── constants/            estados, roles, límites (status.ts, roles.ts…)
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── uploads/                  archivos subidos (no se versiona)
│   ├── scripts/
│   │   ├── db-reset.ts           ejecuta seedsql.sql y TEST_DATA.sql
│   │   └── run-job.ts            lanza una tarea programada a mano
│   ├── tests/                    pruebas de integración (Supertest)
│   └── src/
│       ├── app.ts                configuración de Express (sin listen)
│       ├── server.ts             arranque: listen y tareas programadas
│       ├── config/               lectura y validación de variables de entorno
│       ├── db/
│       │   ├── pool.ts           Pool de pg
│       │   └── transaction.ts    ayuda para transacciones
│       ├── models/               animal.model.ts, adoption.model.ts…
│       ├── controllers/          animal.controller.ts…
│       ├── routes/               animal.routes.ts…, index.ts
│       ├── middlewares/          auth.ts, require-role.ts, validate.ts, error-handler.ts, upload.ts
│       ├── services/
│       │   ├── payment/          payment.service.ts, simulated.gateway.ts
│       │   ├── email/            email.service.ts, templates/
│       │   ├── storage/          storage.service.ts, local.storage.ts
│       │   ├── pdf/              (Fase 3)
│       │   └── activity-log.service.ts (Fase 3)
│       ├── jobs/                 billing.job.ts, expire-pending.job.ts…, scheduler.ts
│       ├── errors/               app-error.ts (clases de error HTTP)
│       └── utils/
└── client/
    ├── package.json
    ├── vite.config.ts            proxy /api y /uploads -> servidor
    ├── index.html
    └── src/
        ├── main.tsx
        ├── router.tsx
        ├── api/                  cliente HTTP y funciones por recurso
        ├── hooks/                useSession, useAnimals…
        ├── context/              SessionContext
        ├── pages/
        │   ├── public/           HomePage, CatalogPage, AnimalPage, DonatePage…
        │   ├── adopter/          MyAnimalsPage, FeedPage, ContributionsPage, ProfilePage…
        │   └── admin/            DashboardPage, AnimalsAdminPage, AnimalFormPage…
        ├── components/           AnimalCard, Pagination, DataTable, forms/…
        ├── layouts/              PublicLayout, AdopterLayout, AdminLayout
        ├── i18n/
        │   ├── index.ts
        │   └── locales/es.json   todos los textos de la interfaz
        └── styles/               variables.css, global.css
```

`seedsql.sql` y `TEST_DATA.sql` se colocan en `database/`; `TECH_SPEC.md` y `USE_CASES.md`, en `docs/`.

## 7. Convenciones

### 7.1 Idioma

| Elemento | Idioma | Ejemplo |
| --- | --- | --- |
| Identificadores de código, SQL, rutas de la API, archivos y directorios | Inglés | `AdoptionModel.findOpenByUser`, `GET /api/me/adoptions` |
| Valores de estado y tipos | Inglés | `active`, `deceased`, `per_update` |
| Comentarios en el código y en el SQL | Castellano | `-- Solo los adoptantes pueden adoptar` |
| Textos de la interfaz, emails y mensajes de error para el usuario | Castellano (vía i18n) | `t('adoption.errors.alreadyAdopted')` |
| Datos de ejemplo | Castellano | Nombres de animales e historias |
| Mensajes de commit | Inglés (Conventional Commits) | `feat(adoptions): add plan change (CU-20)` |

### 7.2 Nombres

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Tablas y columnas | `snake_case`, tablas en plural | `animal_updates.published_at` |
| Variables y funciones TS | `camelCase` | `nextBillingDate` |
| Tipos, interfaces y componentes React | `PascalCase` | `Adoption`, `AnimalCard` |
| Archivos del servidor | `kebab-case` + sufijo de capa | `animal-update.model.ts`, `animal-update.controller.ts` |
| Archivos de componentes React | `PascalCase.tsx` | `AnimalCard.tsx`, `AnimalCard.module.css` |
| Constantes | `UPPER_SNAKE_CASE` | `PENDING_EXPIRATION_DAYS = 7` |
| Rutas de la API | `kebab-case`, recursos en plural | `/api/admin/vet-records` |
| JSON de la API | `camelCase` | `{ "isPublished": true }` |

Los modelos convierten `snake_case` (base de datos) a `camelCase` (TypeScript) en un único punto, con una función `mapRow` por modelo.

### 7.3 Estilo de código

- `strict: true` en todos los `tsconfig.json`. Prohibido `any` salvo justificación en un comentario.
- Funciones `async`/`await`; nunca callbacks.
- Todo SQL parametrizado. **Nunca** concatenar valores del usuario en una consulta. Para ordenar por una columna elegida por el usuario, se usa una lista blanca de columnas.
- Las operaciones con varias escrituras (adoptar y pagar, cerrar adopciones al fallecer un animal…) se hacen en una transacción (`withTransaction`).
- Los importes se tratan como `string` al leerlos de PostgreSQL (`NUMERIC`) y se convierten con cuidado; en la API se envían como número con dos decimales. Nunca se suman importes con coma flotante en el cliente: los totales los calcula SQL.
- Las fechas se envían en ISO 8601. Las fechas sin hora (`DATE`) se tratan como texto `YYYY-MM-DD` para evitar desfases de zona horaria.
- Cada archivo exporta una sola responsabilidad. No hay archivos de más de 300 líneas sin motivo.

### 7.4 Git

- Rama principal `main`; una rama por funcionalidad (`feature/cu-13-adopt-animal`).
- Commits con Conventional Commits en inglés, citando el caso de uso.
- `.gitignore` incluye `node_modules/`, `.env`, `server/uploads/`, `dist/` y `coverage/`.

## 8. Modelo de datos

La estructura completa está en `database/seedsql.sql`. Esta sección resume las tablas y explica lo que se añadió o se concretó respecto al diseño funcional.

### 8.1 Correspondencia con el diseño funcional

| Diseño funcional | Tabla | Notas |
| --- | --- | --- |
| Usuario | `users` | |
| Especie | `species` | Una fila por especie de buitre; se añade `scientific_name` |
| Animal | `animals` | |
| Foto | `photos` | Admite también vídeos (`media_type`) y fotos de una actualización (`update_id`) |
| Plan_Adopción | `adoption_plans` | |
| Adopción | `adoptions` | |
| Pago | `payments` | Cuotas mensuales de las adopciones |
| Donación | `donations` | |
| Actualización | `animal_updates` | |
| Registro_Veterinario | `vet_records` | Fase 3; la tabla existe desde el principio |
| Notificación | `notifications` | |
| Registro_Actividad | `activity_logs` | Fase 3; la tabla existe desde el principio |
| *(nuevo)* | `user_tokens` | Tokens de verificación de email y recuperación de contraseña |
| *(nuevo)* | `user_sessions` | Sesiones (la gestiona `connect-pg-simple`) |
| *(nuevo)* | `update_reads` | Marca de «leído» del muro de actualizaciones |

### 8.2 Columnas añadidas y por qué

| Tabla.columna | Motivo |
| --- | --- |
| `users.email_notifications`, `users.email_frequency` | Preferencias de notificación: email sí/no y frecuencia (`per_update` o `monthly_digest`) |
| `users.preferred_language` | Preparado para varios idiomas (Fase 3) |
| `users.privacy_accepted_at` | Consentimiento RGPD al registrarse |
| `users.anonymized_at` | Baja con anonimización, conservando pagos y donaciones |
| `users.last_login_at` | Información para el panel |
| `animals.health_summary` | Resumen de salud en lenguaje sencillo para los adoptantes |
| `animals.status_changed_at` | Fecha del fallecimiento o traslado |
| `animals.show_in_memorial` | Sección «En memoria» (Fase 3) |
| `photos.media_type`, `photos.thumbnail_url`, `photos.update_id`, `photos.uploaded_by` | Vídeos, miniaturas y fotos de actualizaciones |
| `adoption_plans.is_default`, `adoption_plans.sort_order` | Plan preseleccionado (Usual) y orden de presentación |
| `adoptions.next_plan_id` | El cambio de plan se aplica en la siguiente cuota |
| `adoptions.cancel_requested_at` | La baja mantiene la adopción activa hasta el final del mes pagado |
| `adoptions.end_reason` | Motivo de cierre (baja, impago, fallecimiento, traslado…) |
| `adoptions.gifted_by_user_id` | Adopción regalo (Fase 3) |
| `adoptions.created_by`, `adoptions.notes` | Adopciones creadas a mano por un administrador |
| `payments.period_start`, `payments.period_end` | Mes cubierto por cada cuota; evita cobros duplicados |
| `payments.failure_reason`, `paid_at`, `refunded_at`, `recorded_by` | Trazabilidad de fallos, cobros, devoluciones y pagos manuales |
| `donations.failure_reason`, `paid_at`, `refunded_at`, `recorded_by` | Igual que en `payments` |

### 8.3 Estados de una adopción

```mermaid
stateDiagram-v2
    [*] --> pending: el adoptante inicia la adopción
    pending --> active: primer pago correcto
    pending --> pending: pago fallido (puede reintentar)
    pending --> cancelled: 7 días sin pagar\n(payment_not_completed)
    pending --> cancelled: el adoptante se da de baja\n(user_cancelled)
    paused --> finished: el adoptante se da de baja\n(user_cancelled)
    active --> active: cuota mensual cobrada
    active --> paused: cuota mensual fallida
    paused --> active: el adoptante reintenta y paga
    active --> finished: baja del adoptante\nal terminar el mes pagado (user_cancelled)
    active --> finished: animal fallecido o trasladado
    paused --> finished: animal fallecido o trasladado
    active --> cancelled: el administrador la cancela
    paused --> cancelled: el administrador la cancela
    active --> paused: el administrador la pausa
```

| Estado | Significado | ¿Se cobra? | ¿Recibe actualizaciones? |
| --- | --- | --- | --- |
| `pending` | Creada; primer pago no confirmado | No | No |
| `active` | Pago al día | Sí, cada mes en `next_billing_date` (salvo baja solicitada) | Sí |
| `paused` | Falló una cuota o la pausó un administrador | No, hasta que se regularice | No (ver [§18](#18-cuestiones-abiertas)) |
| `cancelled` | Terminada antes de tiempo | No | No |
| `finished` | Terminada de forma normal | No | No; conserva el historial |

**Baja del adoptante (CU-21):** se guarda `cancel_requested_at`, se fija `end_date` como el último día pagado y `next_billing_date` queda vacío. La adopción sigue `active` hasta `end_date`; después, la tarea diaria la pasa a `finished` con `end_reason = 'user_cancelled'`.

**Cambio de plan (CU-20):** se guarda en `next_plan_id`. En el siguiente cobro, la tarea de cobro copia `next_plan_id` a `plan_id`, lo vacía y cobra el nuevo importe.

### 8.4 Estados de pagos y donaciones

`pending` → `completed` o `failed`; `completed` → `refunded` (solo administrador). Los registros nunca se borran. Un reintento crea un registro nuevo; el fallido se conserva.

### 8.5 Consultas derivadas (no se guardan)

| Dato | Cálculo |
| --- | --- |
| Número de adoptantes actuales de un animal | `COUNT(*)` de adopciones `active` del animal |
| Nombres públicos de adoptantes | Adoptantes con adopción `active` y `users.show_public_name = TRUE` |
| Próxima actualización prevista | Fecha de la última actualización del animal + 14 días |
| Días sin actualización (escritorio) | Hoy − fecha de la última actualización, solo para animales con adopciones `active` |
| Edad aproximada | Hoy − `animals.approx_birth_date` |
| Ingresos del mes | `SUM` de `payments` y de `donations` `completed` por `paid_at`, por separado |

### 8.6 Reinicio de la base de datos

```bash
npm run db:reset    # ejecuta database/seedsql.sql y luego database/TEST_DATA.sql
```

`seedsql.sql` borra y recrea todas las tablas, y `TEST_DATA.sql` vacía e inserta los datos de prueba. El script `server/scripts/db-reset.ts` lee ambos archivos y los ejecuta con `pg`, así que no necesita `psql`. Ninguno de los dos archivos usa metacomandos de `psql`. Alternativa manual:

```bash
psql -d sanctuary -f database/seedsql.sql -f database/TEST_DATA.sql
```

Las fechas de `TEST_DATA.sql` son relativas al día de carga, así que los escenarios (pendientes caducadas, avisos de 14 días…) siempre son coherentes.

## 9. Autenticación y autorización

### 9.1 Decisión: sesiones con cookie

Se usan **sesiones en servidor guardadas en PostgreSQL** (`express-session` + `connect-pg-simple`) en lugar de JWT, porque:

- Es más sencillo: no hay que gestionar tokens de refresco ni listas de revocación.
- Cerrar sesión, desactivar una cuenta o cambiar de rol tiene efecto inmediato (se borran o invalidan sus sesiones).
- La cookie `httpOnly` no es accesible desde JavaScript, lo que reduce el riesgo de robo por XSS.
- Cliente y API se sirven desde el mismo origen (proxy de Vite en desarrollo y Express sirviendo el cliente en producción), así que no hay problemas de cookies entre dominios.

| Parámetro de la cookie | Valor |
| --- | --- |
| Nombre | `sid` |
| `httpOnly` | `true` |
| `sameSite` | `lax` |
| `secure` | `true` en producción (HTTPS); `false` en local |
| Duración | 7 días, renovada con cada petición (`rolling: true`) |
| Secreto | `SESSION_SECRET` (variable de entorno, mínimo 32 caracteres aleatorios) |

Al iniciar sesión se regenera el identificador de sesión (`req.session.regenerate`) para evitar la fijación de sesión. La sesión guarda solo `userId`; el usuario y su rol se leen de la base de datos en cada petición, para que los cambios de rol o la desactivación se apliquen al momento.

### 9.2 Contraseñas y tokens

- Hash con `bcryptjs`, coste 10.
- Requisitos mínimos de contraseña para el registro: 8 caracteres. Las contraseñas de `TEST_DATA.sql` no se validan con esta regla.
- **Tokens de un solo uso** (`user_tokens`): 32 bytes aleatorios (`crypto.randomBytes`) enviados por email. En la base de datos se guarda su hash SHA-256.
  - Verificación de email: caduca en 24 horas.
  - Recuperación de contraseña: caduca en 1 hora. Al usarse, se cierran todas las sesiones del usuario.
- La recuperación de contraseña responde siempre con el mismo mensaje, exista o no el email, para no revelar qué cuentas existen.
- Límite de intentos: 5 intentos fallidos de login por IP y email cada 15 minutos (`express-rate-limit`).

### 9.3 Creación de cuentas

| Tipo | Quién la crea | Cómo |
| --- | --- | --- |
| Adoptante | El propio usuario, desde el registro público | Siempre con `role = 'adopter'`, `email_verified = false`. Se envía el email de verificación. |
| Cuidador o administrador | Un administrador, desde el panel | Sin contraseña inicial: se crea un token `password_reset` de 24 horas y se envía un email para que el trabajador elija su contraseña. `email_verified = true`. |

El registro público **ignora** cualquier campo `role` que llegue en la petición.

### 9.4 Middlewares

```ts
requireAuth                     // 401 si no hay sesión válida o el usuario está inactivo
requireRole('adopter')          // 403 si el rol no coincide
requireRole('caretaker', 'admin')
requireVerifiedEmail            // 403 en las acciones que lo exijan (ver §18)
```

Además, cada modelo comprueba la **propiedad** del recurso: un adoptante solo accede a sus adopciones, pagos, donaciones y notificaciones. Si intenta acceder a un recurso ajeno, se responde con 404 (no 403), para no revelar que existe.

### 9.5 Matriz de permisos

| Recurso | Visitante | Adoptante | Cuidador | Administrador |
| --- | --- | --- | --- | --- |
| Catálogo y fichas publicadas | Leer | Leer | Leer | Leer |
| Actualizaciones `public` | Leer | Leer | Leer | Leer |
| Actualizaciones y fotos `adopters` | — | Leer las de sus animales con adopción activa | Leer todas | Leer todas |
| Donar | Sí | Sí (se vincula a su cuenta) | Sí, pero no se vincula a la cuenta de trabajo | Sí, pero no se vincula a la cuenta de trabajo |
| Adoptar | Debe registrarse | Sí | No | No |
| Sus adopciones, pagos, donaciones, notificaciones y perfil | — | CRUD según los casos de uso | Perfil propio | Perfil propio |
| Animales, fotos, especies | — | — | Crear, leer, editar; borrar fotos | Todo (incluido el borrado físico de animales sin adopciones) |
| Actualizaciones (panel) | — | — | Crear; editar y borrar las suyas | Todo |
| Historial veterinario (Fase 3) | — | — | Crear, leer, editar | Todo |
| Usuarios, adopciones, pagos, donaciones, planes, estadísticas, registro de actividad | — | — | — | Todo |
| Escritorio | — | — | Sí, sin datos económicos | Sí, completo |

## 10. API REST

### 10.1 Convenciones

- Prefijo `/api`. JSON en las peticiones y en las respuestas, en `camelCase`.
- **Paginación:** `?page=1&pageSize=20` (máximo 100). Respuesta: `{ "data": [...], "meta": { "page", "pageSize", "total", "totalPages" } }`.
- **Ordenación:** `?sort=name` o `?sort=-createdAt` (el signo `-` indica orden descendente), sobre una lista blanca de campos por recurso.
- **Formato de error:**

```json
{
  "error": {
    "code": "ADOPTION_ALREADY_OPEN",
    "message": "Ya tienes una adopción en curso de este animal.",
    "details": [{ "field": "animalId", "message": "..." }]
  }
}
```

| Código HTTP | Uso |
| --- | --- |
| 200 / 201 / 204 | Correcto / creado / sin contenido |
| 400 | Datos no válidos (Zod) |
| 401 | Sin sesión |
| 403 | Sin permiso (rol) o email sin verificar |
| 404 | No existe o no es del usuario |
| 409 | Conflicto con el estado actual (duplicado, adopción ya abierta…) |
| 422 | Regla de negocio incumplida (animal no adoptable…) |
| 429 | Demasiados intentos |
| 500 | Error interno (sin detalles técnicos en producción) |

- **Pagos simulados:** los endpoints que cobran aceptan `"simulatedOutcome": "success" | "failure"`. Si no se envía, decide el modo configurado en `PAYMENT_SIMULATION_MODE` ([§11.1](#111-servicio-de-pagos-simulado)).

### 10.2 Autenticación (`/api/auth`)

| Método | Ruta | Acceso | Descripción | CU |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | Visitante | Registro como adoptante; acepta la política de privacidad | CU-07 |
| POST | `/api/auth/verify-email` | Público | `{ token }` | CU-08 |
| POST | `/api/auth/resend-verification` | Autenticado | Reenvía el email de verificación | CU-08 |
| POST | `/api/auth/login` | Visitante | `{ email, password }` | CU-09 |
| POST | `/api/auth/logout` | Autenticado | Destruye la sesión | CU-11 |
| GET | `/api/auth/me` | Público | Usuario actual o `null` | CU-09 |
| POST | `/api/auth/forgot-password` | Público | `{ email }`; respuesta siempre igual | CU-10 |
| POST | `/api/auth/reset-password` | Público | `{ token, password }` | CU-10 |

### 10.3 Web pública

| Método | Ruta | Acceso | Descripción | CU |
| --- | --- | --- | --- | --- |
| GET | `/api/home` | Público | Animales destacados y número de animales acogidos | CU-01 |
| GET | `/api/animals` | Público | Catálogo. Filtros: `speciesId`, `sex`, `minAge`, `maxAge`, `adoptable`, `q` (nombre). Orden: `-arrivalDate` (más recientes), `name`, `adopterCount` (menos adoptantes). Solo animales publicados en estado `in_sanctuary` o `in_treatment`. | CU-02 |
| GET | `/api/animals/:id` | Público | Ficha pública. Si el usuario tiene una adopción activa del animal, incluye los datos ampliados. | CU-03, CU-16 |
| GET | `/api/animals/:id/updates` | Público | Actualizaciones públicas, o todas si el usuario es adoptante activo del animal | CU-03, CU-16 |
| GET | `/api/animals/memorial` | Público | Animales con `show_in_memorial = TRUE` (Fase 3) | CU-12 |
| GET | `/api/species` | Público | Lista de especies (para los filtros) | CU-02 |
| GET | `/api/plans` | Público | Planes activos | CU-04, CU-13 |
| POST | `/api/donations` | Público (sesión opcional) | Crea y paga una donación | CU-05 |
| POST | `/api/contact` | Público | Envía el formulario de contacto por email al santuario | CU-06 |

### 10.4 Área del adoptante (rol `adopter`)

| Método | Ruta | Descripción | CU |
| --- | --- | --- | --- |
| POST | `/api/adoptions` | `{ animalId, planId, simulatedOutcome? }`: crea la adopción `pending` y realiza el primer pago | CU-13 |
| GET | `/api/me/adoptions` | Mis adopciones con animal, plan, estado, fechas y próxima actualización prevista | CU-15 |
| GET | `/api/me/adoptions/:id` | Detalle de una adopción | CU-15 |
| POST | `/api/me/adoptions/:id/pay` | Reintentar el pago de una adopción `pending` o `paused` | CU-14 |
| PATCH | `/api/me/adoptions/:id/plan` | `{ planId }`: cambio de plan para la próxima cuota (o anulación del cambio) | CU-20 |
| POST | `/api/me/adoptions/:id/cancel` | Baja de la cuota mensual | CU-21 |
| GET | `/api/me/adoptions/:id/certificate` | Certificado PDF (Fase 3) | CU-22 |
| GET | `/api/me/feed` | Muro de actualizaciones de mis animales, con `isRead`. Filtro `?unread=true`. | CU-17 |
| PUT | `/api/me/feed/:updateId/read` | Marcar como leída | CU-17 |
| DELETE | `/api/me/feed/:updateId/read` | Marcar como no leída | CU-17 |
| GET | `/api/me/contributions` | Historial de cuotas y donaciones con mi cuenta | CU-19 |
| GET | `/api/me/payments/:id/receipt` | Recibo de una cuota | CU-19 |
| GET | `/api/me/donations/:id/receipt` | Recibo de una donación | CU-19 |
| POST | `/api/me/gifts` | Regalar una adopción (Fase 3) | CU-26 |

### 10.5 Cualquier usuario autenticado

| Método | Ruta | Descripción | CU |
| --- | --- | --- | --- |
| GET | `/api/me/notifications` | Notificaciones; `?unread=true` | CU-18 |
| PATCH | `/api/me/notifications/:id` | `{ isRead }` | CU-18 |
| POST | `/api/me/notifications/read-all` | Marcar todas como leídas | CU-18 |
| DELETE | `/api/me/notifications/:id` | Borrar una notificación | CU-18 |
| GET | `/api/me/profile` | Perfil | CU-23 |
| PATCH | `/api/me/profile` | Nombre, apellidos, teléfono, preferencias, `showPublicName` (este último solo para adoptantes) | CU-23 |
| PUT | `/api/me/password` | `{ currentPassword, newPassword }` | CU-24 |
| DELETE | `/api/me` | Baja y anonimización (solo adoptantes) | CU-25 |

### 10.6 Panel: cuidador y administrador (`/api/admin`)

| Método | Ruta | Acceso | Descripción | CU |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/dashboard` | Cuidador, admin | Resumen; los ingresos solo se incluyen para el administrador | CU-27 |
| GET | `/api/admin/animals` | Cuidador, admin | Listado con búsqueda y filtros (incluye ocultos y archivados) | CU-28 |
| POST | `/api/admin/animals` | Cuidador, admin | Alta | CU-28 |
| GET | `/api/admin/animals/:id` | Cuidador, admin | Detalle completo | CU-28 |
| PUT | `/api/admin/animals/:id` | Cuidador, admin | Edición, incluidos `isPublished` e `isAdoptable` | CU-28 |
| PATCH | `/api/admin/animals/:id/status` | Cuidador, admin | Cambio de estado; si es `deceased` o `transferred`, cierra las adopciones abiertas | CU-28, CU-33 |
| DELETE | `/api/admin/animals/:id` | Admin | Borrado físico; solo si nunca ha tenido adopciones | CU-28 |
| POST | `/api/admin/animals/:id/photos` | Cuidador, admin | Subida múltiple (`multipart/form-data`) | CU-29 |
| PATCH | `/api/admin/photos/:id` | Cuidador, admin | Texto alternativo, visibilidad | CU-29 |
| PUT | `/api/admin/animals/:id/photos/order` | Cuidador, admin | `{ photoIds: [...] }` | CU-29 |
| PUT | `/api/admin/animals/:id/cover` | Cuidador, admin | `{ photoId }` | CU-29 |
| DELETE | `/api/admin/photos/:id` | Cuidador, admin | Borra el registro y los archivos | CU-29 |
| GET / POST | `/api/admin/species` | Cuidador, admin | Listado y alta | CU-30 |
| PUT | `/api/admin/species/:id` | Cuidador, admin | Edición | CU-30 |
| DELETE | `/api/admin/species/:id` | Admin | Solo si ningún animal la usa | CU-30 |
| GET | `/api/admin/updates` | Cuidador, admin | Listado; filtro `?animalId=` | CU-31 |
| POST | `/api/admin/updates` | Cuidador, admin | Publica y notifica a los adoptantes activos | CU-31 |
| PUT | `/api/admin/updates/:id` | Autor, admin | Edición | CU-32 |
| DELETE | `/api/admin/updates/:id` | Autor, admin | Borrado (y sus fotos) | CU-32 |
| GET / POST | `/api/admin/animals/:id/vet-records` | Cuidador, admin | Historial veterinario (Fase 3) | CU-34 |
| PUT | `/api/admin/vet-records/:id` | Cuidador, admin | Edición (Fase 3) | CU-34 |
| DELETE | `/api/admin/vet-records/:id` | Admin | Borrado (Fase 3) | CU-34 |

### 10.7 Panel: solo administrador

| Método | Ruta | Descripción | CU |
| --- | --- | --- | --- |
| GET | `/api/admin/users` | Listado con filtros por rol y estado | CU-35 |
| GET | `/api/admin/users/:id` | Ficha con adopciones y aportaciones | CU-35 |
| PATCH | `/api/admin/users/:id` | `{ isActive }`, o `{ role }` solo entre `caretaker` y `admin` | CU-35, CU-36 |
| POST | `/api/admin/users` | Crear cuenta de trabajador | CU-36 |
| GET | `/api/admin/adoptions` | Listado con filtros por estado, animal y adoptante | CU-37 |
| GET | `/api/admin/adoptions/:id` | Detalle con sus pagos | CU-37 |
| POST | `/api/admin/adoptions` | Alta manual con primer pago manual (`cash` o `bank_transfer`) | CU-37 |
| PATCH | `/api/admin/adoptions/:id/status` | `{ action: "pause" \| "resume" \| "cancel", notes? }` | CU-37 |
| GET | `/api/admin/payments` | Listado con filtros | CU-38 |
| POST | `/api/admin/payments` | Registrar una cuota cobrada fuera de la web | CU-38 |
| POST | `/api/admin/payments/:id/refund` | Devolución | CU-38 |
| GET | `/api/admin/payments/export.csv` | Exportación CSV (filtros de fecha) | CU-38 |
| GET | `/api/admin/donations` | Listado con filtros | CU-39 |
| POST | `/api/admin/donations` | Registro manual (efectivo o transferencia) | CU-39 |
| POST | `/api/admin/donations/:id/refund` | Devolución | CU-39 |
| GET | `/api/admin/donations/export.csv` | Exportación CSV | CU-39 |
| GET | `/api/admin/donations/monthly-totals` | Total recaudado por mes | CU-39 |
| GET / POST | `/api/admin/plans` | Listado y alta | CU-40 |
| PUT | `/api/admin/plans/:id` | Nombre, importe, descripción, plan por defecto, activo | CU-40 |
| GET | `/api/admin/stats` | Estadísticas (Fase 3) | CU-41 |
| GET | `/api/admin/activity-logs` | Registro de actividad (Fase 3) | CU-42 |
| POST | `/api/admin/jobs/:jobName/run` | Ejecuta una tarea programada a mano (pruebas y demostraciones) | CU-43 a CU-47 |

## 11. Servicios y tareas programadas

### 11.1 Servicio de pagos (simulado)

El pago está aislado tras una interfaz, para poder sustituir la simulación por una pasarela real sin tocar el resto del código (ver el anexo «Paso a producción real»).

```ts
// server/src/services/payment/payment.service.ts
export interface ChargeRequest {
  amount: string;                   // "5.00"
  description: string;              // "Cuota Usual - Rufo - 2026-11"
  simulatedOutcome?: 'success' | 'failure';
}

export interface ChargeResult {
  success: boolean;
  reference: string;                // "SIM-20261110-8F3K2Q"
  failureReason?: string;
}

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(reference: string): Promise<{ success: boolean }>;
}
```

`SimulatedGateway` decide el resultado así:

1. Si la petición trae `simulatedOutcome`, se usa ese resultado. La interfaz muestra los botones «Simular pago correcto» y «Simular pago fallido».
2. Si no, se aplica `PAYMENT_SIMULATION_MODE`:
   - `always_succeed` (por defecto).
   - `always_fail`.
   - `random`, con `PAYMENT_SIMULATION_FAILURE_RATE` (de 0 a 1). Es útil para la tarea de cobro mensual.

**Nunca** se piden ni se guardan datos de tarjeta, ni siquiera inventados.

### 11.2 Servicio de email

- `nodemailer` con transporte SMTP configurable (`SMTP_HOST`, `SMTP_PORT`…). En local apunta a Mailpit (`localhost:1025`), y los emails se ven en `http://localhost:8025`.
- Plantillas en `services/email/templates/` como funciones TypeScript que devuelven `{ subject, html, text }`, con los textos en castellano.
- **Respeta las preferencias:** si `email_notifications = false`, no se envían emails de actualizaciones ni resúmenes. Los emails de seguridad (verificación, recuperación) y los de pago (recibos, fallos) se envían siempre.
- Si `email_frequency = 'monthly_digest'`, no se envía un email por cada actualización, solo el resumen mensual (CU-46).
- Un fallo al enviar un email **no** revierte la operación principal: se registra en el log y la notificación de la web (campana) se crea igualmente.

| Plantilla | Cuándo |
| --- | --- |
| `verify-email` | Registro y reenvío |
| `reset-password` | Recuperación de contraseña |
| `worker-invitation` | Alta de un trabajador |
| `adoption-welcome` | Adopción activada (incluye enlace al certificado en la Fase 3) |
| `payment-completed` | Cuota cobrada (con recibo) |
| `payment-failed` | Cuota fallida; adopción pausada |
| `plan-changed` | Cambio de plan programado |
| `adoption-cancelled` | Baja confirmada |
| `new-update` | Nueva actualización de un animal adoptado |
| `monthly-digest` | Resumen mensual |
| `donation-thanks` | Donación completada (con recibo) |
| `contact-message` | Formulario de contacto, al buzón del santuario (`SANCTUARY_EMAIL`) |
| *(sin plantilla)* | Fallecimiento de un animal: el texto lo escribe el santuario a mano (CU-33) |

### 11.3 Servicio de almacenamiento

```ts
export interface StorageService {
  save(file: Buffer, path: string, contentType: string): Promise<string>; // devuelve la URL
  delete(path: string): Promise<void>;
}
```

- **Local (fases 1 a 3):** `LocalStorage` guarda en `server/uploads/animals/<animalId>/`, y Express sirve la carpeta en `/uploads`.
- **Fase 4:** se podrá añadir una implementación en la nube con plan gratuito sin cambiar los controladores.
- Las fotos marcadas como `adopters` también se sirven desde `/uploads`, pero con nombre aleatorio (UUID), así que no se pueden adivinar. Si se necesitara protegerlas del todo, se serviría a través de un endpoint que compruebe la adopción (ver [§18](#18-cuestiones-abiertas)).

### 11.4 Tareas programadas

`node-cron` con zona horaria `Europe/Madrid` (`TZ`). Todas las tareas son **idempotentes**: ejecutarlas dos veces el mismo día no duplica cobros ni avisos. También se pueden lanzar a mano con `POST /api/admin/jobs/:jobName/run` o `npm run job -- <jobName>`.

| Tarea (`jobName`) | Horario | Qué hace | CU |
| --- | --- | --- | --- |
| `billing` | Diaria, 03:00 | Para cada adopción `active` sin baja solicitada y con `next_billing_date <= hoy`: aplica `next_plan_id` si existe, cobra, crea el registro en `payments` y avanza `next_billing_date` un mes. Si falla: pago `failed`, adopción `paused`, aviso al adoptante. Cada adopción se procesa en su propia transacción. | CU-43 |
| `expire-pending` | Diaria, 03:30 | Adopciones `pending` creadas hace más de 7 días → `cancelled` (`payment_not_completed`) | CU-44 |
| `finish-cancelled` | Diaria, 03:45 | Adopciones `active` con `cancel_requested_at` y `end_date < hoy` → `finished` (`user_cancelled`) | CU-45 |
| `monthly-digest` | Día 1, 09:00 | Email resumen para adoptantes con `monthly_digest` y novedades en el mes anterior | CU-46 |
| `update-reminder` | Diaria, 07:00 | Notificación (campana) a cuidadores y administradores por cada animal con adopciones activas que lleva 12 días o más sin actualización | CU-47 |

Las sesiones caducadas las elimina `connect-pg-simple` automáticamente. Los tokens caducados se borran en la tarea `expire-pending`.

### 11.5 Servicios de la Fase 3

- **`PdfService`:** certificado de adopción y recibos en PDF con `pdfkit`. Hasta la Fase 3, los recibos se muestran como una página HTML imprimible.
- **`ActivityLogService`:** `log(userId, action, tableName, recordId, details)`, llamado desde los controladores del panel después de cada operación de escritura. Nunca guarda contraseñas ni tokens.

## 12. Cliente (Vista)

### 12.1 Rutas

Las rutas del navegador están en inglés; los textos visibles, en castellano.

| Ruta | Página | Acceso |
| --- | --- | --- |
| `/` | Inicio | Público |
| `/animals` | Catálogo | Público |
| `/animals/:id` | Ficha del animal | Público |
| `/how-it-works` | Cómo funciona la adopción simbólica | Público |
| `/donate` | Donar | Público |
| `/about` | Sobre el santuario y contacto | Público |
| `/memorial` | En memoria (Fase 3) | Público |
| `/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password` | Autenticación | Público |
| `/adopt/:animalId` | Elegir plan y pagar | Adoptante |
| `/my-animals` | Mis animales | Adoptante |
| `/my-animals/:animalId` | Ficha ampliada | Adoptante |
| `/feed` | Muro de actualizaciones | Adoptante |
| `/my-contributions` | Mis aportaciones | Adoptante |
| `/profile` | Mi perfil | Autenticado |
| `/notifications` | Notificaciones | Autenticado |
| `/admin` | Escritorio | Cuidador, admin |
| `/admin/animals`, `/admin/animals/new`, `/admin/animals/:id` | Animales | Cuidador, admin |
| `/admin/species`, `/admin/updates`, `/admin/vet-records` | Especies, actualizaciones, historial veterinario | Cuidador, admin |
| `/admin/users`, `/admin/adoptions`, `/admin/payments`, `/admin/donations`, `/admin/plans`, `/admin/stats`, `/admin/activity` | Administración | Admin |

Las rutas protegidas usan un componente `<RequireRole roles={[...]}>` que redirige a `/login`. Es solo una mejora de la experiencia de uso; la seguridad la garantiza el servidor.

### 12.2 Pautas

- **Estado del servidor** con React Query; **sesión** en `SessionContext` (se carga con `GET /api/auth/me` al arrancar).
- **Formularios** con `react-hook-form` y los esquemas Zod de `shared/`. Los errores del servidor (`details`) se muestran junto al campo correspondiente.
- **Textos** siempre con `t('clave')` desde `i18n/locales/es.json`. Nunca texto fijo en los componentes.
- **Importes** con `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })` y **fechas** con `Intl.DateTimeFormat('es-ES')`.
- **Antes de adoptar**, la interfaz explica que la adopción es simbólica, que el animal no sale del santuario y que puede tener varios adoptantes.
- **Pasarela simulada:** una pantalla propia con un aviso claro de «Pago simulado: no se realizará ningún cargo real» y los botones de resultado.
- **Diseño adaptable:** la web pública y el área del adoptante se diseñan primero para móvil (desde 360 px); el panel prioriza el escritorio, pero debe poder usarse en una tablet.

## 13. Requisitos no funcionales

| Requisito | Implementación |
| --- | --- |
| **Seguridad HTTP** | `helmet`; cookies `httpOnly` y `sameSite=lax`; `app.set('trust proxy', 1)` en producción; límite de tamaño del cuerpo JSON (100 kB) |
| **CSRF** | `sameSite=lax`, además de aceptar solo `application/json` en las peticiones que modifican datos (las subidas `multipart` exigen una cabecera `X-Requested-With`) |
| **Inyección SQL** | Solo consultas parametrizadas; listas blancas para la ordenación |
| **XSS** | React escapa por defecto; prohibido `dangerouslySetInnerHTML` con contenido del usuario. Los textos de las actualizaciones son texto plano con saltos de línea. |
| **Autorización** | En el servidor, en cada ruta ([§9](#9-autenticación-y-autorización)) |
| **RGPD** | Casilla de aceptación de la política de privacidad al registrarse (`privacy_accepted_at`); banner de cookies informativo (solo hay cookies técnicas de sesión). Derecho de acceso: el perfil y «Mis aportaciones». Rectificación: editar el perfil. Supresión: CU-25. |
| **Anonimización (CU-25)** | `first_name = 'Usuario'`, `last_name = 'eliminado'`, `email = 'deleted-<id>@anonymized.invalid'`, `phone = NULL`, contraseña aleatoria, `is_active = FALSE`, `show_public_name = FALSE`, `anonymized_at = NOW()`. Se cierran sus adopciones abiertas (`account_deleted`), se borran sus sesiones, tokens, notificaciones y lecturas, y en sus donaciones se vacían `donor_name` y `donor_email`. Se conservan los importes de pagos y donaciones. |
| **Accesibilidad** | `alt_text` obligatorio en cada foto; contraste AA (4,5:1); navegación completa con teclado y foco visible; etiquetas `<label>` en todos los campos; HTML semántico |
| **Imágenes** | JPEG, PNG o WebP, máximo 5 MB. `sharp` las redimensiona a un máximo de 1600 px de ancho (WebP, calidad 80) y crea una miniatura de 400 px. Vídeos: MP4, máximo 50 MB, sin procesar; en la Fase 4 se revisará según el almacenamiento disponible. Máximo 10 archivos por subida. |
| **Rendimiento** | Paginación en todos los listados; índices definidos en `seedsql.sql`; miniaturas en las tarjetas del catálogo |
| **Copias de seguridad** | Script `npm run db:backup` (`pg_dump` a `backups/<fecha>.sql`) y copia de `server/uploads/`. En local se ejecuta a mano; en la Fase 4 se automatiza. |
| **Logs** | `pino`: peticiones, errores y resultado de las tareas programadas. Nunca se registran contraseñas, tokens ni cookies. |
| **Idioma** | Castellano; `i18next` preparado para valenciano (`ca`) e inglés (`en`) en la Fase 3 |
| **Zona horaria** | `Europe/Madrid` para las tareas y la presentación de fechas; la base de datos guarda `TIMESTAMPTZ` |

## 14. Configuración y entorno local

### 14.1 Requisitos

- Node.js LTS (22 o superior).
- PostgreSQL 14 o superior, instalado en el ordenador **o** con Docker Compose.
- Mailpit, como binario **o** con Docker Compose.

### 14.2 Variables de entorno (`.env.example`)

| Variable | Ejemplo | Descripción |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` o `production` |
| `PORT` | `3000` | Puerto de la API |
| `CLIENT_URL` | `http://localhost:5173` | URL del cliente (para los enlaces de los emails) |
| `DATABASE_URL` | `postgres://sanctuary:sanctuary@localhost:5432/sanctuary` | Base de datos de desarrollo |
| `TEST_DATABASE_URL` | `postgres://sanctuary:sanctuary@localhost:5432/sanctuary_test` | Base de datos de pruebas |
| `SESSION_SECRET` | *(aleatorio, 32+ caracteres)* | Firma de la cookie de sesión |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` | Mailpit |
| `SMTP_USER` / `SMTP_PASSWORD` | *(vacío en local)* | Credenciales SMTP |
| `MAIL_FROM` | `"Santuario <no-reply@santuario.test>"` | Remitente |
| `SANCTUARY_EMAIL` | `contacto@santuario.test` | Buzón para el formulario de contacto |
| `UPLOADS_DIR` | `./uploads` | Carpeta de archivos subidos |
| `PAYMENT_SIMULATION_MODE` | `always_succeed` | `always_succeed`, `always_fail` o `random` |
| `PAYMENT_SIMULATION_FAILURE_RATE` | `0.2` | Solo con `random` |
| `JOBS_ENABLED` | `true` | Activa `node-cron` (en las pruebas, `false`) |
| `JOBS_TRIGGER_TOKEN` | *(aleatorio)* | Fase 4: permite lanzar tareas desde un programador externo |
| `TZ` | `Europe/Madrid` | Zona horaria del proceso |

`server/src/config/` valida estas variables con Zod al arrancar y detiene el servidor con un mensaje claro si falta alguna.

### 14.3 Scripts (`package.json` raíz)

| Script | Acción |
| --- | --- |
| `npm install` | Instala las dependencias de todos los workspaces |
| `npm run dev` | Arranca la API (`tsx watch`) y el cliente (Vite) a la vez |
| `npm run build` | Compila `shared`, `server` y `client` |
| `npm start` | Arranca la API compilada, que sirve también el cliente compilado |
| `npm run db:reset` | Ejecuta `seedsql.sql` y `TEST_DATA.sql` sobre `DATABASE_URL` |
| `npm run db:reset:test` | Lo mismo sobre `TEST_DATABASE_URL` |
| `npm run db:backup` | `pg_dump` de la base de datos |
| `npm run job -- <jobName>` | Ejecuta una tarea programada a mano |
| `npm test` | Pruebas unitarias y de integración |
| `npm run test:e2e` | Pruebas de Playwright |
| `npm run lint` / `npm run format` | ESLint / Prettier |

### 14.4 Docker Compose (opcional)

`docker-compose.yml` define dos servicios: `postgres` (imagen oficial `postgres`, puerto 5432, volumen persistente) y `mailpit` (puertos 1025 y 8025). La aplicación Node se ejecuta fuera de Docker para facilitar el desarrollo. Si se tiene PostgreSQL instalado en el ordenador, basta con crear la base de datos:

```bash
createdb sanctuary
createdb sanctuary_test
npm run db:reset
```

### 14.5 Usuarios de prueba

Están documentados en la cabecera de `database/TEST_DATA.sql`. Resumen:

- **Trabajadores:** contraseña `NombreApellido26#!`, sin tildes. Por ejemplo, `marta.soler@santuario.test` con `MartaSoler26#!` (admin) y `nuria.peris@santuario.test` con `NuriaPeris26#!` (cuidadora).
- **Adoptantes:** cada uno con su propia contraseña. Por ejemplo, `lucia.martinez@correo.test` con `Lucia.buitres1`.

Los dominios `.test` e `.invalid` están reservados y nunca corresponden a direcciones reales.

## 15. Estrategia de pruebas

| Nivel | Herramienta | Qué se prueba | Desde |
| --- | --- | --- | --- |
| Unitarias | Vitest | Funciones puras: cálculo de fechas de cobro, `SimulatedGateway`, conversión de filas, esquemas Zod | Fase 1 |
| Modelos | Vitest + base de datos de pruebas | Consultas y reglas de negocio contra PostgreSQL real | Fase 1 |
| Integración de la API | Vitest + Supertest | Cada endpoint: respuesta correcta, validación (400), sin sesión (401), rol incorrecto (403), recurso ajeno (404) | Fase 1 |
| Componentes | Vitest + React Testing Library | Formularios, filtros del catálogo, estados de carga y error | Fase 1 |
| Extremo a extremo | Playwright | Recorridos completos: registro → adopción → pago → «Mis animales»; publicar actualización → aparece en el muro; donación sin cuenta | Fase 2 |

- Antes de cada fichero de pruebas de integración se ejecuta `db:reset:test`. Las pruebas usan los usuarios y escenarios de `TEST_DATA.sql`.
- En las pruebas: `PAYMENT_SIMULATION_MODE=always_succeed`, `JOBS_ENABLED=false` y un transporte de email en memoria.
- Cada caso de uso tiene al menos una prueba que lo cita en su nombre: `describe('CU-13 Adoptar un animal', ...)`.
- Objetivo de cobertura: **70 %** en `models/`, `services/` y `jobs/`.
- Las tareas programadas se prueban llamando a su función directamente con una fecha «hoy» inyectada.

## 16. Fases de desarrollo

Cada fase termina con una versión que funciona y se puede demostrar. La Fase 3 se diseña desde el principio (tablas, columnas e i18n ya existen), así que añadirla no requiere migraciones ni rehacer código. La **Fase 4 (despliegue)** es la última y se distingue de las demás: no añade funcionalidades, sino que publica la aplicación.

### Fase 1 — MVP

**Objetivo:** catálogo público, registro, adopción con pago simulado y gestión básica de animales.

| Entregable | Casos de uso |
| --- | --- |
| Monorepo, configuración, `db:reset`, errores y logs | — |
| Web pública: inicio, catálogo, ficha, cómo funciona | CU-01, CU-02, CU-03, CU-04 |
| Registro, verificación de email (Mailpit), login, logout y recuperación de contraseña | CU-07, CU-08, CU-09, CU-10, CU-11 |
| Adopción con los tres planes y pago simulado; reintento | CU-13, CU-14 |
| «Mis animales», ficha ampliada y muro de actualizaciones | CU-15, CU-16, CU-17 |
| Perfil (incluida la opción de aparecer en la ficha) y cambio de contraseña | CU-23, CU-24 |
| Panel: escritorio básico, CRUD de animales, fotos, especies y actualizaciones | CU-27, CU-28, CU-29, CU-30, CU-31, CU-32 |

**Criterios de aceptación:**

- [ ] `npm run db:reset` y `npm run dev` levantan el proyecto desde cero siguiendo solo este documento.
- [ ] Un visitante puede registrarse, verificar el email, adoptar a un buitre con cualquier plan y verlo en «Mis animales».
- [ ] Un cuidador puede dar de alta un buitre con fotos, publicarlo y escribir una actualización que aparece en el muro de sus adoptantes.
- [ ] Un adoptante no puede abrir dos adopciones del mismo animal, y un trabajador no puede adoptar.
- [ ] Todas las rutas del panel devuelven 401 o 403 si no se tiene el rol adecuado (comprobado con pruebas).
- [ ] Al cambiar un animal a `deceased` o `transferred`, sus adopciones abiertas se cierran (el aviso al adoptante se añade en la Fase 2).

### Fase 2 — Cuotas, donaciones y notificaciones

**Objetivo:** ciclo económico completo y comunicación con los adoptantes.

| Entregable | Casos de uso |
| --- | --- |
| Tareas programadas: cobro mensual, caducidad de pendientes, fin de bajas, resumen mensual, recordatorio de actualizaciones | CU-43, CU-44, CU-45, CU-46, CU-47 |
| Cambio de plan y baja | CU-20, CU-21 |
| Donaciones con y sin cuenta | CU-05 |
| Notificaciones (campana) y emails según preferencias | CU-18, CU-31 (notificación) |
| Historial de aportaciones y recibos (HTML imprimible) | CU-19 |
| Fallecimiento o traslado con aviso redactado a mano | CU-33 |
| Formulario de contacto | CU-06 |
| Baja de cuenta con anonimización | CU-25 |
| Administración: usuarios, trabajadores, adopciones, pagos, donaciones y planes; exportaciones CSV | CU-35, CU-36, CU-37, CU-38, CU-39, CU-40 |
| Escritorio completo (ingresos, alertas de 14 días) | CU-27 |
| Pruebas extremo a extremo de los recorridos principales | — |

**Criterios de aceptación:**

- [ ] Con `TEST_DATA.sql` recién cargado, ejecutar `billing`, `expire-pending` y `finish-cancelled` produce los cambios esperados en las adopciones de prueba, y ejecutarlas dos veces no duplica nada.
- [ ] Un cobro fallido pausa la adopción, avisa al adoptante y se puede regularizar desde «Mis animales».
- [ ] Se puede donar sin cuenta, de forma anónima y con importes como 0,50 €.
- [ ] Los emails llegan a Mailpit respetando las preferencias de cada usuario.
- [ ] Los CSV de pagos y donaciones se abren correctamente en una hoja de cálculo (separador `;`, UTF-8 con BOM, decimales con coma).

### Fase 3 — Extras

**Objetivo:** funcionalidades complementarias. Puede quedar incompleta sin afectar a las anteriores.

| Entregable | Casos de uso |
| --- | --- |
| Historial veterinario | CU-34 |
| Estadísticas | CU-41 |
| Registro de actividad | CU-42 |
| Certificado de adopción en PDF y recibos en PDF | CU-22, CU-19 |
| Adopción regalo | CU-26 |
| Sección «En memoria» | CU-12 |
| Valenciano e inglés (archivos `ca.json` y `en.json`, selector de idioma, `preferred_language`) | — |

**Criterios de aceptación:**

- [ ] Ninguna funcionalidad de la Fase 3 requiere cambios en la estructura de la base de datos.
- [ ] Las pruebas de las fases 1 y 2 siguen pasando.

### Fase 4 — Despliegue (fase final)

**Objetivo:** publicar en internet la aplicación construida en las fases anteriores, **sin coste**. Los pagos siguen siendo simulados: pasar a pagos reales es otro proyecto, descrito en el anexo «Paso a producción real».

**Decisiones de arquitectura que ya facilitan el despliegue (fases 1 a 3):**

- Express sirve el cliente compilado (`client/dist`), así que hay **un solo servicio web** con un solo dominio y la cookie de sesión no tiene problemas entre dominios.
- El almacenamiento de archivos está detrás de `StorageService`, el email detrás de un transporte SMTP configurable y las tareas se pueden lanzar por HTTP con un token.
- Toda la configuración se lee de variables de entorno.

**Tareas:**

1. **Elegir proveedores con plan gratuito sin tarjeta.** Se elegirán al empezar esta fase, porque las condiciones de los planes gratuitos cambian a menudo. Para cada necesidad se compararán varias opciones:

   | Necesidad | Qué buscar |
   | --- | --- |
   | Servidor Node | Servicio web gratuito con HTTPS. Suelen «dormirse» tras un rato sin visitas. |
   | PostgreSQL | Base de datos gestionada gratuita, versión 14 o superior, con `pgcrypto`. Comprobar si caduca a los X días. |
   | Archivos (fotos y vídeos) | Almacenamiento de objetos o servicio de imágenes gratuito, porque el disco de los servidores gratuitos suele borrarse al reiniciar |
   | Email | Servicio SMTP con cupo diario gratuito |
   | Tareas programadas | Si el servidor «se duerme», `node-cron` no es fiable: se usará un programador externo gratuito (por ejemplo, un flujo programado de GitHub Actions) que llame a `POST /api/admin/jobs/:jobName/run` con `JOBS_TRIGGER_TOKEN` |

2. Añadir la implementación de `StorageService` para el proveedor elegido.
3. Introducir migraciones numeradas en `database/migrations/`. **A partir de este momento, `seedsql.sql` no se ejecuta nunca contra la base de datos desplegada**, porque borraría todos los datos.
4. Cargar en producción solo los datos iniciales imprescindibles (especies, planes y una cuenta de administrador), no `TEST_DATA.sql`.
5. Configurar las variables de entorno de producción: `NODE_ENV=production`, `secure` en las cookies, `trust proxy` y secretos nuevos.
6. Automatizar las copias de seguridad de la base de datos con el mismo programador externo.
7. Poner un aviso visible en toda la web de que es un proyecto académico con pagos simulados.

**Criterios de aceptación:**

- [ ] La aplicación funciona en una URL pública con HTTPS.
- [ ] Coste total: 0 €, sin tarjeta registrada en ningún proveedor.
- [ ] Las tareas programadas se ejecutan a diario aunque el servidor esté dormido.
- [ ] Las fotos subidas sobreviven a un reinicio del servidor.
- [ ] Existe un documento breve (`docs/DEPLOYMENT.md`) con los pasos para volver a desplegar.

## 17. Guía de ampliación

| Ampliación | Cómo hacerla |
| --- | --- |
| **Nueva especie** (por ejemplo, lince ibérico) | Alta desde el panel (CU-30). Si la especie tiene razas, se usa `animals.breed`. No requiere cambios de código. |
| **Nuevo idioma** | Añadir `client/src/i18n/locales/<código>.json` y el valor en el `CHECK` de `users.preferred_language` |
| **Pasarela de pago real** | Nueva clase que implemente `PaymentGateway`; se elige por configuración. Ver el anexo «Paso a producción real». |
| **Nuevo tipo de notificación** | Añadir el valor al `CHECK` de `notifications.type`, a las constantes de `shared/` y crear la plantilla de email |
| **Nuevo estado de animal** | Añadir el valor al `CHECK` de `animals.status`, a `shared/constants/status.ts` y a las traducciones |
| **Solicitar visita al santuario** (idea futura) | Nueva tabla `visit_requests` mediante migración |

Los estados se definen con `VARCHAR` + `CHECK` en lugar de `ENUM` precisamente para que añadir un valor sea un cambio de una línea.

## 18. Cuestiones abiertas

Estas decisiones funcionales no están en el diseño. Hasta que se decidan, se aplica el **comportamiento provisional** indicado.

| # | Cuestión | Comportamiento provisional |
| --- | --- | --- |
| 1 | ¿Cuánto tiempo puede estar una adopción en `paused` antes de cerrarse? | Sin límite: sigue pausada hasta que el adoptante pague o un administrador la cancele |
| 2 | ¿Un adoptante con una adopción `paused` sigue recibiendo actualizaciones? | No: solo las adopciones `active` dan acceso al contenido exclusivo |
| 3 | ¿Puede adoptar o donar con su cuenta un usuario con el email sin verificar? | Puede iniciar sesión y navegar, pero debe verificar el email antes de adoptar (`requireVerifiedEmail`). Donar siempre se permite, incluso sin cuenta. |
| 4 | ¿Las fotos y vídeos `adopters` deben estar protegidos frente a quien conozca la URL? | No: basta con URLs no adivinables (UUID). Se puede reforzar en la Fase 4. |
| 5 | ¿Qué plan se aplica si el administrador desactiva un plan con adopciones activas? | Las adopciones existentes siguen con ese plan; solo deja de ofrecerse en nuevas adopciones |
| 6 | Adopción regalo (Fase 3): ¿quién paga las cuotas después de la primera, quien regala o quien la recibe? | Sin decidir; debe resolverse antes de implementar CU-26. La base de datos ya admite ambos casos (`adoptions.gifted_by_user_id`). |

## 19. Glosario

| Término | Definición |
| --- | --- |
| Adopción simbólica | Colaboración mensual con un animal que sigue viviendo en el santuario. También «apadrinamiento» o «adopción a distancia». |
| Adoptante | Persona externa registrada con rol `adopter` |
| Trabajador | Usuario con rol `caretaker` (cuidador) o `admin` (administrador) |
| Actualización | Publicación sobre un animal (texto y fotos) que reciben sus adoptantes |
| Cuota | Pago mensual de una adopción |
| Donación | Pago único al santuario, no vinculado a un animal |
| Pasarela simulada | Servicio interno que imita el resultado de un cobro sin mover dinero |
| Adopción abierta | Adopción en estado `pending`, `active` o `paused` |
| Idempotente | Operación que da el mismo resultado aunque se ejecute varias veces |