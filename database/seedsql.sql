-- =============================================================================
-- Santuario de Animales — Estructura de la base de datos (seedsql.sql)
-- =============================================================================
-- Motor:      PostgreSQL 14 o superior (probado en PostgreSQL 16).
-- Contenido:  SOLO la estructura (tablas, restricciones, índices y triggers).
--             Los datos de ejemplo están en TEST_DATA.sql.
--
-- AVISO: este script BORRA todas las tablas del proyecto y las vuelve a crear.
--        Todos los datos se pierden. Está pensado para reiniciar la base de
--        datos durante el desarrollo. Orden de ejecución:
--            1. seedsql.sql    (estructura)
--            2. TEST_DATA.sql  (datos de prueba)
--        Ejemplo:
--            psql -d sanctuary -f seedsql.sql -f TEST_DATA.sql
--
-- Convenciones:
--   - Tablas, columnas y valores de estado en inglés y en snake_case.
--   - Claves primarias: INTEGER GENERATED ALWAYS AS IDENTITY.
--   - Estados y tipos: VARCHAR con CHECK (más fácil de ampliar que ENUM).
--   - Fechas con hora: TIMESTAMPTZ. Fechas sin hora: DATE.
--   - Importes: NUMERIC(10,2), en euros.
--   - Lo que tiene historial económico o afectivo no se borra físicamente:
--     las claves foráneas usan ON DELETE RESTRICT salvo que se indique.
--   - Las tablas marcadas como [FASE 3] existen desde el principio para que
--     añadir esa fase no requiera migraciones; la aplicación las usará cuando
--     se implemente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Limpieza: se borra todo lo que crea este script
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS
    activity_logs,
    vet_records,
    notifications,
    update_reads,
    donations,
    payments,
    adoptions,
    adoption_plans,
    photos,
    animal_updates,
    animals,
    species,
    user_sessions,
    user_tokens,
    users
CASCADE;

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS check_adoption_user_role() CASCADE;
DROP FUNCTION IF EXISTS check_update_author_role() CASCADE;
DROP FUNCTION IF EXISTS check_animal_cover_photo() CASCADE;

-- pgcrypto: gratuita, incluida con PostgreSQL y "trusted" desde la versión 13
-- (no necesita superusuario). Se usa en TEST_DATA.sql para generar los hashes
-- bcrypt de las contraseñas de prueba con crypt() y gen_salt('bf').
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Funciones auxiliares
-- -----------------------------------------------------------------------------

-- Actualiza automáticamente la columna updated_at en cada UPDATE.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. Usuarios y autenticación
-- -----------------------------------------------------------------------------

-- Usuarios registrados. El visitante (sin cuenta) no se guarda.
-- Cada usuario tiene un único rol. Los trabajadores (caretaker, admin) nunca
-- adoptan con su cuenta de trabajo (ver trigger en adoptions).
CREATE TABLE users (
    id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name            VARCHAR(100) NOT NULL,
    last_name             VARCHAR(150) NOT NULL,
    email                 VARCHAR(255) NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,           -- bcrypt
    phone                 VARCHAR(30),
    role                  VARCHAR(20)  NOT NULL DEFAULT 'adopter'
                          CHECK (role IN ('adopter', 'caretaker', 'admin')),
    email_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
    show_public_name      BOOLEAN      NOT NULL DEFAULT FALSE, -- aparecer en la ficha pública del animal
    email_notifications   BOOLEAN      NOT NULL DEFAULT TRUE,  -- recibir emails (sí/no)
    email_frequency       VARCHAR(20)  NOT NULL DEFAULT 'per_update'
                          CHECK (email_frequency IN ('per_update', 'monthly_digest')),
    preferred_language    VARCHAR(10)  NOT NULL DEFAULT 'es'
                          CHECK (preferred_language IN ('es', 'ca', 'en')), -- [FASE 3] multidioma
    privacy_accepted_at   TIMESTAMPTZ,                     -- consentimiento RGPD
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    anonymized_at         TIMESTAMPTZ,                     -- baja solicitada: datos personales anonimizados
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT users_anonymized_inactive CHECK (anonymized_at IS NULL OR is_active = FALSE),
    -- Móvil español de 9 dígitos, sin prefijo ni separadores.
    CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~ '^[67][0-9]{8}$')
);

