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
    staff_alerts,
    absences,
    shift_assignment_zones,
    shift_assignments,
    shift_zone_requirements,
    shift_templates,
    work_settings,
    task_instance_animals,
    task_instances,
    task_template_animals,
    task_templates,
    user_qualifications,
    qualifications,
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
    zones,
    user_sessions,
    user_tokens,
    users
CASCADE;

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS check_adoption_user_role() CASCADE;
DROP FUNCTION IF EXISTS check_update_author_role() CASCADE;
DROP FUNCTION IF EXISTS check_animal_cover_photo() CASCADE;
DROP FUNCTION IF EXISTS check_worker_user() CASCADE;
DROP FUNCTION IF EXISTS check_task_people() CASCADE;

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
    password_hash         VARCHAR(255) NOT NULL,           -- Argon2id (formato PHC)
    phone                 VARCHAR(30),
    role                  VARCHAR(20)  NOT NULL DEFAULT 'adopter'
                          CHECK (role IN ('adopter', 'caretaker', 'admin')),
    email_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
    show_public_name      BOOLEAN      NOT NULL DEFAULT FALSE, -- aparecer en la ficha pública del animal
    email_notifications   BOOLEAN      NOT NULL DEFAULT TRUE,  -- recibir emails (sí/no)
    email_frequency       VARCHAR(20)  NOT NULL DEFAULT 'per_update'
                          CHECK (email_frequency IN ('per_update', 'monthly_digest')),
    digest_sent_for       DATE,                            -- CU-46: primer día del último mes resumido (un resumen al mes)
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
                CHECK (type IN ('email_verification', 'password_reset', 'worker_invitation')),
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX user_tokens_user_idx ON user_tokens (user_id, type);

