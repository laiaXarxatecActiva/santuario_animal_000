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
| **Idioma** | Documentación en castellano. Interfaz, emails y PDF en castellano, valenciano e inglés (Fase 3). Código, SQL, nombres de archivos y directorios, rutas de la API y valores de estado en inglés. |
| **Versión de PostgreSQL** | El SQL debe funcionar en PostgreSQL 14 o superior, para usar la versión que haya instalada en cada ordenador. Probado en PostgreSQL 16. |

## 4. Tecnologías

Todas son gratuitas y de código abierto. Se usa la última versión estable disponible al iniciar el proyecto, respetando las versiones mínimas.

### 4.1 Base

| Capa | Tecnología | Versión mínima | Motivo |
| --- | --- | --- | --- |
| Lenguaje | TypeScript | 5.x | Tipado en cliente y servidor; tipos compartidos |
| Entorno de ejecución | Node.js (LTS) | 24.7 | Soporte nativo de `--env-file`, `fetch` y `crypto.argon2` (hash de contraseñas sin dependencias) |
| Servidor | Express | 5.x | Gestiona errores de funciones `async` sin envoltorios |
| Base de datos | PostgreSQL | 14 | Requisito del proyecto |
| Cliente | React | 19 | Requisito del proyecto |
| Empaquetador del cliente | Vite | — | Arranque rápido, proxy de desarrollo hacia la API |
| Gestor de paquetes | npm (workspaces) | 10 | Incluido con Node; monorepo sin herramientas extra |

### 4.2 Librerías del servidor

| Necesidad | Librería | Notas |
| --- | --- | --- |
| Acceso a datos | `pg` (node-postgres) | SQL escrito a mano y **siempre parametrizado** (`$1, $2…`). Sin ORM. |
| Sesiones | `express-session` + store propio (`middlewares/session.ts`) | Sesiones guardadas en la tabla `user_sessions`, solo con el SHA-256 del identificador |
| Hash de contraseñas | `crypto.argon2` (nativo de Node) | Argon2id, el algoritmo recomendado por OWASP, sin dependencias ni compilación. |
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

1. El navegador envía la petición con la cookie de sesión (`sid`; `__Host-sid` en producción).
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
| Trabajo diario: los turnos acaban después de empezar; la salida, después de la entrada; una persona no tiene dos veces el mismo turno el mismo día; solo los trabajadores tienen turnos y ausencias; una ausencia acaba el mismo día o después | `CHECK shift_templates_times`, `CHECK shift_assignments_check_out`, `UNIQUE shift_assignments_unique`, triggers `shift_assignments_check_worker` y `absences_check_worker`, `CHECK absences_dates`. Un turno con personas asignadas no se borra (`ON DELETE RESTRICT`) |
| Cuidados (CU-65 a CU-69): cantidades de la dieta mayores que 0; fin de la dieta y de las pautas igual o posterior al inicio; de 1 a 12 horas por pauta; solo se anota la comida de una tarea de alimentación completada; una tarea sale como mucho de una plantilla, una pauta o una visita; una dosis no se duplica; el registro veterinario de una visita solo si está hecha | `CHECK diet_items.quantity`, `CHECK diet_items_dates_order`, `CHECK medication_plans_dates_order`, `CHECK medication_plans_times_count`, trigger `feeding_logs_check_task`, `CHECK task_instances_one_origin`, índice único `task_instances_medication_due_key`, `CHECK vet_visits_record_only_done` |

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
| Textos de la interfaz, emails y mensajes de error para el usuario | Castellano, valenciano e inglés (vía i18n; ver §7.1.1) | `t('adoption.errors.alreadyAdopted')` |
| Datos de ejemplo | Castellano | Nombres de animales e historias |

#### 7.1.1 Varios idiomas (Fase 3)

- **Interfaz:** `client/src/i18n/locales/{es,ca,en}.json`, con las mismas claves (lo comprueba `client/tests/locales.test.ts`). El idioma inicial es el elegido en el navegador (`localStorage.language`), si no el del navegador y, si no, castellano (`i18n/idioma.ts`). Con sesión manda `preferredLanguage` de la cuenta. El selector de la cabecera y la sección «Idioma» del perfil lo cambian y lo guardan con `PATCH /api/me/profile`. Los formatos de fechas, importes y listas (`utils/format.ts`) siguen el idioma y `<html lang>` cambia con él.
- **Mensajes de validación:** se escriben una vez, en castellano, en los esquemas Zod compartidos y en el servidor; `FieldError` los traduce al mostrarlos (`i18n/mensajesValidacion.ts`). Los errores de negocio se traducen por su `code` (`errors.<CODE>`).
- **Emails, avisos de la campana y PDF:** en el idioma del destinatario (`users.preferred_language`). Las plantillas reciben `language`; los avisos se guardan ya traducidos (`servicios/textos-avisos.ts`, el modelo elige el texto con `CASE u.preferred_language`); el certificado y los recibos usan `dominio/documentos.ts`. Una donación sin cuenta usa el idioma de la web al donar (`language` en `POST /api/donations`). El buzón interno del contacto sigue en castellano.
- **No se traducen** los contenidos que escribe el santuario (animales, especies, actualizaciones, planes) ni el nombre «Santuario de Animales», que es una marca.
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
| *(nuevo)* | `user_tokens` | Tokens de verificación de email, recuperación de contraseña e invitación de trabajadores |
| *(nuevo)* | `user_sessions` | Sesiones (las gestiona el store propio de `middlewares/session.ts`) |
| *(nuevo)* | `update_reads` | Marca de «leído» del muro de actualizaciones |
| *(nuevo, trabajo diario)* | `zones` | Zonas o recintos; `animals.zone_id` dice dónde vive cada animal (CU-52) |
| *(nuevo, trabajo diario)* | `qualifications`, `user_qualifications` | Cualificaciones y las de cada trabajador (un trigger exige que sea trabajador, CU-53) |
| *(nuevo, trabajo diario)* | `task_templates`, `task_template_animals` | Plantillas de tareas recurrentes: tipo, horas (`TIME[]`), repetición (`daily`, `weekdays` con `weekdays SMALLINT[]` ISO 1-7, o `every_n_days` con `interval_days`), fechas, zona, animales y cualificación (CU-54) |
| *(nuevo, trabajo diario)* | `task_instances`, `task_instance_animals` | Tareas concretas: copia de la plantilla, `due_date`/`due_time` en Madrid y `due_at` (`TIMESTAMPTZ`), estado `pending`/`completed`/`not_done`, asignación, quién y cuándo la resolvió, observaciones y foto. Sin plantilla, es puntual. Índice único parcial `(template_id, due_at)` para generar sin duplicados; el trigger `check_task_people` exige que la persona asignada y quien la completa sean trabajadores con la cualificación (CU-55 a CU-59) |
| *(nuevo, trabajo diario)* | `work_settings` | Una sola fila (`id = 1`) con `late_margin_minutes` (CU-73) |
| *(nuevo, trabajo diario)* | `shift_templates`, `shift_zone_requirements` | Plantillas de turno: nombre único (sin distinguir mayúsculas), `start_time` < `end_time` (el mismo día), `weekdays` (1 = lunes … 7 = domingo) y si está activa; y cuántas personas (`min_workers`, 1-20) necesita cada zona (CU-60) |
| *(nuevo, trabajo diario)* | `shift_assignments`, `shift_assignment_zones` | Una persona en un turno un día (`shift_date`), con sus zonas, `checked_in_at` y `checked_out_at`. `UNIQUE (shift_template_id, shift_date, user_id)`; el trigger `shift_assignments_check_worker` exige un trabajador (CU-61, CU-63) |
| *(nuevo, trabajo diario)* | `absences` | Ausencias: persona, `start_date`, `end_date`, `type` (`vacation`, `sick_leave`, `personal`, `other`), notas y quién la registró (CU-62) |
| *(nuevo, trabajo diario)* | `staff_alerts` | Avisos internos ya enviados: `kind` y `ref_key` únicos (para `coverage_gap`, `fecha:turno:zona`; para `low_intake`, `animal:primera toma de la racha`; para `medication_missed` y `vet_visit_today`, el id de la dosis o de la visita), para que cada aviso salga una sola vez (CU-64, CU-67 a CU-69) |
| *(nuevo, trabajo diario)* | `diet_items` | Dieta de cada animal: alimento, `quantity` (`NUMERIC(8,2)`) y `unit` (`g`, `kg`, `units`, `ml`), tomas (texto), notas, `start_date` y `end_date` (terminada). No genera tareas (CU-65) |
| *(nuevo, trabajo diario)* | `feeding_logs` | Lo que comió cada animal en una tarea de alimentación: `(task_id, animal_id)` e `intake` (`all`, `most`, `little`, `none`). Se borra al deshacer la tarea (CU-66) |
| *(nuevo, trabajo diario)* | `medication_plans` | Pautas de medicación: medicamento, dosis, vía (`oral`, `injection`, `topical`, `eye_drops`, `other`), horas (`TIME[]`, todos los días), fechas, cualificación necesaria y notas. Sus dosis son tareas con `task_instances.medication_plan_id` (CU-69) |
| *(nuevo, trabajo diario)* | `vet_visits` | Visitas veterinarias programadas: día, hora, motivo, veterinario, `status` (`scheduled`, `done`, `cancelled`) y el registro del historial creado al hacerla (`vet_record_id`). Su tarea de «Mi día» lleva `task_instances.vet_visit_id` (CU-68) |
| *(cambio, trabajo diario)* | `work_settings`, `task_instances` | `work_settings.low_intake_meals` (1-10, 2 por defecto): tomas seguidas comiendo poco para avisar (CU-67). `task_instances.medication_plan_id` y `vet_visit_id` |
| *(nuevo, trabajo diario)* | `incidents` | Incidencias: `category` (`health`, `behavior`, `facilities`, `other`), `severity` (`low`, `medium`, `high`), descripción, zona y/o animal (CHECK `incidents_place`), foto, `status` (`open`, `in_progress`, `resolved`), quién la comunicó, la resolución con quién y cuándo (CHECK `incidents_resolution`: resuelta ⇔ con resolución) y la tarea creada a partir de ella (`task_id`, `SET NULL`) (CU-70) |
| *(nuevo, trabajo diario)* | `handover_notes`, `handover_note_reads` | Notas de relevo de una zona (autor y texto de 1 a 1000 caracteres) y quién las ha leído (PK `note_id, user_id`) (CU-71) |
| *(cambio, trabajo diario)* | `work_settings`, `notifications` | `work_settings.email_alert_types` (`TEXT[]`, CHECK dentro de los cinco tipos de aviso del personal; todos menos `vet_visit_today` por defecto), `daily_summary_enabled` (falso) y `daily_summary_time` (`TIME`, 20:00) (CU-73, CU-74). `notifications.email_pending` con índice parcial: la bandeja de salida de los emails de aviso; tipo nuevo `incident_reported` |

