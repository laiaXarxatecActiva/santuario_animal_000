# Santuario de Animales

Aplicación web para un santuario de buitres que no pueden volver a la naturaleza. Cualquiera puede ver los animales, registrarse y **adoptar a uno de forma simbólica** con una cuota mensual. Los adoptantes reciben noticias suyas, y el personal del santuario gestiona los animales, las fotos y las actualizaciones desde un panel.

> **Proyecto académico.** El santuario es ficticio y **los pagos son simulados**: nunca se piden ni se guardan datos de tarjetas, y no se cobra nada.

Este documento explica todo lo necesario para arrancar la aplicación en tu ordenador, aunque no hayas trabajado antes con estas herramientas. Escribe cada comando en una terminal, dentro de la carpeta del proyecto.

---

## Índice

1. [Qué necesitas](#1-qué-necesitas)
2. [Puesta en marcha, paso a paso](#2-puesta-en-marcha-paso-a-paso)
3. [Usuarios de prueba](#3-usuarios-de-prueba)
4. [Qué puedes probar](#4-qué-puedes-probar)
5. [Correos, pagos y fotos](#5-correos-pagos-y-fotos)
6. [Comandos](#6-comandos)
7. [Problemas frecuentes](#7-problemas-frecuentes)
8. [Estructura y documentación](#8-estructura-y-documentación)
9. [Estado del proyecto](#9-estado-del-proyecto)

---

## 1. Qué necesitas

| Programa                                           | Versión             | Para qué                                                                                              | Cómo comprobar si lo tienes |
| -------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------- |
| [Node.js](https://nodejs.org/)                     | 22 o superior       | Ejecuta la aplicación (incluye `npm`)                                                                 | `node -v`                   |
| [Git](https://git-scm.com/)                        | Cualquiera reciente | Descargar el código                                                                                   | `git --version`             |
| [PostgreSQL](https://www.postgresql.org/download/) | 14 o superior       | La base de datos                                                                                      | `psql --version`            |
| [Mailpit](https://mailpit.axllent.org/)            | Cualquiera reciente | Recoge los correos que envía la aplicación (verificación, recuperar contraseña) sin mandarlos a nadie | Abre http://localhost:8025  |

PostgreSQL y Mailpit se pueden instalar de dos formas. **Elige una:**

- **Opción A, con Docker (recomendada si no tienes PostgreSQL).** Instala [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows y macOS) o Docker Engine (Linux). El proyecto trae un `docker-compose.yml` que arranca los dos con un solo comando.
- **Opción B, instalados en el ordenador.** Instala PostgreSQL desde su web o con el gestor de paquetes de tu sistema, y Mailpit siguiendo [sus instrucciones](https://mailpit.axllent.org/docs/install/).

Todo es gratuito y funciona en local: no hace falta ninguna cuenta ni servicio de pago.

---

## 2. Puesta en marcha, paso a paso

### Paso 1. Descargar el código

```bash
git clone <URL-del-repositorio>
cd SantuarioAnimal
```

Sustituye `<URL-del-repositorio>` por la dirección que aparece en el botón verde **Code** de GitHub. Si la carpeta se llama de otra forma, entra en la que se haya creado.

### Paso 2. Instalar las dependencias

```bash
npm install
```

Tarda uno o dos minutos la primera vez. Solo hay que repetirlo si cambia algún `package.json`.

### Paso 3. Preparar la base de datos

La aplicación usa **dos bases de datos**: `sanctuary` (la que ves al usarla) y `sanctuary_test` (la que usan los tests automáticos, que la borran y rellenan muchas veces). Las dos pertenecen al usuario de PostgreSQL `sanctuary`, con contraseña `sanctuary`.

**Opción A, con Docker:**

```bash
docker compose up -d
```

Esto descarga y arranca PostgreSQL 16 (con las dos bases de datos ya creadas) y Mailpit. Para pararlos: `docker compose stop`; para volver a arrancarlos otro día: `docker compose up -d`. En Linux, si da un error de permisos, antepón `sudo` al comando.

> Si ya tienes un PostgreSQL instalado escuchando en el puerto 5432, los dos chocarán. En ese caso, usa la opción B para la base de datos y arranca con Docker solo Mailpit: `docker compose up -d mailpit`.

**Opción B, con PostgreSQL instalado:**

Crea el usuario y las dos bases de datos. En Linux y macOS:

```bash
sudo -u postgres psql -c "CREATE ROLE sanctuary LOGIN PASSWORD 'sanctuary';"
sudo -u postgres createdb -O sanctuary sanctuary
sudo -u postgres createdb -O sanctuary sanctuary_test
```

En Windows, abre **SQL Shell (psql)** (se instala con PostgreSQL), entra con el usuario `postgres` y ejecuta:

```sql
CREATE ROLE sanctuary LOGIN PASSWORD 'sanctuary';
CREATE DATABASE sanctuary OWNER sanctuary;
CREATE DATABASE sanctuary_test OWNER sanctuary;
```

> Si prefieres otro usuario, otra contraseña u otro puerto, puedes usarlos: solo tienes que reflejarlos en `DATABASE_URL` y `TEST_DATABASE_URL` en el paso 5.

### Paso 4. Arrancar Mailpit

Con la opción A ya está arrancado. Con la opción B, ejecuta `mailpit` en otra terminal y déjala abierta.

Comprueba que funciona abriendo **http://localhost:8025**: verás un buzón vacío. Ahí llegarán todos los correos de la aplicación.

> Sin Mailpit la aplicación funciona igual, pero no podrás leer los correos de verificación ni de recuperación de contraseña.

### Paso 5. Crear el archivo de configuración `.env`

Copia la plantilla:

```bash
cp .env.example .env        # Linux y macOS
copy .env.example .env      # Windows (cmd)
```

Abre `.env` con cualquier editor de texto. Solo hay un valor **obligatorio** que rellenar: `SESSION_SECRET`, una clave aleatoria de 32 caracteres o más que protege las sesiones. Genera una con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado y pégalo detrás del `=`, sin espacios ni comillas:

```dotenv
SESSION_SECRET=3f9a...(64 caracteres)
```

Los demás valores ya sirven tal cual si has seguido los pasos anteriores. Qué hace cada uno:

| Variable                          | Valor por defecto                                              | Para qué sirve                                                                                                      |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                        | `development`                                                  | Modo de ejecución. Déjalo así                                                                                       |
| `PORT`                            | `3000`                                                         | Puerto de la API                                                                                                    |
| `CLIENT_URL`                      | `http://localhost:5173`                                        | Dirección de la web, para los enlaces de los correos                                                                |
| `DATABASE_URL`                    | `postgres://sanctuary:sanctuary@localhost:5432/sanctuary`      | Base de datos de la aplicación (`usuario:contraseña@servidor:puerto/base`)                                          |
| `TEST_DATABASE_URL`               | `postgres://sanctuary:sanctuary@localhost:5432/sanctuary_test` | Base de datos de los tests                                                                                          |
| `UPLOADS_DIR`                     | `./uploads`                                                    | Carpeta donde se guardan las fotos subidas (dentro de `server/`)                                                    |
| `SESSION_SECRET`                  | _(vacío)_                                                      | **Obligatorio.** Clave aleatoria de 32+ caracteres                                                                  |
| `SMTP_HOST` / `SMTP_PORT`         | `localhost` / `1025`                                           | Servidor de correo (Mailpit)                                                                                        |
| `SMTP_USER` / `SMTP_PASSWORD`     | _(vacíos)_                                                     | Usuario y contraseña del correo. En local no hacen falta                                                            |
| `MAIL_FROM`                       | `"Santuario <no-reply@santuario.test>"`                        | Remitente de los correos                                                                                            |
| `PAYMENT_SIMULATION_MODE`         | `always_succeed`                                               | Resultado de los pagos simulados: `always_succeed` (siempre bien), `always_fail` (siempre mal) o `random` (al azar) |
| `PAYMENT_SIMULATION_FAILURE_RATE` | `0.2`                                                          | Con `random`, probabilidad de que un pago falle (0,2 = 20 %)                                                        |

> El `.env` nunca se sube a GitHub (está en el `.gitignore`). Si cambias algo con la aplicación arrancada, párala y vuelve a arrancarla.

### Paso 6. Cargar los datos de prueba

```bash
npm run db:reset
```

Crea las tablas y las rellena con animales, usuarios, adopciones y pagos de ejemplo. Además, genera el archivo `USUARIOS_PRUEBA.txt` con los usuarios y sus contraseñas ([sección 3](#3-usuarios-de-prueba)).

> ⚠️ Este comando **borra todo** lo que haya en la base de datos `sanctuary` y la deja como recién instalada. Úsalo también cuando quieras volver a empezar después de tus pruebas.

Si quieres pasar los tests automáticos, prepara también su base de datos (no es necesario para usar la aplicación):

```bash
npm run db:reset:test
```

### Paso 7. Arrancar la aplicación

```bash
npm run dev
```

Arranca dos cosas a la vez: la **API** (en el puerto 3000, líneas marcadas con `api`) y la **web** (en el 5173, marcadas con `web`). Deja la terminal abierta mientras la uses y párala con `Ctrl + C`.

Abre **http://localhost:5173** en el navegador. 🎉

Para comprobar que la API responde: http://localhost:3000/api/health debe mostrar `{"status":"ok"}`.

### Las veces siguientes

Ya no hay que repetir la instalación. Basta con:

1. Arrancar PostgreSQL y Mailpit si no lo están (`docker compose up -d` con la opción A).
2. `npm run dev`.

---

## 3. Usuarios de prueba

Abre **`USUARIOS_PRUEBA.txt`**, en la carpeta principal del proyecto. Tiene todos los usuarios agrupados por rol, con su email, su contraseña y una nota de para qué sirve cada uno. Entra con ellos en http://localhost:5173/login.

- Se crea y se actualiza solo con `npm run db:reset`, cada vez que arrancas `npm run dev`, o cuando quieras con `npm run users:file`.
- Muestra los usuarios que hay **en ese momento** en la base de datos, también los que se registren desde la web.
- Las contraseñas se guardan cifradas y no se pueden descifrar. Por eso solo aparecen las de los datos de prueba que no se han cambiado. Las demás salen como «(cambiada desde la carga)» o «(desconocida)». `npm run db:reset` recupera las originales.
- Es solo para tus pruebas: no se sube a GitHub.

Para empezar, estos tres bastan:

| Rol            | Email                        | Contraseña       | Entra a                        |
| -------------- | ---------------------------- | ---------------- | ------------------------------ |
| Administradora | `marta.soler@santuario.test` | `MartaSoler26#!` | El panel (`/admin`)            |
| Cuidadora      | `nuria.peris@santuario.test` | `NuriaPeris26#!` | El panel (`/admin`)            |
| Adoptante      | `lucia.martinez@correo.test` | `Lucia.buitres1` | «Mis animales» (`/my-animals`) |

La lista completa también está en la cabecera de `database/TEST_DATA.sql`. Los dominios `.test` e `.invalid` están reservados y nunca corresponden a direcciones reales.

---

## 4. Qué puedes probar

| Qué                                                                                                                           | Con qué usuario                   | Dónde                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| Inicio, catálogo con filtros, ficha de un animal (con visor de fotos), cómo funciona, sobre el santuario, privacidad, cookies | Sin entrar                        | `/`, `/animals`, `/how-it-works`, `/about`, `/privacy`, `/cookies` |
| Modo claro y oscuro                                                                                                           | Cualquiera                        | Botón de la luna o el sol en la cabecera                           |
| Registrarse y verificar el email                                                                                              | Uno nuevo                         | `/register` y luego el correo en http://localhost:8025             |
| Recuperar la contraseña                                                                                                       | Cualquiera                        | `/forgot-password` y luego Mailpit                                 |
| Adoptar a un buitre con el pago simulado                                                                                      | Lucía, o uno nuevo ya verificado  | Botón «Adoptar» de una ficha                                       |
| Mis animales, su ficha ampliada y el muro de novedades                                                                        | Lucía (tiene varias adopciones)   | `/my-animals`, `/feed`                                             |
| Perfil, preferencias y cambio de contraseña                                                                                   | Cualquier adoptante               | `/profile`                                                         |
| Cuenta desactivada / email sin verificar                                                                                      | Teresa / Adrián                   | `/login`                                                           |
| Panel: escritorio con alertas, animales, fotos y vídeos, especies, actualizaciones                                            | Marta (admin) o Nuria (cuidadora) | `/admin`                                                           |
| Página de error 404                                                                                                           | Sin entrar                        | Cualquier dirección inventada, como `/xyz`                         |

---

## 5. Correos, pagos y fotos

**Correos.** La aplicación nunca envía correos reales: todos llegan a Mailpit (http://localhost:8025). Si Mailpit no está arrancado, la operación (por ejemplo, el registro) se completa igual, pero el correo se pierde.

**Pagos.** Al adoptar se abre una ventana de **pago simulado** con dos botones: «Simular pago correcto» y «Simular pago fallido». No se pide ningún dato de tarjeta. `PAYMENT_SIMULATION_MODE` en el `.env` cambia el comportamiento por defecto.

**Fotos de ejemplo.** Las fotos de los buitres de prueba **no están en el repositorio**: no se han comprobado sus derechos de autor y el repositorio es público. Sin ellas, los animales de prueba aparecen con un recuadro beige y una pluma, y todo lo demás funciona igual. Si tienes las fotos, ponlas en `ignore/test-images/` con estos nombres y ejecuta `npm run db:reset`, que las copia en su sitio:

- `buitre_leonado_1.jpg` … `_3.jpg`, `buitre_negro_1.jpg` … `_3.jpg`, `buitre_alimoche_comun_1.jpg` … `_3.jpg`, `buitre_quebrantahuesos_1.jpg` … `_3.jpg`
- Opcionales: `<especie>_test.jpg` (de respaldo para cada especie) y `vulture_placeholder.jpg` (para cualquier otra especie).

Las fotos que subas desde el panel se guardan en `server/uploads/` (tampoco se sube a GitHub).

---

## 6. Comandos

Todos se ejecutan desde la carpeta principal del proyecto.

| Comando                 | Qué hace                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `npm install`           | Instala las dependencias                                                            |
| `npm run dev`           | Arranca la API y la web en modo desarrollo                                          |
| `npm run db:reset`      | ⚠️ Borra y vuelve a crear la base de datos de la aplicación con los datos de prueba |
| `npm run db:reset:test` | Lo mismo con la base de datos de los tests                                          |
| `npm run users:file`    | Regenera `USUARIOS_PRUEBA.txt`                                                      |
| `npm test`              | Pasa todos los tests automáticos                                                    |
| `npm run typecheck`     | Comprueba los tipos de TypeScript                                                   |
| `npm run lint`          | Busca errores con ESLint                                                            |
| `npm run format`        | Da formato al código con Prettier                                                   |

Para pasar solo una parte de los tests: `npm test -w server` (solo la API), `npm test -w client` (solo la web), `npm test -w server -- -t "CU-13"` (los de un caso de uso).

Los tests de la API usan la base de datos `sanctuary_test` (nunca tocan la tuya), así que necesitan PostgreSQL arrancado y `TEST_DATABASE_URL` en el `.env`.

---

## 7. Problemas frecuentes

| Mensaje o síntoma                                                                             | Causa y solución                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Configuración no válida ... SESSION_SECRET: Debe tener al menos 32 caracteres`               | Falta la clave del paso 5 o es demasiado corta. Genera una nueva y pégala en el `.env`                                                                                                            |
| `ECONNREFUSED ... 5432`                                                                       | PostgreSQL no está arrancado. Con Docker: `docker compose up -d`. Instalado en Linux: `sudo systemctl start postgresql`                                                                           |
| `password authentication failed for user "sanctuary"` o `database "sanctuary" does not exist` | No se ha hecho el paso 3, o los datos de `DATABASE_URL` no coinciden con los de tu PostgreSQL                                                                                                     |
| `permission denied to create extension "pgcrypto"`                                            | El usuario `sanctuary` no es el dueño de la base de datos. Créala con `-O sanctuary` (o `OWNER sanctuary`) como en el paso 3                                                                      |
| `Falta TEST_DATABASE_URL`                                                                     | Añádela al `.env` (está en `.env.example`)                                                                                                                                                        |
| `EADDRINUSE ... 3000`                                                                         | Ya hay otra copia de la aplicación (u otro programa) usando el puerto de la API. Cierra la otra terminal o cambia `PORT`                                                                          |
| `Port 5173 is in use, trying another one...`                                                  | La web arranca en otro puerto (por ejemplo, 5174) y lo indica en la terminal: ábrela en ese. Los enlaces de los correos seguirán apuntando al 5173, así que es mejor cerrar lo que lo esté usando |
| No llegan los correos                                                                         | Mailpit no está arrancado. Comprueba http://localhost:8025                                                                                                                                        |
| «Demasiados intentos; espera unos minutos.» al iniciar sesión                                 | Tras 5 intentos fallidos con el mismo email se bloquea 15 minutos. Reiniciar `npm run dev` lo desbloquea                                                                                          |
| Los animales salen sin foto                                                                   | Es lo esperado sin las fotos de ejemplo ([sección 5](#5-correos-pagos-y-fotos))                                                                                                                   |
| Algo se ha quedado «raro» después de muchas pruebas                                           | `npm run db:reset` lo deja todo como al principio                                                                                                                                                 |
| Un cambio en el `.env` no se nota                                                             | Para `npm run dev` con `Ctrl + C` y vuelve a arrancarlo                                                                                                                                           |

---

## 8. Estructura y documentación

Es un monorepo con tres partes (_workspaces_ de npm):

```text
SantuarioAnimal/
├── client/     Web: React 19 + Vite, React Query, react-hook-form, i18next
├── server/     API: Express 5 + TypeScript, PostgreSQL con pg (sin ORM)
├── shared/     Esquemas Zod, tipos y constantes que usan las otras dos
├── database/   seedsql.sql (estructura) y TEST_DATA.sql (datos de prueba)
└── docs/       Especificaciones
```

| Documento                     | Contenido                                                       |
| ----------------------------- | --------------------------------------------------------------- |
| `docs/TECH_SPEC.md`           | Especificación técnica: arquitectura, API, convenciones y fases |
| `docs/USE_CASES.md`           | Casos de uso (`CU-xx`) y reglas de negocio                      |
| `docs/ux-ui/DESIGN_SYSTEM.md` | Colores, tipografía y componentes                               |
| `docs/ux-ui/SCREENS.md`       | Diseño de cada pantalla                                         |
| `CLAUDE.md`                   | Normas de trabajo del repositorio (ramas, tests, convenciones)  |

---

## 9. Estado del proyecto

El desarrollo va por fases (TECH_SPEC §16):

- ✅ **Fase 1 (MVP):** web pública, cuentas, adopción con pago simulado, área del adoptante, perfil y panel de animales, fotos, especies y actualizaciones.
- ⏳ **Fase 2:** cobro mensual automático, cambio de plan y baja, donaciones, notificaciones, recibos, contacto, baja de cuenta y administración de usuarios y pagos. Hasta entonces, los enlaces «Donar» y el formulario de contacto todavía no funcionan.
- ⏳ **Fase 3:** extras (historial veterinario, estadísticas, certificados en PDF, adopción regalo, valenciano e inglés).
- ⏳ **Fase 4:** publicación en internet.