-- Email único sin distinguir mayúsculas y minúsculas.
CREATE UNIQUE INDEX users_email_lower_key ON users (LOWER(email));
CREATE INDEX users_role_idx ON users (role);

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tokens de un solo uso: verificación de email y recuperación de contraseña.
-- Se guarda el hash del token, nunca el token en claro.
CREATE TABLE user_tokens (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type        VARCHAR(30)  NOT NULL
                CHECK (type IN ('email_verification', 'password_reset')),
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX user_tokens_user_idx ON user_tokens (user_id, type);

-- Sesiones de express-session, gestionadas por connect-pg-simple
-- (configurado con tableName: 'user_sessions'). La aplicación no la toca.
CREATE TABLE user_sessions (
    sid     VARCHAR      NOT NULL COLLATE "default" PRIMARY KEY,
    sess    JSON         NOT NULL,
    expire  TIMESTAMP(6) NOT NULL
);

CREATE INDEX user_sessions_expire_idx ON user_sessions (expire);

-- -----------------------------------------------------------------------------
-- 3. Especies y animales
-- -----------------------------------------------------------------------------

-- Catálogo de especies. Por ahora solo buitres; se pueden añadir otras
-- (por ejemplo, lince ibérico) como nuevas filas, sin cambiar la estructura.
CREATE TABLE species (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    scientific_name  VARCHAR(150),
    description      TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX species_name_lower_key ON species (LOWER(name));

CREATE TRIGGER species_set_updated_at
    BEFORE UPDATE ON species
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Animales del santuario.
-- Un animal fallecido o trasladado se archiva cambiando su estado; no se borra.
CREATE TABLE animals (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    species_id          INTEGER      NOT NULL REFERENCES species (id) ON DELETE RESTRICT,
    breed               VARCHAR(100),                       -- opcional; vacío en buitres
    sex                 VARCHAR(10)  NOT NULL DEFAULT 'unknown'
                        CHECK (sex IN ('male', 'female', 'unknown')),
    approx_birth_date   DATE,
    arrival_date        DATE         NOT NULL,
    rescue_story        TEXT,
    temperament         TEXT,
    special_needs       TEXT,
    health_summary      TEXT,                               -- resumen de salud en lenguaje sencillo (solo adoptantes)
    status              VARCHAR(20)  NOT NULL DEFAULT 'in_sanctuary'
                        CHECK (status IN ('in_sanctuary', 'in_treatment', 'deceased', 'transferred')),
    status_changed_at   DATE,                               -- fecha del fallecimiento o traslado
    is_adoptable        BOOLEAN      NOT NULL DEFAULT TRUE,
    is_published        BOOLEAN      NOT NULL DEFAULT FALSE,
    show_in_memorial    BOOLEAN      NOT NULL DEFAULT FALSE, -- [FASE 3] sección «En memoria»
    cover_photo_id      INTEGER,                            -- FK añadida tras crear photos
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT animals_birth_before_arrival
        CHECK (approx_birth_date IS NULL OR approx_birth_date <= arrival_date),
    -- Un animal fallecido o trasladado no puede estar disponible para adoptar.
    CONSTRAINT animals_archived_not_adoptable
        CHECK (status NOT IN ('deceased', 'transferred') OR is_adoptable = FALSE),
    -- Solo los fallecidos pueden aparecer en «En memoria».
    CONSTRAINT animals_memorial_only_deceased
        CHECK (show_in_memorial = FALSE OR status = 'deceased')
);

CREATE INDEX animals_species_idx ON animals (species_id);
CREATE INDEX animals_catalog_idx ON animals (is_published, status, is_adoptable);
CREATE INDEX animals_name_lower_idx ON animals (LOWER(name));

CREATE TRIGGER animals_set_updated_at
    BEFORE UPDATE ON animals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Actualizaciones de un animal (lo que recibe el adoptante a cambio de su cuota).
-- Solo las escriben trabajadores (ver trigger).
CREATE TABLE animal_updates (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    animal_id     INTEGER      NOT NULL REFERENCES animals (id) ON DELETE CASCADE,
    author_id     INTEGER      NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    title         VARCHAR(200) NOT NULL,
    body          TEXT         NOT NULL,
    visibility    VARCHAR(20)  NOT NULL DEFAULT 'adopters'
                  CHECK (visibility IN ('public', 'adopters')),
    published_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT animal_updates_id_animal_key UNIQUE (id, animal_id) -- para la FK compuesta de photos
);

CREATE INDEX animal_updates_animal_idx ON animal_updates (animal_id, published_at DESC);

CREATE TRIGGER animal_updates_set_updated_at
    BEFORE UPDATE ON animal_updates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION check_update_author_role() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.author_id AND role IN ('caretaker', 'admin')
    ) THEN
        RAISE EXCEPTION 'Solo un cuidador o un administrador puede escribir actualizaciones (author_id = %)', NEW.author_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER animal_updates_check_author
    BEFORE INSERT OR UPDATE OF author_id ON animal_updates
    FOR EACH ROW EXECUTE FUNCTION check_update_author_role();

-- Fotos y vídeos de un animal. Pueden pertenecer a una actualización concreta.
CREATE TABLE photos (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    animal_id      INTEGER      NOT NULL REFERENCES animals (id) ON DELETE CASCADE,
    update_id      INTEGER,                                 -- opcional: foto de una actualización
    media_type     VARCHAR(10)  NOT NULL DEFAULT 'image'
                   CHECK (media_type IN ('image', 'video')),
    url            VARCHAR(500) NOT NULL,
    thumbnail_url  VARCHAR(500),
    alt_text       VARCHAR(300) NOT NULL,                   -- accesibilidad: obligatorio
    sort_order     INTEGER      NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    visibility     VARCHAR(20)  NOT NULL DEFAULT 'public'
                   CHECK (visibility IN ('public', 'adopters')),
    uploaded_by    INTEGER      REFERENCES users (id) ON DELETE RESTRICT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT photos_id_animal_key UNIQUE (id, animal_id),
    -- La actualización debe ser del mismo animal. Si se borra la actualización,
    -- se borran sus fotos.
    CONSTRAINT photos_update_same_animal_fk
        FOREIGN KEY (update_id, animal_id)
        REFERENCES animal_updates (id, animal_id) ON DELETE CASCADE
);

CREATE INDEX photos_animal_idx ON photos (animal_id, sort_order);
CREATE INDEX photos_update_idx ON photos (update_id);

-- Foto de portada: si se borra la foto, el animal se queda sin portada.
ALTER TABLE animals
    ADD CONSTRAINT animals_cover_photo_fk
    FOREIGN KEY (cover_photo_id)
    REFERENCES photos (id)
    ON DELETE SET NULL;

-- La portada debe ser una imagen pública del mismo animal.
CREATE FUNCTION check_animal_cover_photo() RETURNS trigger AS $$
BEGIN
    IF NEW.cover_photo_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM photos
        WHERE id = NEW.cover_photo_id
          AND animal_id = NEW.id
          AND media_type = 'image'
          AND visibility = 'public'
    ) THEN
        RAISE EXCEPTION 'La foto de portada % debe ser una imagen pública del animal %', NEW.cover_photo_id, NEW.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER animals_check_cover_photo
    BEFORE INSERT OR UPDATE OF cover_photo_id ON animals
    FOR EACH ROW EXECUTE FUNCTION check_animal_cover_photo();