### 8.2 Columnas añadidas y por qué

| Tabla.columna | Motivo |
| --- | --- |
| `users.email_notifications`, `users.email_frequency` | Preferencias de notificación: email sí/no y frecuencia (`per_update` o `monthly_digest`) |
| `users.digest_sent_for` | Primer día del último mes resumido por `monthly-digest`: como máximo un resumen al mes, aunque la tarea se repita (CU-46) |
| `users.preferred_language` | Idioma de la web, los emails y los PDF (`es`, `ca`, `en`; Fase 3) |
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
| `adoptions.payment_mode`, `adoptions.payment_reminder_sent_for` | Forma de pago elegida por el adoptante (`automatic` por defecto o `manual`, CU-49) y última cuota manual avisada (CU-50) |
| `adoptions.end_reason` | Motivo de cierre (baja, impago, fallecimiento, traslado…) |
| `adoptions.gifted_by_user_id` | Adopción regalo (CU-26, descartada en la Fase 3: la columna se conserva, siempre a `NULL`) |
| `adoptions.created_by`, `adoptions.notes` | Adopciones creadas a mano por un administrador |
| `payments.period_start`, `payments.period_end` | Mes cubierto por cada cuota; evita cobros duplicados |
| `payments.plan_id` | Plan con el que se cobró la cuota; el recibo lo muestra aunque la adopción cambie de plan después |
| `payments.failure_reason`, `paid_at`, `refunded_at`, `recorded_by` | Trazabilidad de fallos, cobros, devoluciones y pagos manuales |
| `donations.failure_reason`, `paid_at`, `refunded_at`, `recorded_by` | Igual que en `payments` |
| `donations.donor_surname`, `donor_phone` | Datos del donante que pide la web (CU-05); el teléfono, móvil español sin separadores (`donations_phone_format`) |
| `donations.tax_certificate`, `donor_tax_id`, `donor_address`, `donor_postal_code`, `donor_province`, `donor_country` | Certificado para desgravar: si se pide, los datos fiscales son obligatorios (`donations_tax_data_required`) |

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
| `active` | Pago al día | Sí, cada mes en `next_billing_date` (salvo baja solicitada). Con pago manual (CU-49) la paga el adoptante; si pasan 7 días sin pagarla, pasa a `paused` (CU-50) | Sí |
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
| Tarea atrasada (trabajo diario) | `status = 'pending'` y ahora > `due_at` + `work_settings.late_margin_minutes` |

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

Se usan **sesiones en servidor guardadas en PostgreSQL** (`express-session` con un store propio) en lugar de JWT, porque:

- Es más sencillo: no hay que gestionar tokens de refresco ni listas de revocación.
- Cerrar sesión, desactivar una cuenta o cambiar de rol tiene efecto inmediato (se borran o invalidan sus sesiones).
- La cookie `httpOnly` no es accesible desde JavaScript, lo que reduce el riesgo de robo por XSS.
- Cliente y API se sirven desde el mismo origen (proxy de Vite en desarrollo y Express sirviendo el cliente en producción), así que no hay problemas de cookies entre dominios.

| Parámetro de la cookie | Valor |
| --- | --- |
| Nombre | `sid` en local; `__Host-sid` en producción (el prefijo obliga al navegador a exigir `Secure`, `Path=/` y que no haya `Domain`) |
| `httpOnly` | `true` |
| `sameSite` | `lax` |
| `path` | `/`, sin `Domain` |
| `secure` | `true` en producción (HTTPS); `false` en local |
| Duración | 7 días, renovada con cada petición (`rolling: true`) |
| Secreto | `SESSION_SECRET` (variable de entorno, mínimo 32 caracteres aleatorios) |

El store propio (`PgSessionStore`, en `server/src/middlewares/session.ts`; SQL en `models/session.model.ts`) guarda en `user_sessions` **solo el SHA-256 del identificador** (`sid_hash`), nunca el identificador: quien lea la tabla o una copia de seguridad no puede suplantar a nadie. Además, la cookie va firmada con `SESSION_SECRET`. La caducidad se comprueba en el servidor (`expire > NOW()`), no solo en la cookie, y las sesiones caducadas se borran cada 15 minutos. La columna `user_id` permite cerrar todas las sesiones de un usuario (CU-10, CU-24, CU-35 y, a petición de un administrador, CU-48). La política completa de seguridad está en `docs/AUTH_SPEC.md`.

Al iniciar sesión se regenera el identificador de sesión (`req.session.regenerate`) para evitar la fijación de sesión. La sesión guarda solo `userId`; el usuario y su rol se leen de la base de datos en cada petición, para que los cambios de rol o la desactivación se apliquen al momento.

### 9.2 Contraseñas y tokens