-- Sesiones de express-session, guardadas por el store propio de
-- server/src/middlewares/session.ts. Solo se guarda el SHA-256 del
-- identificador de la cookie: quien lea la tabla no puede suplantar a nadie.
-- user_id se copia de sess.userId para cerrar todas las sesiones de un usuario.
CREATE TABLE user_sessions (
    sid_hash  CHAR(64)    PRIMARY KEY,
    user_id   INTEGER     REFERENCES users (id) ON DELETE CASCADE,
    sess      JSONB       NOT NULL,
    expire    TIMESTAMPTZ NOT NULL,
    CONSTRAINT user_sessions_sid_hash_format CHECK (sid_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX user_sessions_expire_idx ON user_sessions (expire);
CREATE INDEX user_sessions_user_id_idx ON user_sessions (user_id);

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

-- Zonas o recintos del santuario (CU-52). Cada animal vive en una; la mayoría
-- de las tareas del personal se organizan por zona. No se borran si se usan:
-- se desactivan.
CREATE TABLE zones (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX zones_name_lower_key ON zones (LOWER(name));

CREATE TRIGGER zones_set_updated_at
    BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Animales del santuario.
-- Un animal fallecido o trasladado se archiva cambiando su estado; no se borra.
CREATE TABLE animals (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    species_id          INTEGER      NOT NULL REFERENCES species (id) ON DELETE RESTRICT,
    zone_id             INTEGER      REFERENCES zones (id) ON DELETE RESTRICT, -- CU-52: recinto donde vive
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
CREATE INDEX animals_zone_idx ON animals (zone_id);
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
    -- CU-49: 'automatic' (la tarea billing cobra cada mes) o 'manual' (el adoptante paga cada cuota).
    payment_mode         VARCHAR(20) NOT NULL DEFAULT 'automatic'
                         CHECK (payment_mode IN ('automatic', 'manual')),
    payment_reminder_sent_for DATE,                          -- CU-50: cuota manual ya avisada (idempotencia)
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
    plan_id            INTEGER       NOT NULL REFERENCES adoption_plans (id) ON DELETE RESTRICT, -- plan con el que se cobró (la adopción puede cambiarlo después)
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
    donor_surname      VARCHAR(100),                -- CU-05: obligatorio en la web, no en el alta manual
    donor_email        VARCHAR(255),
    donor_phone        VARCHAR(9),                  -- móvil español sin separadores, opcional
    -- CU-05: certificado para desgravar; si se pide, los datos fiscales son obligatorios.
    tax_certificate    BOOLEAN       NOT NULL DEFAULT FALSE,
    donor_tax_id       VARCHAR(20),
    donor_address      VARCHAR(200),
    donor_postal_code  VARCHAR(10),
    donor_province     VARCHAR(100),
    donor_country      VARCHAR(100),
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
        CHECK ((status = 'refunded') = (refunded_at IS NOT NULL)),
    CONSTRAINT donations_phone_format CHECK (donor_phone IS NULL OR donor_phone ~ '^[67][0-9]{8}$'),
    CONSTRAINT donations_tax_data_required
        CHECK (NOT tax_certificate OR (donor_tax_id IS NOT NULL AND donor_address IS NOT NULL
               AND donor_postal_code IS NOT NULL AND donor_province IS NOT NULL AND donor_country IS NOT NULL))
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
                    'coverage_gap',        -- aviso interno: turno con una zona sin cubrir (CU-64)
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

-- -----------------------------------------------------------------------------
-- 7. Trabajo diario del personal (CU-52 en adelante)
-- -----------------------------------------------------------------------------
-- Las zonas están en la sección 3, junto a los animales que viven en ellas.

-- Comprueba que un usuario es trabajador (cuidador o administrador).
CREATE FUNCTION check_worker_user() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND role IN ('caretaker', 'admin')) THEN
        RAISE EXCEPTION 'Solo un trabajador puede tener cualificaciones, turnos o ausencias (user_id = %)', NEW.user_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cualificaciones (CU-53): lo que un trabajador está autorizado a hacer,
-- como «Administrar medicación». Una tarea puede exigir una.
CREATE TABLE qualifications (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX qualifications_name_lower_key ON qualifications (LOWER(name));

CREATE TRIGGER qualifications_set_updated_at
    BEFORE UPDATE ON qualifications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cualificaciones de cada trabajador.
CREATE TABLE user_qualifications (
    user_id           INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    qualification_id  INTEGER     NOT NULL REFERENCES qualifications (id) ON DELETE RESTRICT,
    granted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, qualification_id)
);

CREATE TRIGGER user_qualifications_check_worker
    BEFORE INSERT OR UPDATE OF user_id ON user_qualifications
    FOR EACH ROW EXECUTE FUNCTION check_worker_user();

-- Plantillas de tareas recurrentes (CU-54). De cada una salen las tareas
-- concretas de cada día (task_instances) con la tarea generate-tasks.
--   recurrence = 'daily'        -> todos los días
--   recurrence = 'weekdays'     -> los días de `weekdays` (1 = lunes ... 7 = domingo)
--   recurrence = 'every_n_days' -> cada `interval_days` días contando desde start_date
-- Las horas (`times`) son de Europe/Madrid. No se borran si ya tienen
-- historial: se desactivan.
CREATE TABLE task_templates (
    id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type              VARCHAR(20)  NOT NULL
                      CHECK (type IN ('feeding', 'cleaning', 'medication', 'enrichment', 'health_check', 'maintenance')),
    title             VARCHAR(150) NOT NULL,
    description       TEXT,
    zone_id           INTEGER      REFERENCES zones (id) ON DELETE RESTRICT, -- si falta, la de sus animales
    qualification_id  INTEGER      REFERENCES qualifications (id) ON DELETE RESTRICT,
    times             TIME[]       NOT NULL,
    recurrence        VARCHAR(20)  NOT NULL
                      CHECK (recurrence IN ('daily', 'weekdays', 'every_n_days')),
    weekdays          SMALLINT[],
    interval_days     SMALLINT,
    start_date        DATE         NOT NULL,
    end_date          DATE,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by        INTEGER      REFERENCES users (id) ON DELETE RESTRICT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT task_templates_times_count CHECK (cardinality(times) BETWEEN 1 AND 12),
    CONSTRAINT task_templates_dates_order CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT task_templates_weekdays_consistent
        CHECK ((recurrence = 'weekdays') = (weekdays IS NOT NULL)),
    CONSTRAINT task_templates_weekdays_valid
        CHECK (weekdays IS NULL OR (cardinality(weekdays) BETWEEN 1 AND 7
               AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[])),
    CONSTRAINT task_templates_interval_consistent
        CHECK ((recurrence = 'every_n_days') = (interval_days IS NOT NULL)),
    CONSTRAINT task_templates_interval_valid
        CHECK (interval_days IS NULL OR interval_days BETWEEN 2 AND 365)
);

CREATE INDEX task_templates_active_idx ON task_templates (is_active, start_date);

CREATE TRIGGER task_templates_set_updated_at
    BEFORE UPDATE ON task_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Animales a los que se refiere una plantilla (opcional).
CREATE TABLE task_template_animals (
    template_id  INTEGER NOT NULL REFERENCES task_templates (id) ON DELETE CASCADE,
    animal_id    INTEGER NOT NULL REFERENCES animals (id) ON DELETE CASCADE,
    PRIMARY KEY (template_id, animal_id)
);

CREATE INDEX task_template_animals_animal_idx ON task_template_animals (animal_id);

-- Tareas concretas de un día (CU-56, CU-57). Las genera generate-tasks a partir
-- de las plantillas; las puntuales (sin plantilla) las crea un administrador.
--   pending   -> por hacer («atrasada» se calcula: pasada la hora y el margen)
--   completed -> hecha: quién (resolved_by) y cuándo (resolved_at)
--   not_done  -> no realizada: la marca un trabajador con el motivo, o el
--                sistema (resolved_by NULL) si acaba el día sin hacerse
CREATE TABLE task_instances (
    id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_id       INTEGER      REFERENCES task_templates (id) ON DELETE CASCADE,
    type              VARCHAR(20)  NOT NULL
                      CHECK (type IN ('feeding', 'cleaning', 'medication', 'enrichment', 'health_check', 'maintenance')),
    title             VARCHAR(150) NOT NULL,
    description       TEXT,
    zone_id           INTEGER      REFERENCES zones (id) ON DELETE RESTRICT,
    qualification_id  INTEGER      REFERENCES qualifications (id) ON DELETE RESTRICT,
    due_date          DATE         NOT NULL,                -- día en Europe/Madrid
    due_time          TIME         NOT NULL,                -- hora en Europe/Madrid
    due_at            TIMESTAMPTZ  NOT NULL,                -- el mismo instante, para comparar con «ahora»
    status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'completed', 'not_done')),
    assigned_to       INTEGER      REFERENCES users (id) ON DELETE RESTRICT, -- reasignación explícita del admin
    resolved_by       INTEGER      REFERENCES users (id) ON DELETE RESTRICT,
    resolved_at       TIMESTAMPTZ,
    observations      VARCHAR(1000),
    photo_url         VARCHAR(500),
    created_by        INTEGER      REFERENCES users (id) ON DELETE RESTRICT, -- admin, si es puntual
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT task_instances_resolved_consistent CHECK ((status = 'pending') = (resolved_at IS NULL)),
    CONSTRAINT task_instances_completed_by CHECK (status <> 'completed' OR resolved_by IS NOT NULL),
    -- Siempre hay alguien responsable: la gente de la zona o una persona concreta.
    CONSTRAINT task_instances_has_owner CHECK (zone_id IS NOT NULL OR assigned_to IS NOT NULL)
);

-- Generación idempotente: una sola tarea por plantilla e instante.
CREATE UNIQUE INDEX task_instances_template_due_key
    ON task_instances (template_id, due_at) WHERE template_id IS NOT NULL;
CREATE INDEX task_instances_day_idx ON task_instances (due_date, zone_id);
CREATE INDEX task_instances_pending_idx ON task_instances (due_at) WHERE status = 'pending';

CREATE TRIGGER task_instances_set_updated_at
    BEFORE UPDATE ON task_instances
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Quien tiene asignada o completa una tarea es un trabajador y, si la tarea
-- exige una cualificación, la tiene (CU-57, regla aplicada también en el dominio).
CREATE FUNCTION check_task_people() RETURNS trigger AS $$
DECLARE
    persona INTEGER;
BEGIN
    FOREACH persona IN ARRAY ARRAY[NEW.assigned_to, CASE WHEN NEW.status = 'completed' THEN NEW.resolved_by END] LOOP
        CONTINUE WHEN persona IS NULL;
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = persona AND role IN ('caretaker', 'admin')) THEN
            RAISE EXCEPTION 'La tarea % solo la puede tener o completar un trabajador (user_id = %)', NEW.id, persona
                USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.qualification_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM user_qualifications
             WHERE user_id = persona AND qualification_id = NEW.qualification_id
        ) THEN
            RAISE EXCEPTION 'La tarea % exige la cualificación % (user_id = %)', NEW.id, NEW.qualification_id, persona
                USING ERRCODE = 'check_violation';
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_instances_check_people
    BEFORE INSERT OR UPDATE OF assigned_to, resolved_by, status, qualification_id ON task_instances
    FOR EACH ROW EXECUTE FUNCTION check_task_people();

