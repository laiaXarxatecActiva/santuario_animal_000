# Autenticación, sesiones y seguridad

Política de seguridad de este proyecto: **qué** se exige y **dónde** está implementado. Las decisiones con su motivo están en `TECH_SPEC.md` (§9 Autenticación y autorización, §13 Requisitos no funcionales) y en los casos de uso CU-07 a CU-11 y CU-24 de `USE_CASES.md`. Si este documento y la especificación no coinciden, hay un error: se corrigen los dos en el mismo commit.

## 1. Reglas para quien trabaje en el código (personas o agentes)

- La seguridad tiene prioridad sobre la rapidez. Si una implementación contradice una norma de este documento, prevalece la norma.
- No se toman decisiones de seguridad por iniciativa propia: ante cualquier duda que afecte a la autenticación, las sesiones, los permisos o los datos personales, se para y se pregunta.
- No se cambia el mecanismo de autenticación (sesiones en servidor con cookie), el algoritmo de contraseñas ni la librería de sesiones sin autorización explícita. No se añaden dependencias de seguridad sin autorización.
- No se desactiva ni se relaja ninguna comprobación (middleware, límite de intentos, `CHECK` de la base de datos) para que pase un test o para resolver un error.
- No se modifican ni se borran tests que funcionan sin autorización (regla de `CLAUDE.md`). Los tests de seguridad se escriben antes que el código.
- Autenticación (¿quién eres?), sesión (¿sigues siendo tú?) y autorización (¿puedes hacer esto?) son piezas separadas y se tratan por separado.
- Toda ruta nueva declara explícitamente su acceso (ver §6) y tiene un test que compruebe 401/403/404.

## 2. Mapa de la implementación

| Pieza | Dónde |
| --- | --- |
| Hash de contraseñas (Argon2id) | `server/src/utils/passwords.ts` |
| Tokens de un solo uso (generación y SHA-256) | `server/src/utils/tokens.ts`, `server/src/dominio/token.ts`, `server/src/models/user-token.model.ts` |
| Sesiones: store, cookie, regenerar y destruir | `server/src/middlewares/session.ts` |
| Sesiones: SQL (solo con el hash del identificador) | `server/src/models/session.model.ts`, tabla `user_sessions` en `database/seedsql.sql` |
| Cargar usuario y permisos (`loadUser`, `requireAuth`, `requireRole`, `requireVerifiedEmail`) | `server/src/middlewares/auth.ts` |
| CSRF: origen | `server/src/middlewares/require-same-origin.ts` |
| CSRF: solo JSON | `server/src/middlewares/require-json.ts` |
| Límites de intentos | `server/src/middlewares/rate-limit.ts` |
| Casos de uso de la cuenta (registro, login, verificación, recuperación) | `server/src/servicios/auth.service.ts`, `server/src/controllers/auth.controller.ts`, `server/src/routes/auth.routes.ts` |
| Cambio de contraseña (CU-24) | `server/src/servicios/profile.service.ts` |
| Cabeceras HTTP (`helmet`), orden de los middlewares | `server/src/app.ts` |
| Validación de entradas (Zod, compartida con el cliente) | `shared/src/schemas/` (contraseñas en `fields.ts`), `server/src/middlewares/validate.ts` |
| Errores (sin trazas ni SQL al cliente) | `server/src/errors/app-error.ts`, `server/src/middlewares/error-handler.ts` |
| Logs con datos sensibles ocultos | `server/src/utils/logger.ts` |
| Variables secretas | `server/src/config/env.ts` (`SESSION_SECRET` de 32+ caracteres; el servidor no arranca sin él) |
| Cliente: sesión, redirecciones seguras | `client/src/hooks/useSession.ts`, `client/src/api/client.ts`, `client/src/utils/redirect.ts` (`safeNext`) |

## 3. Contraseñas