- Hash con **Argon2id** (`crypto.argon2` de Node), con los parámetros mínimos de OWASP: 19 MiB de memoria, 2 pasadas y paralelismo 1, sal aleatoria de 16 bytes y hash de 32 bytes. Se guarda en formato PHC (`$argon2id$v=19$m=19456,t=2,p=1$<sal>$<hash>`), de modo que se pueden subir los parámetros más adelante sin invalidar los hashes existentes. Los parámetros están en `server/src/utils/passwords.ts`.
- Contraseñas de **10 a 128 caracteres**, sin reglas de composición (se permiten espacios, símbolos y pegar desde un gestor de contraseñas). El máximo evita que un texto enorme se use para cargar el servidor. Las contraseñas de `TEST_DATA.sql` no se validan con esta regla; sus hashes Argon2id ya vienen calculados en el archivo.
- **Tokens de un solo uso** (`user_tokens`): 32 bytes aleatorios (`crypto.randomBytes`) enviados por email. En la base de datos se guarda su hash SHA-256.
  - Verificación de email: caduca en 24 horas.
  - Recuperación de contraseña: caduca en 30 minutos. Al usarse, se cierran todas las sesiones del usuario.
  - Invitación de un trabajador (`worker_invitation`, CU-36): caduca en 24 horas. Se usa en el mismo `POST /api/auth/reset-password` que la recuperación, con los mismos efectos. Cada tipo anula solo los suyos al pedir otro.
- **Sin enumeración de cuentas**: el registro y la recuperación de contraseña responden siempre igual, exista o no el email. En el registro, si el email ya tiene cuenta no se crea nada y se avisa por email a su dueño (CU-07 3a); el registro nunca abre sesión. El login responde con el mismo error para email inexistente y contraseña incorrecta, y compara con un hash ficticio cuando el email no existe, para que tarde lo mismo.
- Límites de intentos (`express-rate-limit`, en memoria; con varias instancias habría que compartir los contadores): 5 intentos fallidos de login por IP y email y 50 por IP cada 15 minutos; registro, 20 por hora por IP y 3 por hora por email; reenvío de la verificación, 3 por hora por usuario; cambio de contraseña, 5 intentos fallidos por usuario cada 15 minutos.

### 9.3 Creación de cuentas

| Tipo | Quién la crea | Cómo |
| --- | --- | --- |
| Adoptante | El propio usuario, desde el registro público | Siempre con `role = 'adopter'`, `email_verified = false`. Se envía el email de verificación. |
| Cuidador o administrador | Un administrador, desde el panel | Sin contraseña inicial: se crea un token `worker_invitation` de 24 horas y se envía un email para que el trabajador elija su contraseña. `email_verified = true`. |

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
| POST | `/api/auth/register` | Visitante | Registro como adoptante; acepta la política de privacidad. Responde siempre `202 { message }`, exista o no el email, y no abre sesión | CU-07 |
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
| GET | `/api/animals/:id` | Público | Ficha pública. `exclusiveAccess` indica si quien consulta es adoptante activo del animal o trabajador; en ese caso incluye `healthSummary` y las fotos `adopters` (con su `visibility`). | CU-03, CU-16 |
| GET | `/api/animals/:id/updates` | Público | Actualizaciones públicas, o todas si el usuario es adoptante activo del animal o trabajador; al adoptante se le indica `isRead` | CU-03, CU-16 |
| GET | `/api/animals/memorial` | Público | Animales fallecidos con `show_in_memorial = TRUE` (Fase 3), del fallecimiento más reciente al más antiguo. Cada uno trae lo que necesita su ficha de solo lectura: foto de portada, especie, llegada (`arrivalDate`), fallecimiento (`deathDate`), historia, fotos públicas y actualizaciones públicas (como mucho 50). Sin datos de adopción. En el panel, `showInMemorial` se marca al registrar el fallecimiento (`PATCH …/status`) o en la edición (`PUT /api/admin/animals/:id`); solo vale para fallecidos (422 `MEMORIAL_ONLY_DECEASED`) | CU-12 |
| GET | `/api/species` | Público | Lista de especies (para los filtros) | CU-02 |
| GET | `/api/plans` | Público | Planes activos | CU-04, CU-13 |
| POST | `/api/donations` | Público (sesión opcional) | `{ amount, donorName, donorSurname, donorEmail, donorPhone?, isAnonymous, message?, acceptPrivacy: true, taxCertificate, donorTaxId?, donorAddress?, donorPostalCode?, donorProvince?, donorCountry?, simulatedOutcome?, language? }`: cobra con la pasarela simulada y guarda la donación con el resultado (201, también si falla: `status = 'failed'`). Con `taxCertificate`, los datos fiscales son obligatorios (NIF o NIE con su letra, código postal español); sin él, se descartan. Devuelve `receiptToken`, la firma del enlace al recibo. Un adoptante la vincula a su cuenta; un trabajador no. 10 por hora y por IP | CU-05 |
| GET | `/api/donations/:id/receipt.pdf?token=&lang=` | Público, con la firma | Recibo en PDF de una donación cobrada o devuelta (o «Certificado de donación», si pidió el certificado). `token` es la firma HMAC-SHA256 de `donation-receipt:<id>` con `SESSION_SECRET`: sin ella, con una que no es la suya o si la donación falló, 404. `lang` elige el idioma del PDF; `?download=1` lo descarga. `Cache-Control: no-store` | CU-05 |
| POST | `/api/contact` | Público | `{ name, email, subject, message, acceptPrivacy: true }`: email al santuario con `Reply-To` del visitante (202). Si falla el envío, 503 `EMAIL_NOT_SENT`. No se guarda. 5 por hora y por IP | CU-06 |

### 10.4 Área del adoptante (rol `adopter`)

| Método | Ruta | Descripción | CU |
| --- | --- | --- | --- |
| POST | `/api/adoptions` | `{ animalId, planId, paymentMode? }` (`automatic` si no llega, CU-49): crea la adopción `pending` (CU-13 paso 5). El primer pago se hace después con `/api/me/adoptions/:id/pay`, así que si se abandona la ventana de pago la adopción queda pendiente (6b) | CU-13 |
| GET | `/api/me/adoptions` | Mis adopciones con animal, plan, estado, fechas, `canPay`, `paymentMode`, `paymentDeadline` (último día para pagar la cuota manual sin pausa, o `null`) y próxima actualización prevista. Filtro `?animalId=` (lo usa la pantalla «Adoptar» para el caso 5a) | CU-15 |
| GET | `/api/me/adoptions/:id` | Detalle de una adopción | CU-15 |
| POST | `/api/me/adoptions/:id/pay` | `{ simulatedOutcome? }`: primer pago (CU-13 pasos 6-8) o reintento de una adopción `pending` o `paused`, o cuota de una `active` con pago manual desde 7 días antes (CU-49; antes, 422 `ADOPTION_NOT_PAYABLE`). Un pago fallido responde 200 con `payment.status = 'failed'` | CU-13, CU-14 |
| PATCH | `/api/me/adoptions/:id/plan` | `{ planId }`: cambio de plan para la próxima cuota (o anulación del cambio si es el plan actual). Solo `active` sin baja (422 `PLAN_CHANGE_NOT_ALLOWED`). Devuelve la adopción | CU-20 |
| PATCH | `/api/me/adoptions/:id/payment-mode` | `{ paymentMode }` (`automatic` o `manual`): forma de pago desde la próxima cuota. Solo `pending`, `paused` o `active` sin baja (422 `PAYMENT_MODE_CHANGE_NOT_ALLOWED`). Devuelve la adopción | CU-49 |
| POST | `/api/me/adoptions/:id/cancel` | Baja (`{}`): la activa sigue hasta el último día pagado, la pendiente pasa a `cancelled` y la pausada a `finished`. Baja ya pedida: 409 `ADOPTION_CANCEL_ALREADY_REQUESTED`; cerrada: 422 `ADOPTION_CLOSED`. Devuelve la adopción | CU-21 |
| GET | `/api/me/adoptions/:id/certificate` | Certificado PDF (Fase 3) de una adopción propia `active` (si no, 422 `CERTIFICATE_NOT_AVAILABLE`): nombre del adoptante, nombre, especie y foto de portada del animal (sin foto si no tiene o no se puede leer) y fecha de inicio. Se abre en el navegador (`inline`) o, con `?download=1`, se descarga como `certificado-<animal>.pdf`. `Cache-Control: no-store` | CU-22 |
| GET | `/api/me/feed` | Muro de actualizaciones de mis animales (adopciones activas, desde su `start_date`), con `isRead`. Filtros `?unread=true` y `?animalId=`. `meta.unreadCount` da las no leídas de todo el muro (contador del menú) | CU-17 |
| PUT | `/api/me/feed/:updateId/read` | Marcar como leída | CU-17 |
| DELETE | `/api/me/feed/:updateId/read` | Marcar como no leída | CU-17 |
| GET | `/api/me/contributions` | `{ payments, donations, totals: { allTime, years } }`: cuotas y donaciones con mi cuenta, las más recientes primero. `?year=` filtra los listados (no los totales); los totales solo suman lo cobrado | CU-19 |
| GET | `/api/me/payments/:id/receipt` | Datos del recibo de una cuota cobrada o devuelta (fallida o pendiente: 422 `RECEIPT_NOT_AVAILABLE`), con el plan con el que se cobró (`payments.plan_id`) | CU-19 |
| GET | `/api/me/donations/:id/receipt` | Datos del recibo de una donación cobrada o devuelta | CU-19 |
| GET | `/api/me/payments/:id/receipt.pdf`, `/api/me/donations/:id/receipt.pdf` | Recibo en PDF (Fase 3) con los mismos datos y reglas; `inline` o, con `?download=1`, descarga de `recibo-<referencia>.pdf`. `Cache-Control: no-store` | CU-19 |

