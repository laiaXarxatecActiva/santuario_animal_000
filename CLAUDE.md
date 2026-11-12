# CLAUDE.md

## Estado actual

Aplicación web para un santuario de animales (apadrinamiento simbólico de buitres, donaciones, panel para el personal). **Fase 1 en curso**: está montado el esqueleto del monorepo (Express con `/api/health`, `errorHandler` y logs con pino; pool de `pg`, `withTransaction` y `db:reset`; cliente React con i18n; constantes compartidas), pero aún no hay casos de uso implementados. Las especificaciones de `docs/` son la fuente de verdad; lee la sección correspondiente antes de implementar nada:

- `docs/TECH_SPEC.md`: stack, arquitectura, estructura del repo, convenciones, API, jobs, fases y preguntas abiertas (el §18 recoge decisiones provisionales que hay que aplicar).
- `docs/USE_CASES.md`: casos de uso `CU-xx` y reglas de negocio.
- `database/seedsql.sql` (esquema; borra y recrea todo) y `database/TEST_DATA.sql` (vacía e inserta; fechas relativas al día de carga; los usuarios de prueba y sus contraseñas están en su cabecera).
- `docs/ux-ui/DESIGN_SYSTEM.md` (tokens y componentes; no inventes colores, tamaños ni componentes que no estén definidos ahí: añádelos antes al documento) y `docs/ux-ui/SCREENS.md` (diseño de cada pantalla).
- `ignore/` está en el `.gitignore` (borrador del diseño funcional y anexo de "producción real").

Notas del repositorio: la raíz de git es este directorio (`SantuarioAnimal/`), con remoto en GitHub (`origin`). Los archivos SQL están en `database/`.

## Ramas de Git

Estas reglas sustituyen a la de TECH_SPEC §7.4 («rama principal `main`»).

| Rama             | Quién la usa                                                             | ¿Claude puede modificarla?                                                      |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `master`         | La usuaria; ella decide qué entra                                        | **No.** Nunca hacer commit, merge, push, rebase ni reset sobre ella.            |
| `untouched`      | Copia de seguridad de `master` en su estado original                     | **Nunca.** No se actualiza jamás, ni siquiera para sincronizarla.               |
| `develop`        | Integración de lo terminado en `claude`                                  | Sí: se fusiona aquí el trabajo de `claude` cuando esté listo y los tests pasen. |
| `claude`         | Rama de trabajo de Claude                                                | Sí: aquí se hace todo el trabajo.                                               |
| Ramas auxiliares | Opcionales, creadas desde `claude` (p. ej. `feature/cu-13-adopt-animal`) | Sí; se fusionan de vuelta en `claude`.                                          |

- Antes de editar, comprobar con `git branch --show-current` que no se está en `master` ni en `untouched`.
- Flujo: rama auxiliar (opcional) → `claude` → `develop`. Hacia `master` solo pasa la usuaria.
- Hacer push a GitHub publica los cambios: subir solo `claude`, `develop` o ramas auxiliares, y nunca con `--force` sobre `develop`.

## Forma de trabajar

- Planifica antes de editar.
- Escribe los tests antes de la implementación.
- No digas que algo está hecho sin haber ejecutado `npm test`.

## Comandos

- Instalar: `npm install`
- Reiniciar la BD: `npm run db:reset` (desarrollo) / `npm run db:reset:test` (pruebas); ejecutan `database/seedsql.sql` y `database/TEST_DATA.sql` con `pg`, sin `psql`
- Tests: `npm test` (Vitest + Supertest)
- Comprobar tipos: `npm run typecheck`
- Lint: `npm run lint` · Formato: `npm run format` (Prettier)
- Desarrollo: `npm run dev` (API en http://localhost:3000 con `tsx watch` + Vite en http://localhost:5173, que reenvía `/api` y `/uploads` a la API)
- Un solo workspace: `npm test -w server`; un solo archivo: `npm test -w server -- tests/reloj.test.ts`; por nombre: `npm test -w server -- -t "CU-13"`

`npm test` y `npm run typecheck` de la raíz ejecutan el script de cada workspace (`shared`, `server`, `client`). Los hooks de `.claude/settings.json` ejecutan `typecheck` tras cada edición y `npm test` al terminar cada respuesta.

Otros scripts previstos en la raíz (TECH_SPEC §4, §14.3), que hay que crear:

- `npm run build` / `npm start`.
- `npm run job -- <jobName>`: ejecuta un job a mano.
- `npm run test:e2e`: Playwright.

## Estructura

Monorepo con npm workspaces:

- `shared/`: esquemas Zod, tipos de la API y constantes (`src/constants/` replica los `CHECK` de `seedsql.sql`; si cambia uno, cambia el otro). Se importa como `@sanctuary/shared` directamente desde el código TypeScript, sin compilar.
- `server/src/dominio/`: entidades y reglas de negocio, sin dependencias externas (aquí está la interfaz `Reloj`).
- `server/src/servicios/`: casos de uso que orquestan el dominio.
- `server/src/{config,errors,middlewares,...}`: resto de capas según TECH_SPEC §6.
- `client/`: React + Vite.
- `tests/` dentro de cada workspace: un archivo de test por cada archivo de `src/`.

Módulos: `shared` y `server` usan `NodeNext`, así que los imports relativos llevan extensión `.js` (`import { x } from './reloj.js'`). El cliente usa `Bundler` y va sin extensión.

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