- Hash con **Argon2id** usando `crypto.argon2`, nativo de Node 24.7+ (sin dependencias). Los parámetros son los mínimos recomendados por OWASP: 19 MiB de memoria, 2 pasadas y paralelismo 1, con una sal aleatoria de 16 bytes por contraseña y un hash de 32 bytes.
- Se guarda en formato PHC (`$argon2id$v=19$m=19456,t=2,p=1$<sal>$<hash>`), así que los parámetros pueden subirse más adelante sin invalidar los hashes existentes.
- Al comprobar un hash se rechazan los parámetros desorbitados (para que un hash manipulado no agote la memoria) y la comparación se hace en tiempo constante (`timingSafeEqual`).
- Los parámetros están centralizados en `passwords.ts`. Si se cambian, se actualiza TECH_SPEC §9.2.
- Prohibido: guardar contraseñas en claro o cifradas (cifrar es reversible), y usar MD5, SHA-1 o SHA-256 para contraseñas.
- Longitud de **10 a 128 caracteres**, sin reglas de composición. Se permiten espacios, símbolos, pegar la contraseña y los gestores de contraseñas. No se obliga a cambiarla periódicamente. El máximo existe para que no se pueda cargar el servidor con un texto enorme.
- El esquema Zod es el mismo en el cliente y en el servidor (`nuevaPassword` en `shared/src/schemas/fields.ts`). El servidor siempre vuelve a validar.
- La contraseña nueva de CU-24 tiene que ser distinta de la actual.
- Las contraseñas de prueba de `database/TEST_DATA.sql` llevan su hash Argon2id ya calculado, porque PostgreSQL no sabe calcularlo. Las contraseñas en claro están en la cabecera de ese archivo, que es lo que lee `npm run users:file`.

## 4. Sesiones y cookie

Decisión: **sesiones guardadas en el servidor** (PostgreSQL), no JWT (TECH_SPEC §9.1). No se introduce JWT ni ningún otro mecanismo.

- `express-session` con un **store propio** (`PgSessionStore`). En `user_sessions` se guarda **solo el SHA-256 del identificador** (`sid_hash`), nunca el identificador, de modo que una copia o una fuga de la tabla no permite suplantar a nadie. Además, la cookie va firmada con `SESSION_SECRET`.
- El identificador lo genera `express-session` (`uid-safe`, 24 bytes de `crypto.randomBytes`). Nunca se usan `Math.random()`, fechas ni datos del usuario como secreto.
- La sesión guarda solo `userId`. El usuario y su rol se **releen de la base de datos en cada petición** (`loadUser`). Si la cuenta se desactiva o se anonimiza, la sesión deja de valer al momento.
- La caducidad se comprueba **en el servidor** (`expire > NOW()`), no solo en la cookie. Dura 7 días y se renueva con cada petición (`rolling`). Las sesiones caducadas se borran cada 15 minutos.
- **Fijación de sesión**: al iniciar sesión se regenera el identificador (`regenerateSession`).
- **Logout** (CU-11): primero se destruye la sesión en la base de datos y después se borra la cookie. El identificador anterior deja de funcionar inmediatamente.
- **Cerrar sesiones**: al recuperar la contraseña (CU-10) se cierran todas las sesiones del usuario. Al cambiarla (CU-24) se cierran todas menos la actual. La columna `user_id` (con `ON DELETE CASCADE`) permite cerrar las de un usuario de una vez.
- El registro **no** abre sesión (ver §5).

| Atributo de la cookie | Valor |
| --- | --- |
| Nombre | `sid` en local; `__Host-sid` en producción |
| `HttpOnly` | Siempre |
| `Secure` | En producción (HTTPS) |
| `SameSite` | `Lax` |
| `Path` | `/` |
| `Domain` | Nunca se establece |
| Caducidad | 7 días, igual que la sesión en el servidor |

- La cookie se configura solo en `middlewares/session.ts` (`sessionCookieName`, `cookieOptions`), también para borrarla.
- El token de sesión nunca está al alcance de JavaScript: no se guarda en `localStorage`, `sessionStorage` ni variables, y no aparece en respuestas JSON, URLs, logs ni mensajes de error.

## 5. Cuenta: registro, login, verificación y recuperación

**Tokens de un solo uso** (verificación de email, recuperación de contraseña e invitación de trabajadores):
- Son 32 bytes de `crypto.randomBytes`. En `user_tokens` se guarda solo su SHA-256.
- Caducan en 24 horas (verificación e invitación) o en 1 hora (recuperación).
- Se marcan como usados de forma atómica. Pedir uno nuevo invalida los anteriores del mismo tipo.
- Viajan en el enlace del email (`?token=`) y el cliente los envía a la API en el **cuerpo** de un POST, nunca en la URL de la API.
- Las respuestas de la API llevan `Referrer-Policy: no-referrer` (helmet).