-- -----------------------------------------------------------------------------
-- 4. Planes, adopciones y pagos
-- -----------------------------------------------------------------------------

-- Los tres planes mensuales: Simbólica (1 €), Usual (5 €), Extraordinaria (12 €).
-- Todos son mensuales; el administrador puede editar nombre, importe y
-- descripción, pero no crear periodicidades distintas.
CREATE TABLE adoption_plans (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(50)   NOT NULL,
    monthly_amount  NUMERIC(10,2) NOT NULL CHECK (monthly_amount > 0),
    description     TEXT,
    is_default      BOOLEAN       NOT NULL DEFAULT FALSE,   -- plan preseleccionado (Usual)
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order      INTEGER       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT adoption_plans_default_active CHECK (is_default = FALSE OR is_active = TRUE)
);

CREATE UNIQUE INDEX adoption_plans_name_lower_key ON adoption_plans (LOWER(name));
-- Como mucho un plan por defecto.
CREATE UNIQUE INDEX adoption_plans_single_default ON adoption_plans (is_default) WHERE is_default;

CREATE TRIGGER adoption_plans_set_updated_at
    BEFORE UPDATE ON adoption_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Adopción simbólica: une un adoptante con un animal y un plan.
--   pending   -> creada al iniciar el pago; se cancela si no se paga en 7 días
--   active    -> pago confirmado; se cobra cada mes
--   paused    -> falló una cuota mensual; pendiente de reintento
--   cancelled -> terminada antes de tiempo (pago nunca completado, admin...)
--   finished  -> terminada de forma normal (baja del adoptante al final del
--                mes pagado, fallecimiento o traslado del animal...)
-- Las adopciones nunca se borran.
CREATE TABLE adoptions (
    id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              INTEGER     NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    animal_id            INTEGER     NOT NULL REFERENCES animals (id) ON DELETE RESTRICT,
    plan_id              INTEGER     NOT NULL REFERENCES adoption_plans (id) ON DELETE RESTRICT,
    next_plan_id         INTEGER     REFERENCES adoption_plans (id) ON DELETE RESTRICT, -- cambio de plan que se aplica en la siguiente cuota
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'finished')),
    start_date           DATE,                               -- se fija al confirmarse el primer pago
    end_date             DATE,                               -- último día cubierto / fecha de cierre
    next_billing_date    DATE,                               -- próxima cuota prevista
    cancel_requested_at  TIMESTAMPTZ,                        -- el adoptante pidió la baja (sigue activa hasta end_date)
    end_reason           VARCHAR(30)
                         CHECK (end_reason IN (
                             'user_cancelled',        -- baja del adoptante
                             'payment_not_completed', -- pendiente más de 7 días
                             'payment_failed',        -- pausada sin regularizar
                             'animal_deceased',
                             'animal_transferred',
                             'admin_cancelled',
                             'account_deleted'
                         )),
    gifted_by_user_id    INTEGER     REFERENCES users (id) ON DELETE RESTRICT, -- [FASE 3] adopción regalo: quien paga
    created_by           INTEGER     REFERENCES users (id) ON DELETE RESTRICT, -- admin, si se creó a mano
    notes                TEXT,                               -- notas internas del admin
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT adoptions_dates_order
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CONSTRAINT adoptions_next_plan_differs
        CHECK (next_plan_id IS NULL OR next_plan_id <> plan_id),
    -- Una adopción activa o pausada siempre tiene fecha de inicio.
    CONSTRAINT adoptions_started_has_start_date
        CHECK (status NOT IN ('active', 'paused') OR start_date IS NOT NULL),
    -- Las adopciones cerradas indican el motivo; las abiertas no.
    CONSTRAINT adoptions_end_reason_consistent
        CHECK ((status IN ('cancelled', 'finished')) = (end_reason IS NOT NULL)),
    CONSTRAINT adoptions_gift_other_user
        CHECK (gifted_by_user_id IS NULL OR gifted_by_user_id <> user_id)
);