-- Animales de cada tarea concreta (copiados de la plantilla al generarla).
CREATE TABLE task_instance_animals (
    task_id    INTEGER NOT NULL REFERENCES task_instances (id) ON DELETE CASCADE,
    animal_id  INTEGER NOT NULL REFERENCES animals (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, animal_id)
);

CREATE INDEX task_instance_animals_animal_idx ON task_instance_animals (animal_id);

-- Ajustes del trabajo diario (CU-73). Una sola fila, que crea este script.
CREATE TABLE work_settings (
    id                   SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    late_margin_minutes  SMALLINT    NOT NULL DEFAULT 30
                         CHECK (late_margin_minutes BETWEEN 0 AND 240), -- «atrasada» tras la hora + este margen
    updated_by           INTEGER     REFERENCES users (id) ON DELETE RESTRICT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO work_settings (id) VALUES (1);

CREATE TRIGGER work_settings_set_updated_at
    BEFORE UPDATE ON work_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Turnos (CU-60): franja horaria del mismo día que se repite unos días de la
-- semana (ISO: 1 = lunes … 7 = domingo).
CREATE TABLE shift_templates (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    start_time  TIME         NOT NULL,
    end_time    TIME         NOT NULL,
    weekdays    SMALLINT[]   NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT shift_templates_times CHECK (end_time > start_time),
    CONSTRAINT shift_templates_weekdays CHECK (
        cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[])
);

CREATE UNIQUE INDEX shift_templates_name_lower_key ON shift_templates (LOWER(name));

CREATE TRIGGER shift_templates_set_updated_at
    BEFORE UPDATE ON shift_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cuántas personas necesita cada zona en un turno (CU-60, CU-64).
CREATE TABLE shift_zone_requirements (
    shift_template_id  INTEGER  NOT NULL REFERENCES shift_templates (id) ON DELETE CASCADE,
    zone_id            INTEGER  NOT NULL REFERENCES zones (id) ON DELETE RESTRICT,
    min_workers        SMALLINT NOT NULL CHECK (min_workers BETWEEN 1 AND 20),
    PRIMARY KEY (shift_template_id, zone_id)
);

-- Una persona en un turno un día concreto, con su fichaje (CU-61, CU-63).
CREATE TABLE shift_assignments (
    id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shift_template_id  INTEGER     NOT NULL REFERENCES shift_templates (id) ON DELETE RESTRICT,
    shift_date         DATE        NOT NULL,
    user_id            INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    checked_in_at      TIMESTAMPTZ,
    checked_out_at     TIMESTAMPTZ,
    created_by         INTEGER     REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT shift_assignments_unique UNIQUE (shift_template_id, shift_date, user_id),
    CONSTRAINT shift_assignments_check_out CHECK (
        checked_out_at IS NULL OR (checked_in_at IS NOT NULL AND checked_out_at >= checked_in_at))
);

CREATE INDEX shift_assignments_date_idx ON shift_assignments (shift_date);
CREATE INDEX shift_assignments_user_idx ON shift_assignments (user_id, shift_date);

CREATE TRIGGER shift_assignments_check_worker
    BEFORE INSERT OR UPDATE OF user_id ON shift_assignments
    FOR EACH ROW EXECUTE FUNCTION check_worker_user();

-- Zonas que cubre esa persona en ese turno.
CREATE TABLE shift_assignment_zones (
    assignment_id  INTEGER NOT NULL REFERENCES shift_assignments (id) ON DELETE CASCADE,
    zone_id        INTEGER NOT NULL REFERENCES zones (id) ON DELETE RESTRICT,
    PRIMARY KEY (assignment_id, zone_id)
);

-- Ausencias (CU-62): vacaciones, bajas… de un día a otro, ambos incluidos.
CREATE TABLE absences (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    start_date  DATE         NOT NULL,
    end_date    DATE         NOT NULL,
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('vacation', 'sick_leave', 'personal', 'other')),
    notes       VARCHAR(500),
    created_by  INTEGER      REFERENCES users (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT absences_dates CHECK (end_date >= start_date)
);

CREATE INDEX absences_user_dates_idx ON absences (user_id, start_date, end_date);

CREATE TRIGGER absences_check_worker
    BEFORE INSERT OR UPDATE OF user_id ON absences
    FOR EACH ROW EXECUTE FUNCTION check_worker_user();

-- Avisos internos ya enviados (CU-64 en adelante): cada aviso, una sola vez.
-- `ref_key` identifica lo avisado (p. ej. «2026-11-25:1:4» = día, turno y zona).
CREATE TABLE staff_alerts (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind        VARCHAR(30)  NOT NULL,
    ref_key     VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT staff_alerts_unique UNIQUE (kind, ref_key)
);

COMMIT;