**Registro** (CU-07):
- Se valida con Zod.
- El email se normaliza: sin espacios y en minúsculas. La unicidad no distingue mayúsculas (índice `users_email_lower_key`).
- El campo `role` se ignora: el registro siempre crea adoptantes.
- **No revela si el email ya tiene cuenta.** La respuesta es siempre `202 { message }` con el mismo texto, y nunca abre sesión.
  - **Email nuevo:** se crea la cuenta y se envía el email de verificación.
  - **Email existente con la cuenta activa:** no se crea nada y se envía a ese email el aviso «Ya tienes una cuenta en el santuario», con enlaces a iniciar sesión y a recuperar la contraseña.
  - **Cuenta desactivada:** no se envía nada.
  - En los dos casos se calcula el hash de la contraseña, para que la respuesta tarde lo mismo.
- Después del registro, el cliente lleva a «Iniciar sesión».

**Login** (CU-09):
- Da el mismo error (`INVALID_CREDENTIALS`) si el email no existe y si la contraseña es incorrecta. Cuando el email no existe, compara con un hash ficticio para que tarde lo mismo. Ese hash se calcula al crear el servicio, para que tampoco tarde más el primer intento.
- Una contraseña de más de 128 caracteres recibe el mismo `INVALID_CREDENTIALS` (ninguna contraseña válida es tan larga), sin buscar el usuario ni calcular el hash. En el registro, en la recuperación y en el cambio de contraseña, en cambio, es un error de validación (400) con su mensaje.
- Una cuenta desactivada recibe 403, pero solo tras dar la contraseña correcta.
- Se puede entrar con el email sin verificar. Lo que exige verificarlo es adoptar (`requireVerifiedEmail`).
- Se crea una sesión nueva y solo se devuelven los datos públicos del usuario (`toSessionUser`: id, nombre, apellidos, email, rol, `emailVerified`).
- En el cliente, al entrar se vacía la caché de React Query, para que no queden datos de otra cuenta abierta antes en el mismo navegador.

**Recuperación** (CU-10):
- La respuesta es siempre la misma, exista o no el email.
- Al usar el token: se marca como usado, se invalidan los demás, se guarda el nuevo hash y se cierran todas las sesiones.

**Invitación de un trabajador** (CU-36):
- Solo la crea un administrador. La cuenta nace con `email_verified = TRUE` y el hash de una contraseña aleatoria de 32 bytes que nadie conoce.
- El token es de tipo `worker_invitation`. Se usa en `POST /api/auth/reset-password` igual que la recuperación: se marca como usado, se anulan los demás enlaces de recuperación e invitación y se cierran las sesiones.
- El enlace lleva `&invite=1` solo para que la página diga «Elige tu contraseña»; ese parámetro no da ningún permiso.
- Reenviarla anula la anterior, y solo se puede si el trabajador está activo y nunca ha entrado.

**Desactivar una cuenta** (CU-35):
- Solo un administrador, y nunca la suya. Se cierran todas las sesiones de esa cuenta en la misma transacción; además, `loadUser` ya rechaza una cuenta inactiva en la siguiente petición.
- El cambio de rol no cierra sesiones, porque el rol se relee de la base de datos en cada petición. Siempre queda al menos un administrador activo.

**Verificación** (CU-08):
- El reenvío exige sesión y, como máximo, se puede pedir 3 veces por hora.

## 6. Autorización

- La cadena de middlewares tiene un orden fijo, y cada pieza hace una sola cosa:
  1. `loadUser` carga el usuario de la sesión.
  2. `requireAuth` responde 401 si no hay sesión.
  3. `requireRole(...)` responde 403 si el rol no es el adecuado.
  4. `requireVerifiedEmail` responde 403 si el email no está verificado.