-- Restricción clave: un adoptante no puede tener dos adopciones en curso
-- (pendiente, activa o pausada) del mismo animal a la vez.
CREATE UNIQUE INDEX adoptions_one_open_per_user_animal
    ON adoptions (user_id, animal_id)
    WHERE status IN ('pending', 'active', 'paused');

CREATE INDEX adoptions_user_idx ON adoptions (user_id, status);
CREATE INDEX adoptions_animal_idx ON adoptions (animal_id, status);
CREATE INDEX adoptions_billing_idx ON adoptions (next_billing_date) WHERE status = 'active';

CREATE TRIGGER adoptions_set_updated_at
    BEFORE UPDATE ON adoptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Solo los adoptantes pueden adoptar (los trabajadores no adoptan con su cuenta).
CREATE FUNCTION check_adoption_user_role() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'adopter') THEN
        RAISE EXCEPTION 'Solo un usuario con rol adopter puede tener adopciones (user_id = %)', NEW.user_id
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.gifted_by_user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.gifted_by_user_id AND role = 'adopter') THEN
        RAISE EXCEPTION 'Solo un usuario con rol adopter puede regalar una adopción (gifted_by_user_id = %)', NEW.gifted_by_user_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER adoptions_check_user_role
    BEFORE INSERT OR UPDATE OF user_id, gifted_by_user_id ON adoptions
    FOR EACH ROW EXECUTE FUNCTION check_adoption_user_role();