### 10.5 Cualquier usuario autenticado

| Método | Ruta | Descripción | CU |
| --- | --- | --- | --- |
| GET | `/api/me/notifications` | Notificaciones; `?unread=true` | CU-18 |
| PATCH | `/api/me/notifications/:id` | `{ isRead }` | CU-18 |
| POST | `/api/me/notifications/read-all` | Marcar todas como leídas | CU-18 |
| DELETE | `/api/me/notifications/:id` | Borrar una notificación | CU-18 |
| GET | `/api/me/profile` | Perfil | CU-23 |
| PATCH | `/api/me/profile` | Cambios parciales: nombre, apellidos, teléfono (móvil español de 9 dígitos, sin +34; se guarda sin separadores), preferencias de email y `showPublicName` (estos tres, solo para adoptantes: 403 `ADOPTER_ONLY_PREFERENCE`). El email no se puede cambiar | CU-23 |
| PUT | `/api/me/password` | `{ currentPassword, newPassword }`. La nueva debe ser distinta de la actual. Cierra las demás sesiones y anula los enlaces de recuperación pendientes. 5 intentos fallidos por usuario cada 15 minutos | CU-24 |
| DELETE | `/api/me` | Baja y anonimización (solo adoptantes; un trabajador recibe 403). `{ password }`; si no es correcta, 422 `INVALID_PASSWORD` y no cambia nada. Responde 200 `{ message }`, cierra todas las sesiones y borra la cookie. Mismo límite de intentos que `PUT /api/me/password` | CU-25 |

### 10.6 Panel: cuidador y administrador (`/api/admin`)