- Una sesión válida no da permiso para todo.
- Cómo se declara el acceso:
  - Las rutas públicas están solo en `public.routes.ts` y en `GET /api/auth/me`, `POST /api/auth/{register,login,verify-email,forgot-password,reset-password}`.
  - El panel (`/api/admin/*`) aplica `requireRole('caretaker', 'admin')` a todo el router, y `requireRole('admin')` a las rutas solo de administrador.
  - En el resto de routers (`/api/me/*`, adopciones, perfil) cada ruta declara su `requireAuth`/`requireRole`/`requireVerifiedEmail` según la matriz de TECH_SPEC §9.5. Una ruta nueva sin esa declaración es pública, por eso se revisa en cada cambio y se cubre con un test de 401/403.
  - **No se añade ninguna ruta pública nueva sin autorización.**
- `server/tests/admin.routes.test.ts` comprueba el 401/403 de **todas** las rutas del panel. Toda ruta privada nueva se añade a un test de ese tipo.
- **Propiedad de los recursos (IDOR)**:
  - El filtro por propietario va en la propia consulta SQL (`WHERE user_id = $1 AND id = $2`), no se comprueba después de leer el recurso.
  - Un recurso ajeno responde **404** (no 403), para no revelar que existe.
  - Esto vale igual para leer, modificar y borrar.
- El cliente nunca decide permisos: solo oculta la interfaz (`RequireRole` en las rutas de React). El servidor decide siempre.

## 7. Protección frente a ataques