-- Cuotas mensuales de las adopciones. Nunca se borran.
CREATE TABLE payments (
    id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    adoption_id        INTEGER       NOT NULL REFERENCES adoptions (id) ON DELETE RESTRICT,
    amount             NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    period_start       DATE          NOT NULL,              -- mes cubierto por la cuota
    period_end         DATE          NOT NULL,
    method             VARCHAR(20)   NOT NULL DEFAULT 'simulated'
                       CHECK (method IN ('simulated', 'cash', 'bank_transfer', 'card')),
    status             VARCHAR(20)   NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_reference  VARCHAR(100)  NOT NULL UNIQUE,        -- referencia (simulada) de la pasarela
    failure_reason     VARCHAR(255),
    paid_at            TIMESTAMPTZ,
    refunded_at        TIMESTAMPTZ,
    recorded_by        INTEGER       REFERENCES users (id) ON DELETE RESTRICT, -- admin, si es manual
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT payments_period_order CHECK (period_end >= period_start),
    CONSTRAINT payments_paid_at_required
        CHECK (status NOT IN ('completed', 'refunded') OR paid_at IS NOT NULL),
    CONSTRAINT payments_refunded_at_consistent
        CHECK ((status = 'refunded') = (refunded_at IS NOT NULL))
);

-- No puede haber dos cuotas válidas (pendiente o cobrada) para el mismo periodo
-- de la misma adopción. Hace idempotente el proceso de cobro mensual.
-- Las fallidas no cuentan, para poder reintentar.
CREATE UNIQUE INDEX payments_one_valid_per_period
    ON payments (adoption_id, period_start)
    WHERE status IN ('pending', 'completed');

CREATE INDEX payments_adoption_idx ON payments (adoption_id, period_start DESC);
CREATE INDEX payments_status_idx ON payments (status, created_at);