| Método | Ruta | Acceso | Descripción | CU |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/dashboard` | Cuidador, admin | Resumen; los ingresos solo se incluyen para el administrador | CU-27 |
| GET | `/api/admin/animals` | Cuidador, admin | Listado con búsqueda y filtros (incluye ocultos y archivados) | CU-28 |
| POST | `/api/admin/animals` | Cuidador, admin | Alta | CU-28 |
| GET | `/api/admin/animals/:id` | Cuidador, admin | Detalle completo | CU-28 |
| PUT | `/api/admin/animals/:id` | Cuidador, admin | Edición, incluidos `isPublished` e `isAdoptable` | CU-28 |
| PATCH | `/api/admin/animals/:id/status` | Cuidador, admin | Cambio de estado (`status`, `date`, `message`); si es `deceased` o `transferred`, cierra las adopciones abiertas y avisa a cada afectado (notificación `adoption_closed` y email). Un fallecimiento con adopciones abiertas exige `message` (422 `FAREWELL_MESSAGE_REQUIRED`), que se publica como actualización «solo adoptantes» con el trabajador como autor | CU-28, CU-33 |
| DELETE | `/api/admin/animals/:id` | Admin | Borrado físico; solo si nunca ha tenido adopciones | CU-28 |
| GET | `/api/admin/animals/:id/photos` | Cuidador, admin | Galería del animal (todas las visibilidades, sin las fotos de actualizaciones), en su orden | CU-29 |
| POST | `/api/admin/animals/:id/photos` | Cuidador, admin | Subida múltiple (`multipart/form-data`: archivos en `files` y, en `meta`, un JSON con el texto alternativo y la visibilidad de cada uno). Responde `{ created, rejected }`: 201 si se ha guardado alguno, 200 si se han rechazado todos | CU-29 |
| PATCH | `/api/admin/photos/:id` | Cuidador, admin | Texto alternativo, visibilidad | CU-29 |
| PUT | `/api/admin/animals/:id/photos/order` | Cuidador, admin | `{ photoIds: [...] }` | CU-29 |
| PUT | `/api/admin/animals/:id/cover` | Cuidador, admin | `{ photoId }` | CU-29 |
| DELETE | `/api/admin/photos/:id` | Cuidador, admin | Borra el registro y los archivos | CU-29 |
| GET / POST | `/api/admin/species` | Cuidador, admin | Listado y alta | CU-30 |
| PUT | `/api/admin/species/:id` | Cuidador, admin | Edición | CU-30 |
| DELETE | `/api/admin/species/:id` | Admin | Solo si ningún animal la usa | CU-30 |
| GET | `/api/admin/updates` | Cuidador, admin | Listado; filtro `?animalId=` | CU-31 |
| GET | `/api/admin/updates/:id` | Cuidador, admin | Detalle con el texto y las fotos; `canEdit` indica si quien consulta puede editarla | CU-32 |
| POST | `/api/admin/updates` | Cuidador, admin | Publica y notifica a los adoptantes activos (`new_update` y, si lo quieren por actualización, email); responde con `notifiedAdopters`. JSON o, con fotos, `multipart/form-data` (`files` + `meta` con el texto alternativo de cada una); las fotos heredan la visibilidad de la actualización y, si alguna no es válida, no se publica nada (422 `FILES_REJECTED`) | CU-31 |
| PUT | `/api/admin/updates/:id` | Autor, admin | Edición (sin volver a notificar): título, texto, visibilidad, fotos nuevas y `removePhotoIds` | CU-32 |
| DELETE | `/api/admin/updates/:id` | Autor, admin | Borrado (y sus fotos) | CU-32 |
| GET / POST | `/api/admin/animals/:id/vet-records` | Cuidador, admin | Historial veterinario (Fase 3) | CU-34 |
| PUT | `/api/admin/vet-records/:id` | Cuidador, admin | Edición (Fase 3) | CU-34 |
| DELETE | `/api/admin/vet-records/:id` | Admin | Borrado (Fase 3) | CU-34 |
| GET | `/api/admin/zones` | Cuidador, admin | Zonas por nombre con `animalCount` (sin archivados). Trabajo diario | CU-52 |
| GET | `/api/admin/qualifications` | Cuidador, admin | Cualificaciones con `workerCount` | CU-53 |
| GET | `/api/admin/my-day` | Cuidador, admin | `?date` (hoy por defecto). `{ date, tasks, shifts }`: los turnos de quien consulta ese día y cada tarea con `late` (calculado), `mine` (asignada a quien consulta o, sin asignar, de una zona de su turno a una hora dentro del turno) y `blockedReason` (`FUTURE_DAY`, `MISSING_QUALIFICATION` o `NOT_PENDING`) | CU-56 |
| GET | `/api/admin/shift-templates` | Cuidador, admin | Plantillas de turno por hora de inicio, con `requirements` y `hasAssignments` | CU-60 |
| GET | `/api/admin/shifts` | Cuidador, admin | `?from&to` (como mucho 31 días; sin fechas, la semana actual de lunes a domingo). `{ from, to, shifts, assignments, absences, gaps }`; al cuidador, las ausencias ajenas le llegan sin `type` ni `notes` | CU-61, CU-62 |
| POST | `/api/admin/shift-assignments/:id/check-in`, `/check-out` | La persona del turno | Ficha la entrada o la salida; un turno ajeno es 404. 422 `SHIFT_NOT_TODAY`; 409 `ALREADY_CHECKED_IN`, `NOT_CHECKED_IN`, `ALREADY_CHECKED_OUT` | CU-63 |
| POST | `/api/admin/tasks/:id/complete` | Cuidador, admin | JSON `{ observations?, intakes? }` o `multipart/form-data` con `observations`, `intakes` (texto JSON) y una foto en `files` (se guarda en WebP en `uploads/tasks/:id/`). `intakes` (`[{ animalId, intake }]`) solo en las de alimentación: lo que falta es `all`; anota `feeding_logs` y avisa si un animal come poco (CU-66, CU-67). 409 `TASK_NOT_PENDING`, 422 `TASK_FUTURE_DAY`, 403 `MISSING_QUALIFICATION`, 409 `VET_VISIT_NEEDS_RECORD` (una visita se completa con su registro) | CU-57 |
| GET | `/api/admin/animals/:id/care` | Cuidador, admin | Pestaña «Cuidados»: `{ animalId, diet, feedings (14 días), lowIntakeStreak, medicationPlans (con dosesGiven, dosesMissed, hasHistory), vetVisits (programadas y las 5 últimas hechas o canceladas, con taskId) }` | CU-65 a CU-69 |
| POST / PUT / DELETE | `/api/admin/animals/:id/diet-items`, `/api/admin/diet-items/:id` | Cuidador, admin | Dieta. 422 `CARE_ANIMAL_ARCHIVED` si el animal ya no está | CU-65 |
| POST / PUT / DELETE | `/api/admin/animals/:id/medication-plans`, `/api/admin/medication-plans/:id` | Cuidador, admin | Pautas: al crearlas o editarlas se (re)generan sus dosis pendientes desde ahora. 422 `ANIMAL_WITHOUT_ZONE`, `CARE_ANIMAL_ARCHIVED`; borrar con dosis resueltas, 409 `MEDICATION_PLAN_HAS_HISTORY` | CU-69 |
| POST | `/api/admin/medication-plans/:id/end` | Cuidador, admin | Termina hoy y quita las dosis que faltan. 409 `MEDICATION_PLAN_NOT_STARTED`, `MEDICATION_PLAN_ENDED` | CU-69 |
| POST / PUT | `/api/admin/animals/:id/vet-visits`, `/api/admin/vet-visits/:id` | Cuidador, admin | Programar o cambiar una visita (no en un día pasado); crea o mueve su tarea `health_check`. 409 `VET_VISIT_NOT_SCHEDULED` | CU-68 |
| POST | `/api/admin/vet-visits/:id/cancel`, `/complete` | Cuidador, admin | Cancelar (quita su tarea) o registrar con el cuerpo de un registro veterinario (crea el registro, marca la visita `done` y completa su tarea). 422 `VET_VISIT_FUTURE_DAY` | CU-68 |
| POST | `/api/admin/tasks/:id/not-done` | Cuidador, admin | `{ reason }` obligatorio; mismas comprobaciones | CU-57 |
| GET / POST | `/api/admin/incidents` | Cuidador, admin | Listado (`?status` = `active` por defecto, `open`, `in_progress`, `resolved` o `all`; `?severity&zoneId&page&pageSize`; las graves primero) y alta (JSON o `multipart/form-data` con una foto en `files`, guardada en `uploads/incidents/`). Las de gravedad alta avisan al momento | CU-70 |
| GET | `/api/admin/incidents/:id` | Cuidador, admin | Ficha | CU-70 |
| GET / POST | `/api/admin/handover-notes` | Cuidador, admin | Notas de las últimas 24 h de las zonas del turno de hoy (el administrador, todas), con `isRead` y `mine`; alta `{ zoneId, body }` (error en el campo si no tiene turno hoy en la zona) | CU-71 |
| PUT | `/api/admin/handover-notes/:id/read` | Cuidador, admin | Marca como leída (404 si no la puede ver) | CU-71 |
| POST | `/api/admin/tasks/:id/reopen` | Quien la resolvió (el mismo día), admin | Vuelve a pendiente y borra observaciones y foto; 409 `TASK_IS_PENDING` | CU-57 |

### 10.7 Panel: solo administrador

| Método | Ruta | Descripción | CU |
| --- | --- | --- | --- |
| GET | `/api/admin/users` | Listado con filtros por rol y estado | CU-35 |
| GET | `/api/admin/users/:id` | Ficha con adopciones y aportaciones | CU-35 |
| PATCH | `/api/admin/users/:id` | `{ isActive }`, o `{ role }` solo entre `caretaker` y `admin` (uno de los dos). Desactivar cierra todas las sesiones y, si es un adoptante, da de baja sus adopciones. 422 si el administrador se desactiva a sí mismo, si se reactiva una cuenta anonimizada o si el último administrador activo dejaría de serlo | CU-35 |
| POST | `/api/admin/users/:id/invitation` | Reenvía la invitación (anula la anterior). Solo a un trabajador activo que nunca ha entrado; si no, 409 `INVITATION_NOT_PENDING` | CU-36 |
| POST | `/api/admin/users` | Crear cuenta de trabajador | CU-36 |
| POST | `/api/admin/users/:id/logout-all` | `{ reason }` obligatorio (1-500 caracteres). Cierra todas las sesiones del usuario y responde `{ closedSessions }`; sobre la propia cuenta mantiene la sesión actual. No cambia nada más de la cuenta. Queda en el registro de actividad con el motivo | CU-48 |
| POST | `/api/admin/users/:id/password-reset` | Solo admin. Envía al trabajador (cuidador u otro administrador, activo y que no sea quien lo pide) un enlace `password_reset` de 30 minutos para elegir otra contraseña; anula los anteriores. `204`; si no se puede, 422 `PASSWORD_RESET_NOT_ALLOWED` | CU-51 |
| GET | `/api/admin/adoptions` | Listado con `?q` (adoptante por nombre o email, o animal), `status`, `planId`, `animalId`, `userId` y `sort` (lista blanca; por defecto `-createdAt`) | CU-37 |
| GET | `/api/admin/adoptions/:id` | Detalle con sus pagos (con quién registró los manuales), las notas internas y quién la creó | CU-37 |
| POST | `/api/admin/adoptions` | Alta manual `{ userId, animalId, planId, method, notes? }`: nace `active` con su primer pago `completed` (`cash` o `bank_transfer`, referencia `CASH-…` o `TRF-…`, `recorded_by`) y se avisa como en CU-13. El adoptante debe tener la cuenta activa (422 `ADOPTER_NOT_AVAILABLE`); no hace falta que haya verificado el email | CU-37 |
| PATCH | `/api/admin/adoptions/:id/status` | `{ action: "pause" \| "resume" \| "cancel", notes?, refundLastPayment? }`; con `refundLastPayment` (solo al cancelar) se devuelve también la última cuota cobrada en la misma transacción; `notes` es obligatorio para pausar y cancelar y se añade a las notas internas. 422 `ADOPTION_ACTION_NOT_ALLOWED` si la acción no corresponde al estado. Se avisa al adoptante sin enseñarle la nota | CU-37 |
| GET | `/api/admin/payments` | Listado con `?q` (adoptante o animal), `status`, `method`, `from`, `to` (día del cobro o, si no se cobró, del intento, en Europe/Madrid), `adoptionId` y `sort`; devuelve además `totalCollected` (suma de los `completed` del filtro, en SQL) | CU-38 |
| POST | `/api/admin/payments` | `{ adoptionId, amount, method }` (`cash` o `bank_transfer`): registra la cuota pendiente de la adopción (la del próximo cobro; si está pendiente de pago, el primer mes desde hoy). La adopción queda activa, aplica el cambio de plan programado y el próximo cobro avanza un mes. 422 `MANUAL_PAYMENT_NOT_ALLOWED` o `ADOPTION_PAYMENT_EXPIRED` si no hay cuota; 409 si el periodo ya está pagado | CU-38 |
| POST | `/api/admin/payments/:id/refund` | Devolución de un pago `completed` (422 `PAYMENT_NOT_REFUNDABLE` si no). Los pagos de la web pasan por `PaymentGateway.refund`; los de efectivo o transferencia solo se marcan. Avisa al adoptante (campana y email) y no cambia la adopción | CU-38 |
| GET | `/api/admin/payments/export.csv` | Exportación CSV con los mismos filtros, sin páginas (`;`, UTF-8 con BOM, decimales con coma, fechas `dd/mm/aaaa`, fórmulas neutralizadas). Una cuenta eliminada sale como «Usuario eliminado», sin email | CU-38 |
| GET | `/api/admin/donations` | Listado con `?q` (nombre o email del donante), `status`, `method`, `from`, `to` (día del cobro o, si no se cobró, del intento, en Europe/Madrid) y `sort`; devuelve además `totalCollected` (suma de las `completed` del filtro, en SQL). El administrador ve el nombre y el email aunque la donación sea anónima | CU-39 |
| POST | `/api/admin/donations` | `{ amount, date, method, donorName?, donorEmail?, isAnonymous, message? }` con `method` `cash` o `bank_transfer`: queda `completed`, sin cuenta vinculada y con `recorded_by`. `date` (hoy por defecto en el formulario) no puede ser futura ni inexistente (400 en el campo `date`); si es anterior a hoy, `paid_at` es el mediodía de ese día. Con email, se envía el agradecimiento con el recibo | CU-39 |
| POST | `/api/admin/donations/:id/refund` | Devolución de una donación `completed` (422 `DONATION_NOT_REFUNDABLE` si no). Las de la web pasan por `PaymentGateway.refund`; las de efectivo o transferencia solo se marcan. Avisa al donante por email (si lo dio) y en la campana (si tiene cuenta) | CU-39 |
| GET | `/api/admin/donations/export.csv` | Exportación CSV con los mismos filtros, sin páginas (mismo formato que la de pagos), con una columna «Anónima» | CU-39 |
| GET | `/api/admin/donations/monthly-totals` | `{ data: [{ month: 'YYYY-MM', total, count }] }`: lo cobrado (`completed`) cada mes, con `q`, `method`, `from` y `to`. Sin fechas, los últimos 12 meses; los meses sin donaciones salen a 0 | CU-39 |
| GET / POST | `/api/admin/plans` | Listado y alta | CU-40 |
| PUT | `/api/admin/plans/:id` | Nombre, importe, descripción, plan por defecto, activo | CU-40 |
| GET | `/api/admin/stats` | Estadísticas (Fase 3), solo admin. `?from&to` (días; se toman sus meses; por defecto los últimos 12 meses, como mucho 60: si no, 400 en `from`). Devuelve `range`, `revenueByMonth` (lo `completed` por mes, cuotas y donaciones por separado, igual que los ingresos del escritorio), `adoptionsByMonth` (`started` por `start_date`; `ended` por `end_date` de las `cancelled`/`finished` que llegaron a empezar), y la situación actual: `mostAdopted` (5 con más adopciones activas), `withoutAdopters` (en el santuario o en tratamiento sin adopciones activas) y `activeByPlan`. Todos los meses del rango, también los que están a 0 | CU-41 |
| GET | `/api/admin/activity-logs` | Registro de actividad (Fase 3) | CU-42 |
| POST / PUT / DELETE | `/api/admin/zones`, `/api/admin/zones/:id` | Alta, edición y borrado (409 `ZONE_NAME_TAKEN`, `ZONE_IN_USE`). Trabajo diario | CU-52 |
| POST / PUT / DELETE | `/api/admin/qualifications`, `/api/admin/qualifications/:id` | Alta, edición y borrado (409 `QUALIFICATION_NAME_TAKEN`, `QUALIFICATION_IN_USE`) | CU-53 |
| GET / PUT | `/api/admin/users/:id/qualifications` | Cualificaciones de un trabajador; `PUT { qualificationIds }` las sustituye. 404 si no es un trabajador | CU-53 |
| GET / POST | `/api/admin/task-templates` | Plantillas; al crear una activa se generan sus tareas | CU-54 |
| GET / PUT / DELETE | `/api/admin/task-templates/:id` | Detalle (`hasHistory`), edición (regenera las pendientes desde ahora) y borrado (409 `TEMPLATE_HAS_HISTORY` si tiene tareas resueltas) | CU-54 |
| GET / POST | `/api/admin/tasks` | Tareas de un día (`?date&zoneId&status`) y alta de una tarea puntual | CU-55 |
| PATCH | `/api/admin/tasks/:id/assignee` | `{ userId \| null }`: trabajador activo con la cualificación que exige la tarea | CU-55 |
| DELETE | `/api/admin/tasks/:id` | Solo pendientes (409 `TASK_NOT_PENDING`) | CU-55 |
| GET / PUT | `/api/admin/work-settings` | `{ lateMarginMinutes }` (0-240, 30 por defecto) | CU-73 |
| PATCH | `/api/admin/incidents/:id/status` | `{ status, note }` (nota obligatoria al resolver). 409 `INCIDENT_SAME_STATUS` | CU-70 |
| POST | `/api/admin/incidents/:id/task` | Cuerpo de una tarea puntual; la crea y pasa la incidencia a `in_progress`. 409 `INCIDENT_HAS_TASK`, `INCIDENT_RESOLVED` | CU-70 |
| GET | `/api/admin/today` | Panel «Hoy»: `{ date, tasks, lateTasks, notDoneTasks, missedDoses, incidents, gaps, shifts (con missingCheckIn), lowIntake, vetVisits }` | CU-72 |
| GET / PUT | `/api/admin/alert-settings` | `{ emailAlertTypes, dailySummaryEnabled, dailySummaryTime }` | CU-73, CU-74 |
| POST / PUT / DELETE | `/api/admin/shift-templates`, `/api/admin/shift-templates/:id` | Crear, editar y borrar plantillas de turno; 409 `SHIFT_TEMPLATE_NAME_TAKEN` o `SHIFT_TEMPLATE_IN_USE` | CU-60 |
| POST | `/api/admin/shift-assignments` | `{ shiftTemplateId, date, userId, zoneIds }` (sin zonas, las del turno). Errores en el campo: persona ausente, turno que se solapa, día pasado, turno que no se hace ese día | CU-61 |
| DELETE | `/api/admin/shift-assignments/:id` | Quita a la persona; 409 `SHIFT_ALREADY_STARTED` si ya fichó o es de un día pasado | CU-61 |
| POST | `/api/admin/shift-assignments/copy-week` | `{ weekStart }` (un lunes): copia la semana anterior sin duplicar; `{ created, skipped: [{ date, user, shift, reason }] }` | CU-61 |
| GET / POST | `/api/admin/absences` | `?from&to` (desde hoy por defecto). Al crear, `{ absence, removedAssignments, keptAssignments }` | CU-62 |
| DELETE | `/api/admin/absences/:id` | Borra la ausencia; los turnos quitados no vuelven | CU-62 |
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

La ventana de pago pide una tarjeta (titular, número, caducidad y CVC) para que el pago se parezca a uno real. Solo se comprueba su formato en el navegador (`tarjetaSimuladaSchema` de `shared`: Luhn, caducidad no vencida, CVC de 3 o 4 dígitos), y **los datos de la tarjeta nunca se envían al servidor ni se guardan**: la API sigue recibiendo solo `simulatedOutcome`. Un aviso en la ventana pide no escribir una tarjeta real (DESIGN_SYSTEM §8.4).

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
| `billing` | Diaria, 03:00 | Para cada adopción `active` con pago automático, sin baja solicitada y con `next_billing_date <= hoy`: aplica `next_plan_id` si existe, cobra, crea el registro en `payments` y avanza `next_billing_date` un mes. Si falla: pago `failed`, adopción `paused`, aviso al adoptante. Cada adopción se procesa en su propia transacción. | CU-43 |
| `manual-payments` | Diaria, 03:15 | Adopciones `active` con pago manual y sin baja: avisa (campana `system` y email) 7 días antes de la cuota, una vez por cuota (`payment_reminder_sent_for`), y pasa a `paused` las que llevan 7 días desde la cuota sin pagarla (notificación `payment_failed`, email y registro de actividad) | CU-50 |
| `expire-pending` | Diaria, 03:30 | Adopciones `pending` creadas hace más de 7 días → `cancelled` (`payment_not_completed`) | CU-44 |
| `finish-cancelled` | Diaria, 03:45 | Adopciones `active` con `cancel_requested_at` y `end_date < hoy` → `finished` (`user_cancelled`) | CU-45 |
| `monthly-digest` | Día 1, 09:00 | Email resumen para adoptantes con `monthly_digest` y novedades en el mes anterior | CU-46 |
| `update-reminder` | Diaria, 07:00 | Notificación (campana) a cuidadores y administradores por cada animal con adopciones activas que lleva 12 días o más sin actualización | CU-47 |
| `generate-tasks` | Diaria, 00:10 | Trabajo diario: crea las tareas de cada plantilla activa y las dosis de cada pauta de medicación de hoy a 7 días vista (Europe/Madrid, solo las que no han pasado), sin los animales archivados. Los índices únicos `(template_id, due_at)` y `(medication_plan_id, due_at)` evitan duplicados. Una transacción por plantilla y por pauta. Devuelve `{ templates, created, medicationTasks }` | CU-58, CU-69 |
| `task-alerts` | Cada 15 minutos | Avisa en la campana (a los administradores y a quien tiene turno ese día en la zona) de las dosis de ayer y de hoy no dadas (pendientes pasada la hora y el margen, o no realizadas) y de las visitas veterinarias de hoy, una vez cada una (`staff_alerts`). Después pasa a `not_done` (sin persona) las tareas pendientes de días anteriores. Devuelve `{ closed, medicationMissed, vetVisitsToday }` | CU-59, CU-68, CU-69 |
| `coverage-check` | Cada hora, a los 5 minutos | Avisa en la campana a los administradores en activo de cada zona de un turno sin cubrir de hoy a 6 días vista (sin los turnos ya acabados), una sola vez por hueco (`staff_alerts`); si el tipo está elegido, también por email (`staff-emails`) | CU-64 |
| `staff-emails` | Cada 5 minutos | Envía por email los avisos del personal marcados con `notifications.email_pending` (los tipos elegidos en `work_settings.email_alert_types` al crearse), en el idioma de cada persona y solo a las que siguen en activo. Primero los marca como enviados (`FOR UPDATE SKIP LOCKED`), así que un fallo no se reintenta. Devuelve `{ sent, failed }` | CU-73 |
| `daily-summary` | Cada 15 minutos | Si el resumen está activado y ya es su hora (Madrid), envía el «Resumen del día» a los administradores en activo una sola vez al día (`staff_alerts` con `daily_summary` y la fecha). Devuelve `{ sent }` | CU-74 |

Las sesiones caducadas las borra el store de sesiones cada 15 minutos (`deleteExpired`). Los tokens caducados se borran en la tarea `expire-pending`.

### 11.5 Servicios de la Fase 3

- **`PdfService`** (`server/src/services/pdf/pdf.service.ts`): certificado de adopción y recibos en PDF con `pdfkit` (licencia MIT). Los textos los escribe el dominio (`dominio/documentos.ts`); las fotos WebP se convierten a PNG con `sharp`. Los PDF no se guardan. Desde la Fase 3 los recibos de «Mis aportaciones» son solo PDF (la página HTML imprimible se ha retirado); el recibo en pantalla tras una donación (CU-05) se mantiene.
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
| `/memorial`, `/memorial/:id` | En memoria y ficha de solo lectura (Fase 3) | Público |
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
| `/admin/my-day` | «Mi día»: tareas del día en tarjetas (inicio del cuidador al entrar) | Cuidador, admin |
| `/admin/shifts` | Calendario semanal de turnos (`?week=` lunes); el administrador asigna, quita y copia la semana | Cuidador, admin |
| `/admin/tasks`, `/admin/task-templates`, `/admin/zones`, `/admin/shift-templates`, `/admin/absences` | Tareas del día y puntuales (con los ajustes), plantillas, zonas y cualificaciones, plantillas de turno y ausencias | Admin |
| `/admin/incidents`, `/admin/incidents/:id` | Incidencias: listado, ficha y «Comunicar incidencia» (estado y tarea, solo el administrador) | Cuidador, admin |
| `/admin/today`, `/admin/alert-settings` | Panel «Hoy» y avisos por email con el resumen diario | Admin |

Las rutas protegidas usan un componente `<RequireRole roles={[...]}>` que redirige a `/login`. Es solo una mejora de la experiencia de uso; la seguridad la garantiza el servidor.

### 12.2 Pautas

- **Estado del servidor** con React Query; **sesión** en `SessionContext` (se carga con `GET /api/auth/me` al arrancar).
- **Formularios** con `react-hook-form` y los esquemas Zod de `shared/`. Los errores del servidor (`details`) se muestran junto al campo correspondiente.
- **Textos** siempre con `t('clave')` desde `i18n/locales/` (`es.json`, `ca.json` y `en.json`, con las mismas claves). Nunca texto fijo en los componentes.
- **Importes** con `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })` y **fechas** con `Intl.DateTimeFormat('es-ES')`.
- **Antes de adoptar**, la interfaz explica que la adopción es simbólica, que el animal no sale del santuario y que puede tener varios adoptantes.
- **Pasarela simulada:** una pantalla propia con un aviso claro de «Pago simulado: no se realizará ningún cargo real», los campos de una tarjeta que solo se comprueban en el navegador (§11.1) y los botones de resultado.
- **Diseño adaptable:** la web pública y el área del adoptante se diseñan primero para móvil (desde 360 px); el panel prioriza el escritorio, pero debe poder usarse en una tablet.

## 13. Requisitos no funcionales

| Requisito | Implementación |
| --- | --- |
| **Seguridad HTTP** | `helmet` con su configuración por defecto (CSP, `nosniff`, `Referrer-Policy: no-referrer`, HSTS); cookies `httpOnly` y `sameSite=lax`; `app.set('trust proxy', 1)` en producción; límite de tamaño del cuerpo JSON (100 kB) |
| **CSRF** | `sameSite=lax`; las peticiones que modifican datos se rechazan (403 `ORIGIN_NOT_ALLOWED`) si llegan con un `Origin` distinto de `CLIENT_URL` o con `Sec-Fetch-Site: cross-site` (`requireSameOrigin`), y solo se acepta `application/json` (las subidas `multipart` exigen una cabecera `X-Requested-With`). No hay CORS: cliente y API comparten origen, así que no se envía ninguna cabecera `Access-Control-Allow-*` |
| **Inyección SQL** | Solo consultas parametrizadas; listas blancas para la ordenación |
| **XSS** | React escapa por defecto; prohibido `dangerouslySetInnerHTML` con contenido del usuario. Los textos de las actualizaciones son texto plano con saltos de línea. |
| **Autorización** | En el servidor, en cada ruta ([§9](#9-autenticación-y-autorización)) |
| **RGPD** | Casilla de aceptación de la política de privacidad al registrarse (`privacy_accepted_at`); banner de cookies informativo (solo hay cookies técnicas de sesión). Derecho de acceso: el perfil y «Mis aportaciones». Rectificación: editar el perfil. Supresión: CU-25. |
| **Anonimización (CU-25)** | `first_name = 'Usuario'`, `last_name = 'eliminado'`, `email = 'deleted-<id>@anonymized.invalid'`, `phone = NULL`, contraseña aleatoria, `is_active = FALSE`, `email_verified = FALSE`, `show_public_name = FALSE`, `email_notifications = FALSE`, `last_login_at = NULL`, `anonymized_at = NOW()`. Se cierran sus adopciones abiertas (`account_deleted`), se borran sus sesiones, tokens, notificaciones y lecturas, y en sus donaciones se vacían los datos del donante (nombre, apellidos, email, teléfono y datos fiscales). Se conservan los importes de pagos y donaciones. |
| **Accesibilidad** | `alt_text` obligatorio en cada foto; contraste AA (4,5:1); navegación completa con teclado y foco visible; etiquetas `<label>` en todos los campos; HTML semántico |
| **Imágenes** | JPEG, PNG o WebP, máximo 5 MB. `sharp` las redimensiona a un máximo de 1600 px de ancho (WebP, calidad 80) y crea una miniatura de 400 px. Vídeos: MP4, máximo 50 MB, sin procesar; en la Fase 4 se revisará según el almacenamiento disponible. Máximo 10 archivos por subida. |
| **Rendimiento** | Paginación en todos los listados; índices definidos en `seedsql.sql`; miniaturas en las tarjetas del catálogo |
| **Copias de seguridad** | Script `npm run db:backup` (`pg_dump` a `backups/<fecha>.sql`) y copia de `server/uploads/`. En local se ejecuta a mano; en la Fase 4 se automatiza. |
| **Logs** | `pino`: peticiones, errores y resultado de las tareas programadas. Nunca se registran contraseñas, tokens ni cookies. |
| **Idioma** | Castellano, valenciano (`ca`) e inglés (`en`) con `i18next` (Fase 3) |
| **Zona horaria** | `Europe/Madrid` para las tareas y la presentación de fechas; la base de datos guarda `TIMESTAMPTZ` |

## 14. Configuración y entorno local

### 14.1 Requisitos

- Node.js LTS (24.7 o superior).
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
| `SANCTUARY_EMAIL` | `santuario@santuario.test` | Buzón para el formulario de contacto. En local llega a Mailpit |
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
| ~~Adopción regalo~~ (descartada: no se implementa) | CU-26 |
| Sección «En memoria» | CU-12 |
| Valenciano e inglés (archivos `ca.json` y `en.json`, selector de idioma, `preferred_language`; también emails, avisos y PDF) | — |

**Criterios de aceptación:**

- [x] Ninguna funcionalidad de la Fase 3 requiere cambios en la estructura de la base de datos (`database/` no cambia en toda la fase).
- [x] Las pruebas de las fases 1 y 2 siguen pasando (`npm test` y `npm run test:e2e`).

### Mejoras de seguridad tras la Fase 3

Recogidas en `docs/AUTH_SPEC.md` (§1). No cambian el esquema de la base de datos.

| Funcionalidad | Casos de uso |
| --- | --- |
| El enlace de recuperación de contraseña caduca en 30 minutos (antes, 1 hora) | CU-10 |
| Un administrador puede cerrar todas las sesiones de un usuario, con motivo obligatorio | CU-48 |

### Trabajo diario del personal (tras la Fase 3)

Turnos, tareas, alimentación, limpieza y medicación, en cuatro bloques que se cierran por orden, cada uno con sus datos de prueba en `TEST_DATA.sql` y sus pruebas:

- **Bloque A (terminado):** zonas (CU-52), cualificaciones (CU-53), plantillas (CU-54), tareas del día y puntuales (CU-55), «Mi día» (CU-56), completar (CU-57), generación (CU-58), cierre del día (CU-59) y el margen de «atrasada» (CU-73, parte).
- **Bloque B (terminado):** plantillas de turno (CU-60), calendario semanal con asignar, quitar y copiar la semana anterior (CU-61), ausencias (CU-62), fichar la entrada y la salida (CU-63) y aviso de zonas sin cubrir (CU-64, tarea `coverage-check`). «Mi día» marca como tuyas también las tareas sin asignar de tu turno y zona, y desactivar a un trabajador quita sus turnos futuros sin fichar.
- **Bloque C (terminado):** dieta de cada animal (CU-65), lo que ha comido cada animal al completar una comida (CU-66), aviso si come poco (CU-67), visitas veterinarias programadas (CU-68) y pautas de medicación con aviso de medicación no dada (CU-69), todo en la pestaña «Cuidados» de la ficha del animal.
- **Bloque D (terminado):** incidencias (CU-70), notas de relevo en «Mi día» (CU-71), panel «Hoy» del administrador (CU-72), avisos por email a elegir (CU-73, tarea `staff-emails`) y resumen diario (CU-74, tarea `daily-summary`, desactivado por defecto).

Decisiones del Bloque D:

- Cualquier trabajador comunica incidencias y las ve todas; solo el administrador cambia su estado y crea una tarea a partir de ella (que la pasa a «en curso»). Solo las de gravedad alta se avisan al momento (campana a los administradores y a quien tiene turno hoy en la zona, sin quien la comunica).
- Las notas de relevo son por zona, se escriben desde «Mi día» en cualquier momento (no hace falta fichar la salida) y se ven 24 horas. Cada persona las marca como leídas.
- «Hoy» es una pantalla nueva del menú «Trabajo diario» solo para el administrador; al entrar sigue yendo al escritorio, que enlaza a «Hoy».
- Los emails de aviso salen de una bandeja de salida (`notifications.email_pending`) que vacía `staff-emails`: crear el aviso nunca depende del correo. La elección de tipos vale para todo el personal.
- La ventana «Ajustes» de «Tareas del día» se queda como estaba (margen de atrasada y tomas comiendo poco); los avisos por email y el resumen tienen su propia pantalla, `/admin/alert-settings`, para no cambiar `/api/admin/work-settings`.

Decisiones del Bloque C:

- La dieta es la ficha de qué come cada animal: no crea tareas. La comida se organiza con las plantillas de alimentación.
- Lo que ha comido se anota con cuatro niveles (`all`, `most`, `little`, `none`), «todo» por defecto. En una comida sin animales cuentan los que viven en su zona. «Come poco» es `little` o `none`; el aviso sale al llegar a `work_settings.low_intake_meals` tomas seguidas (2 por defecto) y una sola vez por racha.
- Los avisos de cuidados (come poco, medicación no dada y visita de hoy) van a los administradores en activo y a quien tiene turno ese día en la zona del animal; desde el Bloque D, también por email si el administrador lo elige.
- Las pautas se repiten todos los días a sus horas; sus dosis se generan como las tareas de las plantillas y exigen la cualificación que se elija. Editar una pauta rehace sus dosis pendientes; terminarla la cierra hoy; con dosis resueltas no se borra.
- Una visita programada tiene su tarea `health_check` en «Mi día». No se completa con «Hecha»: se registra con el formulario del historial veterinario (CU-34), en la misma transacción.
- Las pautas y las visitas son de la zona del animal: un animal sin zona no las admite (`ANIMAL_WITHOUT_ZONE`). Dieta, pautas y visitas las gestionan cuidadores y administradores, y quedan en el registro de actividad.

Decisiones del Bloque A:

- «Atrasada» no es un estado guardado: se calcula (§8.5). Los estados guardados son `pending`, `completed` y `not_done`.
- «Puntual» no es un tipo: es una tarea sin plantilla, de cualquier tipo. No hay rol de mantenimiento: es una cualificación.
- Solo se generan las ocurrencias que aún no han pasado. Cambio de hora: una hora inexistente pasa a la siguiente; una repetida usa la segunda (horario de invierno).
- Editar una plantilla borra sus tareas pendientes desde ahora y las regenera (se pierden las reasignaciones de esas tareas); desactivarla las borra.
- Completar una tarea no se escribe en `activity_logs` (ya guarda quién y cuándo); los cambios de configuración sí.
- Deshacer: quien la resolvió, el mismo día; un administrador, siempre.

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
   | PostgreSQL | Base de datos gestionada gratuita, versión 14 o superior. Comprobar si caduca a los X días. |
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
| **Nueva especie** (por ejemplo, lince ibérico) | Alta desde el panel (CU-30): cada especie (lince ibérico, oso pardo, otra ave…) es una fila de `species` y la ficha del animal la muestra. Los animales no tienen campo de raza (se quitó `animals.breed`). No requiere cambios de código. |
| **Nuevo idioma** | Añadir `client/src/i18n/locales/<código>.json`, el código en `shared/src/constants/languages.ts` y en el `CHECK` de `users.preferred_language`, sus textos en las plantillas de email, en `textos-avisos.ts`, en `dominio/documentos.ts` y en `i18n/mensajesValidacion.ts` |
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
| 6 | Adopción regalo (Fase 3): ¿quién paga las cuotas después de la primera, quien regala o quien la recibe? | **Cerrada: CU-26 se descarta** (noviembre de 2026). No se implementa; `adoptions.gifted_by_user_id` se conserva en el esquema, siempre a `NULL`. |

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