| Riesgo | Protección en este proyecto |
| --- | --- |
| Fuerza bruta en el login | 5 intentos fallidos por IP y email cada 15 minutos, y 50 por IP sea cual sea el email (frena probar una contraseña contra muchas cuentas). No hay límite solo por email, porque permitiría bloquear la cuenta de otra persona |
| Abuso del registro (inundar un buzón) | 20 registros por hora por IP y 3 por hora por email |
| Enumeración de usuarios | Registro, login y recuperación responden igual y tardan lo mismo (§5) |
| Fijación de sesión | Identificador nuevo al iniciar sesión |
| Robo de la base de datos | Argon2id para las contraseñas; SHA-256 para los identificadores de sesión y los tokens |
| Tokens predecibles | `crypto.randomBytes` |
| CSRF | `SameSite=Lax`. Además, `requireSameOrigin` rechaza las peticiones que modifican datos con un `Origin` distinto de `CLIENT_URL` o con `Sec-Fetch-Site: cross-site` (403 `ORIGIN_NOT_ALLOWED`), y `requireJson` solo acepta `application/json` (las subidas `multipart` exigen `X-Requested-With`). Ningún `GET` modifica datos. |
| CORS permisivo | No hay CORS: cliente y API comparten origen (proxy de Vite en desarrollo y Express sirviendo el cliente en producción). No se envía ninguna cabecera `Access-Control-Allow-*`; si algún día hiciera falta, sería con una lista blanca explícita, nunca con `*` ni reflejando el origen recibido |
| XSS | React escapa por defecto; prohibido `dangerouslySetInnerHTML` con contenido del usuario; cookie `HttpOnly`; CSP de helmet; las plantillas de email escapan los datos (`escapeHtml`) |
| Cabeceras HTTP | `helmet` (CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, HSTS) y sin `X-Powered-By` |
| Redirecciones abiertas | `safeNext` solo acepta rutas internas (`/…`, nunca `//` ni `/\`) |
| Inyección SQL | Solo consultas parametrizadas; ordenación con lista blanca |
| Cuerpos enormes | JSON de 100 kB como máximo; contraseñas de 128 caracteres como máximo (en el login, más larga = credenciales incorrectas, sin calcular el hash) |
| Fugas en los logs | pino oculta `cookie`, `authorization`, `set-cookie`, `password`, `newPassword`, `currentPassword` y `token` |

**Límites de intentos**:
- Eliminar la cuenta (CU-25, `DELETE /api/me`) pide la contraseña y comparte el límite del cambio de contraseña (`createChangePasswordLimiter`), para que una sesión robada no sirva para adivinarla.
- Formularios públicos que envían emails a direcciones que escribe quien los usa: donaciones, 10 por hora y por IP (CU-05); contacto, 5 por hora y por IP (CU-06). Así no sirven para inundar el buzón de otra persona ni el del santuario.
- Con `express-rate-limit`, con los contadores en memoria. Si algún día hay varias instancias del servidor, los contadores tendrán que estar en un almacén compartido.
- En producción se confía en `X-Forwarded-For` solo a través de `trust proxy = 1` (un único proxy controlado).

## 8. Respuestas y errores

- Toda entrada se valida con Zod (`validate`) y un error de validación responde 400 con los campos.
- No se devuelven filas de la base de datos tal cual: cada modelo tiene su `mapRow` y los servicios exponen solo los datos públicos (`toSessionUser`). Nunca salen hashes, tokens, secretos ni datos internos.
- Códigos de estado:
  - `400`: datos inválidos.
  - `401`: sin sesión.
  - `403`: sin permiso, email sin verificar u origen no permitido.
  - `404`: no existe o es ajeno.
  - `409`/`422`: reglas de negocio.
  - `415`: no es JSON.
  - `429`: demasiados intentos.
- Los errores pasan por el `errorHandler` central con la forma `{ error: { code, message, details } }`. Un error inesperado responde 500 con un mensaje genérico y se registra en el log, pero sin trazas ni SQL para el cliente.

## 9. Datos personales y secretos

- Se guardan solo los datos necesarios para cada finalidad (RGPD en TECH_SPEC §13). Hay supresión por anonimización (CU-25).
- Los secretos (`SESSION_SECRET`, credenciales de la base de datos y del SMTP) van en `.env`, que no se sube al repositorio. `.env.example` solo lleva valores de ejemplo.
- Las sesiones caducadas se borran cada 15 minutos. Los tokens caducados, en la tarea `expire-pending` (Fase 2).
- **Registro de actividad (CU-42)**: los controladores del panel anotan cada escritura con `ActivityLogService` (`server/src/services/activity-log.service.ts`). Antes de guardar, `limpiarDetalles` (`server/src/dominio/actividad.ts`) quita cualquier clave que pueda contener una contraseña, un token o un hash. El registro solo lo lee el administrador (`GET /api/admin/activity-logs`) y no hay ninguna ruta para modificarlo ni borrarlo.
- **Certificado y recibos en PDF (CU-22, CU-19)**: `server/src/routes/document.routes.ts`, solo para adoptantes (`requireRole('adopter')`) y siempre sobre recursos propios (el filtro por usuario va en la consulta; uno ajeno es 404). El PDF se genera al momento, no se guarda y se envía con `Cache-Control: no-store`. El nombre del archivo se limpia (`nombreArchivo`, solo letras, números y guiones) antes de ponerlo en `Content-Disposition`. La foto del certificado se lee con `StorageService.read`, que no admite rutas fuera de `uploads/`.

## 10. Cliente

- El cliente nunca ve ni guarda el token de sesión: lo gestiona el navegador con la cookie `HttpOnly`.
- El usuario actual se obtiene de `GET /api/auth/me` (`useSession`). Todas las llamadas pasan por un único cliente HTTP (`client/src/api/client.ts`), que convierte cualquier error en `ApiError` y envía las cookies solo al mismo origen (`credentials: 'same-origin'`). Las rutas protegidas de React usan `RequireRole`.
- Ocultar un botón no sustituye a la autorización del servidor.
- **Sesión caducada**: si cualquier llamada fuera de `/api/auth/` responde 401 mientras había sesión, el cliente HTTP lo avisa (`onUnauthorized`) y `useSessionExpiry` (en las dos plantillas) vacía la caché y lleva a `/login?next=…` con el aviso «Tu sesión ha caducado».

## 11. Tests que lo comprueban

| Comprobación | Test |
| --- | --- |
| Argon2id con los parámetros previstos; sal distinta; sin truncar; hashes ajenos rechazados | `server/tests/utils/passwords.test.ts` |
| La contraseña no se guarda en claro (el hash es Argon2id) | `server/tests/auth.routes.test.ts` (CU-07) |
| Atributos de la cookie (`HttpOnly`, `SameSite=Lax`, `Path=/`, sin `Domain`; `__Host-` y `Secure` en producción) | `server/tests/session.test.ts` |
| En la base de datos solo está el hash del identificador de sesión y del token | `server/tests/session.test.ts`, `server/tests/models/session.model.test.ts`, `server/tests/auth.routes.test.ts` |
| Las sesiones caducadas o borradas no valen | `server/tests/session.test.ts` |
| Login sin enumeración, sesión nueva al entrar, límite de intentos | `server/tests/auth.routes.test.ts` (CU-09) |
| Límites del login por IP y email y solo por IP | `server/tests/rate-limit.test.ts` |
| Contraseña de más de 128 caracteres en el login: sin calcular el hash | `server/tests/auth.service.test.ts` |
| Al entrar, el cliente descarta los datos de otra cuenta | `client/tests/LoginPage.test.tsx` |
| Registro sin enumeración, sin sesión, con límite por email | `server/tests/auth.routes.test.ts` (CU-07) |
| Límites de los formularios públicos (donación, contacto) | `server/tests/donations.routes.test.ts` (CU-05), `server/tests/contact.routes.test.ts` (CU-06) |
| El asunto del contacto no admite saltos de línea (inyección de cabeceras) | `shared/tests/contact.schema.test.ts` |
| El logout invalida la sesión | `server/tests/auth.routes.test.ts` (CU-11) |
| Tokens de un solo uso; la recuperación cierra todas las sesiones | `server/tests/auth.routes.test.ts` (CU-08, CU-10) |
| La invitación sirve para elegir la contraseña, caduca en 24 horas y no la anula pedir la recuperación | `server/tests/auth.routes.test.ts`, `server/tests/token.test.ts`, `server/tests/admin-users.routes.test.ts` (CU-36) |
| Desactivar una cuenta cierra sus sesiones; no se puede desactivar la propia ni dejar sin administrador activo | `server/tests/admin-users.routes.test.ts`, `server/tests/usuarios-admin.test.ts` (CU-35) |
| El cambio de contraseña cierra las demás sesiones | `server/tests/profile.routes.test.ts` (CU-24) |
| Eliminar la cuenta pide la contraseña, solo la puede usar un adoptante, anonimiza los datos y cierra todas sus sesiones | `server/tests/account-deletion.routes.test.ts` (CU-25) |
| Rutas privadas sin sesión o sin rol | `server/tests/admin.routes.test.ts`, `server/tests/auth.middleware.test.ts` y los tests de cada router |
| Recursos ajenos → 404 | Tests de cada router (`adoptions.routes`, `feed.routes`…) |
| Origen no permitido y solo JSON | `server/tests/require-same-origin.test.ts`, `server/tests/require-json.test.ts`, `server/tests/app.test.ts` |
| Cabeceras de helmet | `server/tests/app.test.ts` |
| Las respuestas no exponen campos privados | `server/tests/auth.routes.test.ts`, `server/tests/profile.routes.test.ts` |
| Los logs ocultan datos sensibles | `server/tests/logger.test.ts` |
| Certificado y recibos en PDF: solo adoptantes, solo los propios (ajeno → 404), sin caché | `server/tests/documents.routes.test.ts` (CU-22, CU-19), `server/tests/documentos.test.ts` |
| El registro de actividad no guarda contraseñas ni tokens y solo lo ve el administrador | `server/tests/actividad.test.ts`, `server/tests/admin-activity.routes.test.ts` (CU-42) |

## 12. Pendiente

- **Fase 4 (producción)**: servir el cliente desde Express para que la CSP y la `Referrer-Policy` de helmet también protejan las páginas `/verify-email` y `/reset-password`, que llevan el token en la URL. En desarrollo esas páginas las sirve Vite, sin esas cabeceras. Al hacerlo, revisar la CSP para el cliente compilado.
- **Fase 4**: la página `/cookies` muestra el nombre `sid`; en producción la cookie se llama `__Host-sid`.
- **Si hay varias instancias del servidor**: llevar los contadores de los límites de intentos a un almacén compartido.
- **Contraseñas filtradas**: no se comprueba si una contraseña aparece en filtraciones conocidas, porque requeriría un servicio externo. Se puede valorar con una lista local.

## 13. Antes de dar por terminada una tarea de seguridad

1. Revisar el diff completo.
2. Comprobar que no hay dependencias nuevas sin autorizar.
3. Ejecutar `npm test`, `npm run typecheck` y `npm run lint`.
4. Comprobar que no hay secretos, contraseñas reales ni tokens en el código ni en los logs.
5. Comprobar que no se han cambiado tests ni reglas de seguridad sin autorización.
6. Actualizar este documento, TECH_SPEC y los casos de uso si ha cambiado algo.
7. Informar de cualquier limitación o test pendiente.

Una tarea no está terminada si algún test de seguridad falla.
