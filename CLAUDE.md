# CLAUDE.md

## Estado actual

Aplicación web para un santuario de animales (apadrinamiento simbólico de buitres, donaciones, panel para el personal). **Todavía no existe código de la aplicación**: el repositorio solo contiene especificaciones en `docs/`. Estas especificaciones son la fuente de verdad; lee la sección correspondiente antes de implementar nada:

- `docs/TECH_SPEC.md`: stack, arquitectura, estructura del repo, convenciones, API, jobs, fases y preguntas abiertas (el §18 recoge decisiones provisionales que hay que aplicar).
- `docs/USE_CASES.md`: casos de uso `CU-xx` y reglas de negocio.
- `docs/seedsql.sql` (esquema; borra y recrea todo) y `docs/TEST_DATA.sql` (vacía e inserta; fechas relativas al día de carga; los usuarios de prueba y sus contraseñas están en su cabecera).
- `docs/ux-ui/DESIGN_SYSTEM.md` (tokens y componentes; no inventes colores, tamaños ni componentes que no estén definidos ahí: añádelos antes al documento) y `docs/ux-ui/SCREENS.md` (diseño de cada pantalla).
- `ignore/` está en el `.gitignore` (borrador del diseño funcional y anexo de "producción real").

Notas del repositorio: la raíz de git es el directorio padre (`Entregable_Final/`) y la rama es `master`. La especificación prevé mover los archivos SQL a `database/`; por ahora están en `docs/`.

## Forma de trabajar

- Planifica antes de editar.
- Escribe los tests antes de la implementación.
- No digas que algo está hecho sin haber ejecutado `npm test`.

## Comandos

- Instalar: `npm install`
- Tests: `npm test` (Vitest + Supertest)
- Comprobar tipos: `npm run typecheck`
- Lint: `npm run lint`

Otros scripts previstos en la raíz (TECH_SPEC §4, §14.3), que hay que crear:

- `npm run dev`: API con `tsx watch` + Vite.
- `npm run build` / `npm start`.
- `npm run db:reset` / `npm run db:reset:test`: ejecutan el esquema y después los datos de prueba mediante `pg`, sin `psql`.
- `npm run job -- <jobName>`: ejecuta un job a mano.
- `npm run test:e2e`: Playwright.
- `npm run format`.

## Estructura

- `src/dominio/`: entidades y reglas de negocio, sin dependencias externas.
- `src/servicios/`: casos de uso que orquestan el dominio.
- `tests/`: un archivo de test por cada archivo de `src/`.

## Stack

- Compartido: esquemas Zod, tipos de la API y constantes.
- Servidor: Express 5 + TypeScript, `pg` sin ORM, express-session + connect-pg-simple.
- Cliente: React 19 + Vite, React Query, react-hook-form, i18next.
- Requisitos: Node 22+, PostgreSQL 14+ y Mailpit (SMTP en el 1025, interfaz en http://localhost:8025). Docker Compose para Postgres y Mailpit es opcional.

## Arquitectura

Flujo de una petición: cookie de sesión `sid` → `loadUser` (usuario y rol se releen de la BD en cada petición) → `requireAuth` / `requireRole(...)` / `requireVerifiedEmail` → `validate(zodSchema)` → controlador → servicio (caso de uso) → dominio y modelos → JSON en camelCase → `errorHandler` central.

- **Rutas y middlewares**: solo conexión, autenticación y validación.
- **Controladores**: llaman al caso de uso. Sin SQL y sin reglas de negocio.
- **Dominio** (`src/dominio/`): entidades y **reglas de negocio**, sin dependencias externas (ni `pg`, ni Express, ni librerías de E/S).
- **Servicios / casos de uso** (`src/servicios/`): orquestan el dominio, los modelos y los servicios técnicos.
- **Modelos**: SQL parametrizado escrito a mano, transacciones (`withTransaction`), comprobaciones de propiedad (un recurso de otra persona devuelve 404, no 403) y un único `mapRow` snake_case→camelCase por modelo. Traducen los errores de PG `23505`/`23503`/`23514` a 409/422 con mensajes en castellano.
- **Servicios técnicos**: pagos (interfaz `PaymentGateway`; `SimulatedGateway` controlado por `simulatedOutcome` o `PAYMENT_SIMULATION_MODE`; nunca se recogen datos de tarjeta), correo (plantillas de nodemailer que respetan las preferencias del usuario; un fallo de envío nunca deshace la operación principal), almacenamiento (`StorageService`, en local en `server/uploads/`) y jobs (`node-cron`, zona Europe/Madrid, **idempotentes**, también ejecutables con `POST /api/admin/jobs/:jobName/run`).
- **Cliente**: nunca decide permisos (solo oculta interfaz). Las reglas de negocio nunca se trasladan a React.
- Las reglas críticas se aplican dos veces: en el dominio, para dar mensajes claros, y en la BD (índices únicos parciales, triggers y CHECK listados en TECH_SPEC §5.3).
- `app.ts` contiene la configuración de Express sin `listen`, para que Supertest pueda importarlo. `server.ts` hace el `listen` y arranca los jobs.

## Convenciones

- **TypeScript**: estricto. Prohibido `any`.
- **Idioma**: textos de la interfaz, documentación, comentarios de código y comentarios SQL en castellano. Los nombres del dominio, en castellano. El resto de identificadores, el SQL, los nombres de archivo, las rutas de la API y los valores de estado, en inglés. Todos los textos de la interfaz pasan por i18next (`t('clave')`, `locales/es.json`); nada de texto fijo en el código.
- **Nombres de archivo**: en el servidor, `kebab-case.<capa>.ts` (`animal-update.model.ts`). Componentes React en `PascalCase.tsx` con CSS Modules. Rutas de la API en kebab-case y sustantivos en plural. Los estados son `VARCHAR` + `CHECK`, no ENUM.
- **Tiempo**: se inyecta mediante la interfaz `Reloj`. Nunca `new Date()` dentro del dominio. Los jobs se prueban llamando a su función con un `Reloj` que fija el día.
- **Errores de negocio**: con clases propias, nunca con strings. El `errorHandler` central las traduce a la forma `{ error: { code, message, details } }`.
- **Dinero y fechas**: `NUMERIC` se lee como string, los totales se calculan en SQL y nunca se suman importes con floats en el cliente. Los `DATE` se manejan como strings `YYYY-MM-DD`.
- **SQL**: siempre parametrizado. Los campos de ordenación que elige el usuario pasan por una lista blanca (`?sort=-createdAt`). La paginación usa `?page&pageSize` (máximo 100) y devuelve `{ data, meta }`.
- **Cambios de esquema**: actualiza `seedsql.sql` (y `TEST_DATA.sql` si hace falta). Las funcionalidades de la fase 3 no deben requerir cambios de esquema.
- **Commits y tests**: Conventional Commits en inglés que citen el caso de uso (`feat(adoptions): add plan change (CU-20)`). Los nombres de los tests también lo citan (`describe('CU-13 Adoptar un animal', ...)`).
- **Tests de integración**: ejecutan `db:reset:test` antes de cada archivo y usan los usuarios de `TEST_DATA.sql`, con `PAYMENT_SIMULATION_MODE=always_succeed`, `JOBS_ENABLED=false` y un transporte de correo en memoria.
- **Restricciones**: presupuesto de 0 € (sin dependencias ni servicios de pago, ni que pidan tarjeta de crédito) y todo en local primero. Implementa las fases 1→4 en orden y cierra los criterios de aceptación de cada fase (TECH_SPEC §16) antes de empezar la siguiente.