CREATE TRIGGER payments_set_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Donaciones únicas al santuario, de importe libre (sin mínimo, mayor que 0),
-- con o sin cuenta. No se vinculan a ningún animal. Nunca se borran.
CREATE TABLE donations (
    id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            INTEGER       REFERENCES users (id) ON DELETE RESTRICT, -- opcional
    donor_name         VARCHAR(200),
    donor_email        VARCHAR(255),
    amount             NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    is_anonymous       BOOLEAN       NOT NULL DEFAULT FALSE,
    message            VARCHAR(1000),
    method             VARCHAR(20)   NOT NULL DEFAULT 'simulated'
                       CHECK (method IN ('simulated', 'cash', 'bank_transfer', 'card')),
    status             VARCHAR(20)   NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_reference  VARCHAR(100)  NOT NULL UNIQUE,
    failure_reason     VARCHAR(255),
    paid_at            TIMESTAMPTZ,
    refunded_at        TIMESTAMPTZ,
    recorded_by        INTEGER       REFERENCES users (id) ON DELETE RESTRICT, -- admin, si es manual
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT donations_paid_at_required
        CHECK (status NOT IN ('completed', 'refunded') OR paid_at IS NOT NULL),
    CONSTRAINT donations_refunded_at_consistent
        CHECK ((status = 'refunded') = (refunded_at IS NOT NULL))
);

CREATE INDEX donations_user_idx ON donations (user_id);
CREATE INDEX donations_status_idx ON donations (status, created_at);

CREATE TRIGGER donations_set_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Lecturas y notificaciones
-- -----------------------------------------------------------------------------

-- Marca de «leído» del muro de actualizaciones de cada adoptante.
-- Si no hay fila, la actualización está sin leer.
CREATE TABLE update_reads (
    user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    update_id  INTEGER     NOT NULL REFERENCES animal_updates (id) ON DELETE CASCADE,
    read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, update_id)
);

-- Avisos dentro de la web (campana).
CREATE TABLE notifications (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type        VARCHAR(30)  NOT NULL
                CHECK (type IN (
                    'new_update',          -- nueva actualización de un animal adoptado
                    'adoption_welcome',    -- adopción activada
                    'payment_completed',   -- cuota cobrada
                    'payment_failed',      -- cuota fallida / adopción pausada
                    'plan_changed',        -- cambio de plan programado
                    'adoption_cancelled',  -- baja confirmada o adopción cancelada
                    'adoption_closed',     -- cierre por fallecimiento o traslado del animal
                    'donation_thanks',     -- agradecimiento por donación
                    'update_reminder',     -- aviso interno: animal sin actualización
                    'system'
                )),
    message     VARCHAR(500) NOT NULL,
    link        VARCHAR(500),                               -- ruta interna, p. ej. /my-animals/3
    is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_idx ON notifications (user_id, is_read, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. [FASE 3] Historial veterinario y registro de actividad
-- -----------------------------------------------------------------------------

-- Historial veterinario. Interno: el adoptante solo ve animals.health_summary.
CREATE TABLE vet_records (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    animal_id     INTEGER      NOT NULL REFERENCES animals (id) ON DELETE CASCADE,
    record_date   DATE         NOT NULL,
    type          VARCHAR(20)  NOT NULL
                  CHECK (type IN ('checkup', 'vaccine', 'treatment', 'surgery')),
    description   TEXT         NOT NULL,
    weight_kg     NUMERIC(6,2) CHECK (weight_kg > 0),
    veterinarian  VARCHAR(150),
    created_by    INTEGER      REFERENCES users (id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX vet_records_animal_idx ON vet_records (animal_id, record_date DESC);

CREATE TRIGGER vet_records_set_updated_at
    BEFORE UPDATE ON vet_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Registro de actividad: quién creó, cambió o borró qué y cuándo.
-- Solo lo escribe el sistema; nunca se modifica ni se borra.
-- user_id es NULL cuando la acción la hace un proceso automático.
CREATE TABLE activity_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER      REFERENCES users (id) ON DELETE RESTRICT,
    action      VARCHAR(20)  NOT NULL
                CHECK (action IN ('create', 'update', 'delete', 'archive')),
    table_name  VARCHAR(50)  NOT NULL,
    record_id   INTEGER      NOT NULL,
    details     JSONB,                                      -- cambios relevantes (sin contraseñas)
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_logs_record_idx ON activity_logs (table_name, record_id);
CREATE INDEX activity_logs_user_idx ON activity_logs (user_id, created_at DESC);

COMMIT;