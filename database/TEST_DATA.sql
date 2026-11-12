-- =============================================================================
-- Santuario de Animales — Datos de prueba (TEST_DATA.sql)
-- =============================================================================
-- Motor:      PostgreSQL 14 o superior (probado en PostgreSQL 16).
-- Requisito:  ejecutar antes seedsql.sql (estructura).
--             psql -d sanctuary -f seedsql.sql -f TEST_DATA.sql
--
-- AVISO: este script VACÍA todas las tablas antes de insertar los datos, así
--        que también sirve para restaurar el estado inicial después de una
--        prueba que haya salido mal.
--
-- Todas las fechas son RELATIVAS al día en que se carga el script (por ejemplo,
-- «hace 3 meses»), para que las cuotas, los avisos de 14 días sin actualización
-- y las adopciones pendientes tengan siempre sentido.
--
-- Por ahora el santuario solo acoge buitres. Otras especies (como el lince
-- ibérico) se añadirían como nuevas filas de species.
-- =============================================================================
--
-- USUARIOS DE PRUEBA
-- -----------------------------------------------------------------------------
-- Las contraseñas se guardan con hash bcrypt (pgcrypto). Aquí se indican en
-- claro para poder iniciar sesión durante las pruebas.
--
-- Trabajadores. Convenio: NombreApellido + "26#!" (sin tildes ni espacios).
--   id  rol        email                           contraseña
--   1   admin      marta.soler@santuario.test      MartaSoler26#!
--   2   admin      javier.ortega@santuario.test    JavierOrtega26#!
--   3   caretaker  nuria.peris@santuario.test      NuriaPeris26#!
--   4   caretaker  andres.climent@santuario.test   AndresCliment26#!
--   5   caretaker  carmen.boix@santuario.test      CarmenBoix26#!
--
-- Adoptantes. Cada uno eligió su propia contraseña.
--   id  email                           contraseña        notas
--   6   lucia.martinez@correo.test      Lucia.buitres1    varias adopciones; nombre público
--   7   pablo.garcia@correo.test        Pablo2024!        cambio de plan programado; una devolución
--   8   elena.rubio@correo.test         elenita_88        adopción pausada (cuota fallida); resumen mensual
--   9   sergio.llorens@correo.test      Sergio#Vuela7     baja solicitada en una adopción
--   10  irene.dominguez@correo.test     Irene2025ok       adopción pendiente reciente (< 7 días)
--   11  hector.benet@correo.test        Hector1234        adopción pendiente antigua (> 7 días); sin emails
--   12  raquel.font@correo.test         RaquelFont!       adopción creada a mano por un admin (efectivo)
--   13  adrian.moreno@correo.test       Adrian_99         email sin verificar; sin adopciones
--   14  teresa.vicent@correo.test       Teresa*55         cuenta desactivada por un admin
--   15  (anonimizado)                   —                 pidió la baja; se conservan sus pagos
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Vaciar todas las tablas y reiniciar los contadores de id
-- -----------------------------------------------------------------------------
TRUNCATE TABLE
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
RESTART IDENTITY CASCADE;

-- Funciones temporales (solo existen durante esta sesión) para escribir fechas
-- relativas: ago('3 months') = hoy menos 3 meses.
CREATE FUNCTION pg_temp.ago(i TEXT) RETURNS DATE AS $$
    SELECT (CURRENT_DATE - i::INTERVAL)::DATE;
$$ LANGUAGE sql STABLE;

-- ago_ts('3 days', '10:30') = hace 3 días a las 10:30 (hora del servidor).
CREATE FUNCTION pg_temp.ago_ts(i TEXT, t TEXT DEFAULT '10:00') RETURNS TIMESTAMPTZ AS $$
    SELECT (CURRENT_DATE - i::INTERVAL + t::TIME)::TIMESTAMPTZ;
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- 1. Usuarios
-- -----------------------------------------------------------------------------
INSERT INTO users (
    id, first_name, last_name, email, password_hash, phone, role,
    email_verified, show_public_name, email_notifications, email_frequency,
    privacy_accepted_at, is_active, anonymized_at, last_login_at, created_at
) OVERRIDING SYSTEM VALUE VALUES
-- Trabajadores
(1,  'Marta',  'Soler Ferrer',   'marta.soler@santuario.test',    crypt('MartaSoler26#!',    gen_salt('bf', 10)), '600111001', 'admin',
     TRUE,  FALSE, TRUE,  'per_update',     pg_temp.ago_ts('3 years'),  TRUE,  NULL, pg_temp.ago_ts('0 days', '08:05'), pg_temp.ago_ts('3 years')),
(2,  'Javier', 'Ortega Ruiz',    'javier.ortega@santuario.test',  crypt('JavierOrtega26#!',  gen_salt('bf', 10)), '600111002', 'admin',
     TRUE,  FALSE, TRUE,  'per_update',     pg_temp.ago_ts('2 years'),  TRUE,  NULL, pg_temp.ago_ts('2 days', '09:12'), pg_temp.ago_ts('2 years')),
(3,  'Nuria',  'Peris Gil',      'nuria.peris@santuario.test',    crypt('NuriaPeris26#!',    gen_salt('bf', 10)), '600111003', 'caretaker',
     TRUE,  FALSE, TRUE,  'per_update',     pg_temp.ago_ts('3 years'),  TRUE,  NULL, pg_temp.ago_ts('0 days', '07:45'), pg_temp.ago_ts('3 years')),
(4,  'Andrés', 'Climent Mas',    'andres.climent@santuario.test', crypt('AndresCliment26#!', gen_salt('bf', 10)), '600111004', 'caretaker',
     TRUE,  FALSE, TRUE,  'per_update',     pg_temp.ago_ts('18 months'), TRUE, NULL, pg_temp.ago_ts('1 day', '07:50'),  pg_temp.ago_ts('18 months')),
(5,  'Carmen', 'Boix Vidal',     'carmen.boix@santuario.test',    crypt('CarmenBoix26#!',    gen_salt('bf', 10)), '600111005', 'caretaker',
     TRUE,  FALSE, TRUE,  'per_update',     pg_temp.ago_ts('8 months'), TRUE,  NULL, pg_temp.ago_ts('3 days', '15:20'), pg_temp.ago_ts('8 months')),
-- Adoptantes
(6,  'Lucía',  'Martínez Navarro', 'lucia.martinez@correo.test',  crypt('Lucia.buitres1',    gen_salt('bf', 10)), '611222006', 'adopter',
     TRUE,  TRUE,  TRUE,  'per_update',     pg_temp.ago_ts('15 months'), TRUE, NULL, pg_temp.ago_ts('1 day', '21:30'),  pg_temp.ago_ts('15 months')),
(7,  'Pablo',  'García Esteve',  'pablo.garcia@correo.test',      crypt('Pablo2024!',        gen_salt('bf', 10)), NULL,        'adopter',
     TRUE,  FALSE, TRUE,  'per_update',     pg_temp.ago_ts('9 months'), TRUE,  NULL, pg_temp.ago_ts('4 days', '18:02'), pg_temp.ago_ts('9 months')),
(8,  'Elena',  'Rubio Sanz',     'elena.rubio@correo.test',       crypt('elenita_88',        gen_salt('bf', 10)), '611222008', 'adopter',
     TRUE,  TRUE,  TRUE,  'monthly_digest', pg_temp.ago_ts('5 months'), TRUE,  NULL, pg_temp.ago_ts('6 days', '12:40'), pg_temp.ago_ts('5 months')),
(9,  'Sergio', 'Llorens Puig',   'sergio.llorens@correo.test',    crypt('Sergio#Vuela7',     gen_salt('bf', 10)), NULL,        'adopter',
     TRUE,  FALSE, TRUE,  'per_update',     pg_temp.ago_ts('6 months'), TRUE,  NULL, pg_temp.ago_ts('5 days', '20:15'), pg_temp.ago_ts('6 months')),
(10, 'Irene',  'Domínguez Prats', 'irene.dominguez@correo.test',  crypt('Irene2025ok',       gen_salt('bf', 10)), '611222010', 'adopter',
     TRUE,  TRUE,  TRUE,  'per_update',     pg_temp.ago_ts('12 months'), TRUE, NULL, pg_temp.ago_ts('2 days', '11:05'), pg_temp.ago_ts('12 months')),
(11, 'Héctor', 'Benet Ramos',    'hector.benet@correo.test',      crypt('Hector1234',        gen_salt('bf', 10)), NULL,        'adopter',
     TRUE,  FALSE, FALSE, 'per_update',     pg_temp.ago_ts('45 days'),  TRUE,  NULL, pg_temp.ago_ts('9 days', '17:30'), pg_temp.ago_ts('45 days')),
(12, 'Raquel', 'Font Escrivà',   'raquel.font@correo.test',       crypt('RaquelFont!',       gen_salt('bf', 10)), '611222012', 'adopter',
     TRUE,  TRUE,  TRUE,  'per_update',     pg_temp.ago_ts('10 months'), TRUE, NULL, pg_temp.ago_ts('8 days', '19:00'), pg_temp.ago_ts('10 months')),
(13, 'Adrián', 'Moreno Lara',    'adrian.moreno@correo.test',     crypt('Adrian_99',         gen_salt('bf', 10)), NULL,        'adopter',
     FALSE, FALSE, TRUE,  'per_update',     pg_temp.ago_ts('1 day'),    TRUE,  NULL, NULL,                              pg_temp.ago_ts('1 day')),
(14, 'Teresa', 'Vicent Molina',  'teresa.vicent@correo.test',     crypt('Teresa*55',         gen_salt('bf', 10)), '611222014', 'adopter',
     TRUE,  FALSE, TRUE,  'per_update',     pg_temp.ago_ts('14 months'), FALSE, NULL, pg_temp.ago_ts('2 months'),        pg_temp.ago_ts('14 months')),
-- Usuario que pidió la baja: datos personales anonimizados, contraseña inservible.
(15, 'Usuario', 'eliminado',     'deleted-15@anonymized.invalid', crypt(gen_random_uuid()::TEXT, gen_salt('bf', 10)), NULL, 'adopter',
     FALSE, FALSE, FALSE, 'per_update',     pg_temp.ago_ts('8 months'), FALSE, pg_temp.ago_ts('4 months'), NULL,  pg_temp.ago_ts('8 months'));

-- -----------------------------------------------------------------------------
-- 2. Especies (solo buitres por ahora)
-- -----------------------------------------------------------------------------
INSERT INTO species (id, name, scientific_name, description) OVERRIDING SYSTEM VALUE VALUES
(1, 'Buitre leonado', 'Gyps fulvus',
    'El buitre más común de la península ibérica. Plumaje pardo claro, cabeza y cuello cubiertos de un plumón blanquecino y gorguera clara. Vive en colonias y se alimenta de carroña.'),
(2, 'Buitre negro', 'Aegypius monachus',
    'La rapaz más grande de Europa, con hasta tres metros de envergadura. Plumaje pardo oscuro casi negro. Anida en árboles y es más solitario que el leonado.'),
(3, 'Alimoche común', 'Neophron percnopterus',
    'El buitre más pequeño de la península. Plumaje blanco con plumas de vuelo negras y cara amarilla sin plumas. Es migrador: pasa el invierno en África.'),
(4, 'Quebrantahuesos', 'Gypaetus barbatus',
    'Buitre de montaña que se alimenta sobre todo de huesos, que deja caer sobre las rocas para romperlos. Especie en peligro de extinción con programas de reintroducción.');

-- -----------------------------------------------------------------------------
-- 3. Animales
-- -----------------------------------------------------------------------------
-- La foto de portada se asigna después de insertar las fotos.
INSERT INTO animals (
    id, name, species_id, breed, sex, approx_birth_date, arrival_date,
    rescue_story, temperament, special_needs, health_summary,
    status, status_changed_at, is_adoptable, is_published, show_in_memorial, created_at
) OVERRIDING SYSTEM VALUE VALUES
(1, 'Rufo', 1, NULL, 'male', pg_temp.ago('12 years'), pg_temp.ago('5 years 3 months'),
    'Llegó tras electrocutarse en un tendido eléctrico. Perdió parte del ala derecha y no puede volver a volar, así que vive en el santuario de forma permanente.',
    'Tranquilo y observador. Es el primero en acercarse cuando llega la comida.',
    'Posaderos bajos y rampas, porque no puede volar.',
    'Rufo está bien de salud. Su ala amputada está totalmente cicatrizada y mantiene un peso estable.',
    'in_sanctuary', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('5 years 3 months')),
(2, 'Greta', 1, NULL, 'female', pg_temp.ago('9 years'), pg_temp.ago('3 years 8 months'),
    'Fue encontrada junto a otros buitres en un episodio de envenenamiento por cebos ilegales. Sobrevivió, pero le quedaron secuelas en la vista.',
    'Desconfiada con las personas, pero muy sociable con el resto de buitres.',
    'Ve mal del ojo izquierdo; se le ofrece la comida siempre por el lado derecho.',
    'Greta está estable. Tiene una visión reducida en el ojo izquierdo que no le causa dolor.',
    'in_sanctuary', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('3 years 8 months')),
(3, 'Turia', 1, NULL, 'unknown', pg_temp.ago('4 years'), pg_temp.ago('4 years'),
    'Cayó del nido siendo un pollo y fue criada por personas antes de llegar al santuario. Está improntada: no sabría sobrevivir en libertad.',
    'Curiosa y confiada. Le encanta observar a los visitantes.',
    NULL,
    'Turia está sana y en un peso correcto.',
    'in_sanctuary', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('4 years')),
(4, 'Olmo', 1, NULL, 'male', pg_temp.ago('7 years'), pg_temp.ago('6 months'),
    'Chocó contra un aerogenerador y sufrió una fractura en el ala izquierda. Está en rehabilitación.',
    'Algo nervioso todavía, pero cada semana está más tranquilo.',
    'Sesiones de fisioterapia del ala tres veces por semana.',
    'Olmo se recupera de una fractura de ala. Está en tratamiento y evoluciona bien.',
    'in_treatment', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('6 months')),
(5, 'Brisa', 1, NULL, 'female', pg_temp.ago('6 years'), pg_temp.ago('2 years 2 months'),
    'Rescatada con una infección grave en una pata por un alambre de espino. Perdió dos dedos y no puede posarse bien en las rocas.',
    'Independiente y tranquila.',
    'Posaderos acolchados.',
    'Brisa está bien. La pata operada no le duele, aunque se apoya menos en ella.',
    'in_sanctuary', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('2 years 2 months')),
(6, 'Canelo', 1, NULL, 'unknown', pg_temp.ago('3 years'), pg_temp.ago('1 year 5 months'),
    'Apareció muy débil y desnutrido en su primer invierno. Se recuperó, pero una lesión en el hombro le impide volar largas distancias.',
    'Juguetón; mueve todo lo que encuentra en su recinto.',
    NULL,
    'Canelo está sano y ha recuperado un peso normal.',
    'in_sanctuary', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('1 year 5 months')),
(7, 'Nieve', 1, NULL, 'female', pg_temp.ago('25 years'), pg_temp.ago('6 years'),
    'Vivió muchos años en un centro de fauna que cerró. Es la buitre más veterana del santuario.',
    'Serena y muy tolerante con los demás.',
    'Artrosis: necesita comida troceada y revisiones frecuentes.',
    'Nieve es mayor y tiene artrosis. Toma un antiinflamatorio suave y está tranquila y cómoda.',
    'in_sanctuary', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('6 years')),
(8, 'Sombra', 2, NULL, 'male', pg_temp.ago('10 years'), pg_temp.ago('3 years'),
    'Recibió un disparo que le dañó el ala. Aunque se curó, no recuperó la capacidad de vuelo.',
    'Imponente pero tranquilo. Prefiere estar en las zonas altas del recinto.',
    'Recinto amplio con posaderos a varias alturas, accesibles por rampas.',
    'Sombra está sano. Su ala no le permite volar, pero no le causa molestias.',
    'in_sanctuary', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('3 years')),
(9, 'Ébano', 2, NULL, 'female', pg_temp.ago('8 years'), pg_temp.ago('1 year 1 month'),
    'Sufrió una intoxicación por plomo al comer restos de animales cazados. El tratamiento le salvó la vida, pero le dejó secuelas de equilibrio.',
    'Tímida al principio; ahora busca la compañía de Sombra.',
    'Controles de plomo en sangre cada seis meses.',
    'Ébano está estable. Los niveles de plomo son normales y su equilibrio mejora poco a poco.',
    'in_sanctuary', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('1 year 1 month')),
(10, 'Carbón', 2, NULL, 'unknown', pg_temp.ago('5 years'), pg_temp.ago('3 months'),
    'Encontrado con una infección respiratoria grave. Está respondiendo bien al tratamiento.',
    'Todavía reservado; se está adaptando al santuario.',
    'Tratamiento con nebulizaciones diarias.',
    'Carbón tiene una infección respiratoria y está en tratamiento. Respira cada vez mejor.',
    'in_treatment', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('3 months')),
(11, 'Lupe', 3, NULL, 'female', pg_temp.ago('6 years'), pg_temp.ago('2 years 6 months'),
    'Quedó atrapada en una red de un vallado. Tiene una lesión permanente en el ala que le impide migrar a África.',
    'Activa y muy curiosa. Es la más rápida a la hora de comer.',
    'En invierno necesita una zona resguardada y caldeada.',
    'Lupe está sana. Su ala lesionada no le duele, pero no le permite migrar.',
    'in_sanctuary', NULL, TRUE, TRUE, FALSE, pg_temp.ago_ts('2 years 6 months')),
(12, 'Faro', 3, NULL, 'male', pg_temp.ago('18 years'), pg_temp.ago('4 years'),
    'Llegó tras una colisión con un tendido eléctrico. Vivió cuatro años en el santuario.',
    'Sociable y muy querido por los cuidadores.',
    NULL,
    'Faro falleció por causas relacionadas con su edad.',
    'deceased', pg_temp.ago('20 days'), FALSE, TRUE, TRUE, pg_temp.ago_ts('4 years')),
(13, 'Barbas', 4, NULL, 'male', pg_temp.ago('3 years'), pg_temp.ago('2 years'),
    'Llegó con un ala lesionada. Tras recuperarse, fue trasladado a un programa de reintroducción de quebrantahuesos.',
    'Muy activo.',
    NULL,
    'Barbas se recuperó por completo antes de su traslado.',
    'transferred', pg_temp.ago('2 months'), FALSE, TRUE, FALSE, pg_temp.ago_ts('2 years')),
(14, 'Pipa', 1, NULL, 'unknown', pg_temp.ago('1 year'), pg_temp.ago('10 days'),
    'Acaba de llegar con signos de agotamiento. Está en cuarentena y en observación.',
    NULL,
    'Cuarentena: sin contacto con otros buitres.',
    NULL,
    'in_treatment', NULL, FALSE, FALSE, FALSE, pg_temp.ago_ts('10 days')),
(15, 'Roca', 1, NULL, 'male', pg_temp.ago('5 years'), pg_temp.ago('8 months'),
    'Llegó con deshidratación tras una ola de calor. Se ha recuperado tan bien que se prepara para volver a la naturaleza.',
    'Desconfiado con las personas, como debe ser antes de una liberación.',
    'Contacto humano mínimo para facilitar su liberación.',
    'Roca está completamente recuperado.',
    'in_sanctuary', NULL, FALSE, TRUE, FALSE, pg_temp.ago_ts('8 months'));

-- -----------------------------------------------------------------------------
-- 4. Actualizaciones
-- -----------------------------------------------------------------------------
-- Casos para el aviso de 14 días del escritorio:
--   - Turia (3): última actualización hace 16 días -> alerta en rojo.
--   - Ébano (9): última actualización hace 12 días -> aviso (quedan 2 días).
INSERT INTO animal_updates (id, animal_id, author_id, title, body, visibility, published_at) OVERRIDING SYSTEM VALUE VALUES
(1,  1,  3, 'Rufo estrena posadero',
     'Hemos instalado un posadero nuevo a media altura con una rampa de madera. Rufo lo probó en cuanto lo vio y ya es su sitio favorito para tomar el sol.',
     'public',   pg_temp.ago_ts('30 days', '11:00')),
(2,  1,  3, 'Revisión del ala: todo en orden',
     'En la revisión de este mes, la veterinaria ha confirmado que el muñón del ala está en perfecto estado. Rufo mantiene su peso y come con muchas ganas.',
     'adopters', pg_temp.ago_ts('3 days', '12:30')),
(3,  8,  4, 'Sombra y el nuevo enriquecimiento',
     'Esta semana hemos escondido trozos de comida entre ramas. Sombra tardó un poco, pero acabó encontrándolos todos.',
     'adopters', pg_temp.ago_ts('17 days', '10:15')),
(4,  8,  4, 'Sombra recibe visita',
     'Un grupo de escolares visitó el santuario y Sombra fue el gran protagonista. Se quedó posado en lo alto, mirando a todo el mundo con mucha calma.',
     'public',   pg_temp.ago_ts('6 days', '13:00')),
(5,  2,  5, 'Greta, cada vez más confiada',
     'Greta ya se acerca a la zona de comida aunque haya un cuidador cerca. Es un gran paso para ella.',
     'adopters', pg_temp.ago_ts('15 days', '09:45')),
(6,  2,  5, 'Greta y su baño de sol',
     'Con el buen tiempo, Greta pasa las mañanas con las alas abiertas al sol. Os dejamos una foto de este momento.',
     'adopters', pg_temp.ago_ts('1 day', '10:30')),
(7,  11, 3, 'Lupe y el frío',
     'Ya hemos preparado la zona caldeada de Lupe para el invierno. Le ha gustado tanto que pasa allí las tardes.',
     'public',   pg_temp.ago_ts('5 days', '16:00')),
(8,  4,  4, 'Olmo sigue con la fisioterapia',
     'Olmo ya extiende el ala casi por completo durante los ejercicios. En el vídeo podéis ver una de las sesiones.',
     'adopters', pg_temp.ago_ts('10 days', '11:20')),
(9,  4,  4, 'Primeras semanas de Olmo',
     'Olmo empieza a acostumbrarse a su recinto. Come bien y está más tranquilo cuando entramos.',
     'adopters', pg_temp.ago_ts('24 days', '12:00')),
(10, 7,  5, 'Nieve, la veterana',
     'Nieve ha empezado un tratamiento nuevo para la artrosis y ya se la ve moverse con más soltura por el recinto.',
     'adopters', pg_temp.ago_ts('8 days', '10:00')),
(11, 3,  3, 'Turia y los visitantes',
     'Turia se ha convertido en la anfitriona del santuario: siempre se acerca a la valla cuando llega gente nueva.',
     'adopters', pg_temp.ago_ts('16 days', '17:10')),
(12, 3,  3, 'Cuatro años de Turia',
     'Turia cumple cuatro años en el santuario. Llegó siendo un pollo y hoy es una buitre adulta y sana.',
     'public',   pg_temp.ago_ts('35 days', '10:00')),
(13, 9,  4, 'Ébano mejora su equilibrio',
     'Los últimos análisis de Ébano han salido bien y ya se mantiene en los posaderos altos sin ayuda.',
     'adopters', pg_temp.ago_ts('12 days', '09:30')),
(14, 10, 5, 'Carbón respira mejor',
     'Tras unas semanas de nebulizaciones, Carbón respira mucho mejor y ha empezado a explorar todo su recinto.',
     'adopters', pg_temp.ago_ts('4 days', '11:45')),
(15, 12, 3, 'Faro, más cansado',
     'Faro está más cansado estos días. La veterinaria lo está vigilando de cerca y le hemos preparado un rincón tranquilo.',
     'adopters', pg_temp.ago_ts('25 days', '10:00')),
(16, 12, 1, 'Despedimos a Faro',
     'Con mucha tristeza os comunicamos que Faro nos ha dejado. Se fue tranquilo, acompañado por quienes lo cuidaron durante cuatro años. Gracias por haberle acompañado también vosotros.',
     'adopters', pg_temp.ago_ts('20 days', '18:00')),
(17, 5,  5, 'Brisa estrena posaderos acolchados',
     'Hemos forrado los posaderos de Brisa para que su pata operada esté más cómoda. Ya no los suelta.',
     'public',   pg_temp.ago_ts('9 days', '12:00')),
(18, 6,  4, 'Canelo, el más juguetón',
     'Canelo ha descubierto que puede mover las ramas de su recinto y se pasa el día reorganizándolo.',
     'public',   pg_temp.ago_ts('40 days', '10:30')),
(19, 15, 3, 'Roca se prepara para volar',
     'Roca ya hace vuelos largos en el recinto de entrenamiento. Si todo va bien, pronto volverá a la naturaleza.',
     'public',   pg_temp.ago_ts('7 days', '10:00')),
(20, 13, 2, 'Barbas se traslada',
     'Barbas se ha recuperado por completo y se incorpora a un programa de reintroducción de quebrantahuesos. ¡Buen viaje, Barbas!',
     'public',   pg_temp.ago_ts('2 months', '12:00'));

-- -----------------------------------------------------------------------------
-- 5. Fotos y vídeos
-- -----------------------------------------------------------------------------
-- Las rutas son de ejemplo: la carpeta uploads/ no contiene estos archivos.
-- La foto con el mismo id que el animal (1 a 15) es su portada.
INSERT INTO photos (id, animal_id, update_id, media_type, url, thumbnail_url, alt_text, sort_order, visibility, uploaded_by) OVERRIDING SYSTEM VALUE VALUES
(1,  1,  NULL, 'image', '/uploads/animals/1/cover.jpg',  '/uploads/animals/1/thumb_cover.jpg',  'Rufo, buitre leonado, posado en una rampa de madera',             0, 'public', 3),
(2,  2,  NULL, 'image', '/uploads/animals/2/cover.jpg',  '/uploads/animals/2/thumb_cover.jpg',  'Greta, buitre leonado, de perfil sobre una roca',                 0, 'public', 5),
(3,  3,  NULL, 'image', '/uploads/animals/3/cover.jpg',  '/uploads/animals/3/thumb_cover.jpg',  'Turia, buitre leonado, mirando a la cámara junto a la valla',     0, 'public', 3),
(4,  4,  NULL, 'image', '/uploads/animals/4/cover.jpg',  '/uploads/animals/4/thumb_cover.jpg',  'Olmo, buitre leonado, en su recinto de recuperación',            0, 'public', 4),
(5,  5,  NULL, 'image', '/uploads/animals/5/cover.jpg',  '/uploads/animals/5/thumb_cover.jpg',  'Brisa, buitre leonado, sobre un posadero acolchado',              0, 'public', 5),
(6,  6,  NULL, 'image', '/uploads/animals/6/cover.jpg',  '/uploads/animals/6/thumb_cover.jpg',  'Canelo, buitre leonado joven, picoteando una rama',               0, 'public', 4),
(7,  7,  NULL, 'image', '/uploads/animals/7/cover.jpg',  '/uploads/animals/7/thumb_cover.jpg',  'Nieve, buitre leonado veterana, descansando al sol',              0, 'public', 5),
(8,  8,  NULL, 'image', '/uploads/animals/8/cover.jpg',  '/uploads/animals/8/thumb_cover.jpg',  'Sombra, buitre negro, posado en lo alto del recinto',             0, 'public', 4),
(9,  9,  NULL, 'image', '/uploads/animals/9/cover.jpg',  '/uploads/animals/9/thumb_cover.jpg',  'Ébano, buitre negro, con las alas recogidas',                     0, 'public', 4),
(10, 10, NULL, 'image', '/uploads/animals/10/cover.jpg', '/uploads/animals/10/thumb_cover.jpg', 'Carbón, buitre negro, en la zona de tratamiento',                0, 'public', 5),
(11, 11, NULL, 'image', '/uploads/animals/11/cover.jpg', '/uploads/animals/11/thumb_cover.jpg', 'Lupe, alimoche de plumaje blanco y cara amarilla',               0, 'public', 3),
(12, 12, NULL, 'image', '/uploads/animals/12/cover.jpg', '/uploads/animals/12/thumb_cover.jpg', 'Faro, alimoche, posado sobre un tronco',                          0, 'public', 3),
(13, 13, NULL, 'image', '/uploads/animals/13/cover.jpg', '/uploads/animals/13/thumb_cover.jpg', 'Barbas, quebrantahuesos, con las alas abiertas',                  0, 'public', 2),
(14, 14, NULL, 'image', '/uploads/animals/14/cover.jpg', '/uploads/animals/14/thumb_cover.jpg', 'Pipa, buitre leonado joven, en la zona de cuarentena',            0, 'public', 3),
(15, 15, NULL, 'image', '/uploads/animals/15/cover.jpg', '/uploads/animals/15/thumb_cover.jpg', 'Roca, buitre leonado, en el recinto de entrenamiento de vuelo',  0, 'public', 3),
-- Fotos adicionales de galería
(16, 1,  NULL, 'image', '/uploads/animals/1/02.jpg',     '/uploads/animals/1/thumb_02.jpg',     'Rufo comiendo junto a otros buitres',                             1, 'public',   3),
(17, 1,  NULL, 'image', '/uploads/animals/1/03.jpg',     '/uploads/animals/1/thumb_03.jpg',     'Primer plano de la cabeza de Rufo',                               2, 'adopters', 3),
(18, 2,  NULL, 'image', '/uploads/animals/2/02.jpg',     '/uploads/animals/2/thumb_02.jpg',     'Greta junto a otros buitres leonados',                            1, 'public',   5),
-- Fotos y vídeos de actualizaciones (solo adoptantes)
(19, 1,  2,    'image', '/uploads/animals/1/update_2.jpg', '/uploads/animals/1/thumb_update_2.jpg', 'La veterinaria revisa el ala de Rufo',                      3, 'adopters', 3),
(20, 2,  6,    'image', '/uploads/animals/2/update_6.jpg', '/uploads/animals/2/thumb_update_6.jpg', 'Greta con las alas abiertas tomando el sol',                2, 'adopters', 5),
(21, 4,  8,    'video', '/uploads/animals/4/update_8.mp4', '/uploads/animals/4/thumb_update_8.jpg', 'Vídeo de una sesión de fisioterapia del ala de Olmo',       1, 'adopters', 4);

UPDATE animals SET cover_photo_id = id;

-- -----------------------------------------------------------------------------
-- 6. Planes de adopción
-- -----------------------------------------------------------------------------
INSERT INTO adoption_plans (id, name, monthly_amount, description, is_default, is_active, sort_order) OVERRIDING SYSTEM VALUE VALUES
(1, 'Simbólica',      1.00,  'Para quien quiere colaborar con lo mínimo.',                 FALSE, TRUE, 1),
(2, 'Usual',          5.00,  'La opción más habitual.',                                    TRUE,  TRUE, 2),
(3, 'Extraordinaria', 12.00, 'Para quien quiere cubrir una parte mayor de los cuidados.', FALSE, TRUE, 3);

-- -----------------------------------------------------------------------------
-- 7. Adopciones
-- -----------------------------------------------------------------------------
-- Para las activas, next_billing_date = start_date + (meses ya pagados) meses.
-- Las cuotas se generan en el apartado 8 a partir de estas fechas.
INSERT INTO adoptions (
    id, user_id, animal_id, plan_id, next_plan_id, status,
    start_date, end_date, next_billing_date, cancel_requested_at, end_reason,
    created_by, notes, created_at
) OVERRIDING SYSTEM VALUE VALUES
-- Activas
(1,  6,  1,  2, NULL, 'active',
     pg_temp.ago('14 months 5 days'), NULL, pg_temp.ago('14 months 5 days') + INTERVAL '15 months', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('14 months 5 days', '19:00')),
(2,  6,  8,  3, NULL, 'active',
     pg_temp.ago('6 months 12 days'), NULL, pg_temp.ago('6 months 12 days') + INTERVAL '7 months', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('6 months 12 days', '20:10')),
(4,  7,  1,  1, NULL, 'active',
     pg_temp.ago('3 months 2 days'), NULL, pg_temp.ago('3 months 2 days') + INTERVAL '4 months', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('3 months 2 days', '18:30')),
-- Cambio de plan programado: pasa de Usual a Extraordinaria en la próxima cuota.
(5,  7,  2,  2, 3,    'active',
     pg_temp.ago('8 months 20 days'), NULL, pg_temp.ago('8 months 20 days') + INTERVAL '9 months', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('8 months 20 days', '17:45')),
(6,  8,  2,  1, NULL, 'active',
     pg_temp.ago('2 months 7 days'), NULL, pg_temp.ago('2 months 7 days') + INTERVAL '3 months', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('2 months 7 days', '12:00')),
(8,  9,  4,  2, NULL, 'active',
     pg_temp.ago('5 months 1 day'), NULL, pg_temp.ago('5 months 1 day') + INTERVAL '6 months', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('5 months 1 day', '21:00')),
(10, 10, 3,  2, NULL, 'active',
     pg_temp.ago('11 months 4 days'), NULL, pg_temp.ago('11 months 4 days') + INTERVAL '12 months', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('11 months 4 days', '10:20')),
-- Creada a mano por un admin: pago en efectivo en una jornada de puertas abiertas.
(14, 12, 9,  3, NULL, 'active',
     pg_temp.ago('1 month 3 days'), NULL, pg_temp.ago('1 month 3 days') + INTERVAL '2 months', NULL, NULL,
     1, 'Alta en la jornada de puertas abiertas; primera cuota pagada en efectivo.', pg_temp.ago_ts('1 month 3 days', '12:15')),
(18, 6,  10, 1, NULL, 'active',
     pg_temp.ago('20 days'), NULL, pg_temp.ago('20 days') + INTERVAL '1 month', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('20 days', '22:05')),
(19, 9,  8,  2, NULL, 'active',
     pg_temp.ago('3 months 9 days'), NULL, pg_temp.ago('3 months 9 days') + INTERVAL '4 months', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('3 months 9 days', '19:40')),
-- Baja solicitada: sigue activa hasta end_date (fin del último mes pagado) y no
-- se vuelve a cobrar (next_billing_date vacío). Después pasará a finished.
(9,  9,  7,  3, NULL, 'active',
     pg_temp.ago('1 month 10 days'), pg_temp.ago('1 month 10 days') + INTERVAL '2 months' - INTERVAL '1 day', NULL,
     pg_temp.ago_ts('5 days', '20:00'), NULL,
     NULL, NULL, pg_temp.ago_ts('1 month 10 days', '20:30')),
-- Pausada: la última cuota falló; next_billing_date es la cuota pendiente de reintento.
(7,  8,  11, 2, NULL, 'paused',
     pg_temp.ago('4 months 15 days'), NULL, pg_temp.ago('4 months 15 days') + INTERVAL '4 months', NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('4 months 15 days', '13:10')),
-- Pendientes de pago
(11, 10, 5,  2, NULL, 'pending',
     NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('2 days', '11:00')),     -- reciente: el adoptante puede reintentar
(12, 11, 6,  2, NULL, 'pending',
     NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, pg_temp.ago_ts('9 days', '17:35')),     -- más de 7 días: la tarea diaria debe cancelarla
-- Cerradas
(3,  6,  12, 2, NULL, 'finished',
     pg_temp.ago('10 months 3 days'), pg_temp.ago('20 days'), NULL, NULL, 'animal_deceased',
     NULL, NULL, pg_temp.ago_ts('10 months 3 days', '18:00')),
(13, 11, 3,  1, NULL, 'cancelled',
     NULL, pg_temp.ago('33 days'), NULL, NULL, 'payment_not_completed',
     NULL, NULL, pg_temp.ago_ts('40 days', '16:00')),
(15, 12, 1,  2, NULL, 'finished',
     pg_temp.ago('9 months'), pg_temp.ago('3 months 1 day'), NULL, pg_temp.ago_ts('3 months 10 days', '09:00'), 'user_cancelled',
     NULL, NULL, pg_temp.ago_ts('9 months', '19:30')),
(16, 14, 13, 2, NULL, 'finished',
     pg_temp.ago('13 months 5 days'), pg_temp.ago('2 months'), NULL, NULL, 'animal_transferred',
     NULL, NULL, pg_temp.ago_ts('13 months', '10:00')),
(17, 15, 2,  1, NULL, 'finished',
     pg_temp.ago('7 months'), pg_temp.ago('7 months') + INTERVAL '3 months' - INTERVAL '1 day', NULL, NULL, 'account_deleted',
     NULL, NULL, pg_temp.ago_ts('7 months', '15:00')),
(20, 7,  7,  2, NULL, 'cancelled',
     pg_temp.ago('6 months 2 days'), pg_temp.ago('6 months 2 days') + INTERVAL '1 month' - INTERVAL '1 day', NULL, NULL, 'admin_cancelled',
     2, 'Adopción duplicada por error; se devuelve la cuota.', pg_temp.ago_ts('6 months 2 days', '18:40'));

-- -----------------------------------------------------------------------------
-- 8. Pagos (cuotas mensuales)
-- -----------------------------------------------------------------------------
-- 8.1 Cuotas cobradas, generadas mes a mes desde start_date hasta:
--     - next_billing_date (adopciones activas y pausadas), o
--     - end_date (adopciones cerradas o con baja solicitada).
INSERT INTO payments (adoption_id, amount, period_start, period_end, method, status, payment_reference, paid_at, recorded_by)
SELECT
    a.id,
    p.monthly_amount,
    s.period_start,
    (s.period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    CASE WHEN a.id = 14 AND s.n = 0 THEN 'cash' ELSE 'simulated' END,
    'completed',
    CASE WHEN a.id = 14 AND s.n = 0 THEN 'CASH-' ELSE 'SIM-' END
        || 'A' || LPAD(a.id::TEXT, 4, '0') || '-' || TO_CHAR(s.period_start, 'YYYYMMDD'),
    s.period_start + TIME '10:15',
    CASE WHEN a.id = 14 AND s.n = 0 THEN 1 END
FROM adoptions a
JOIN adoption_plans p ON p.id = a.plan_id
CROSS JOIN LATERAL (
    SELECT n, (a.start_date + make_interval(months => n))::DATE AS period_start
    FROM generate_series(0, 240) AS n
) s
WHERE a.start_date IS NOT NULL
  AND s.period_start < COALESCE(a.next_billing_date, a.end_date + 1)
ORDER BY a.id, s.period_start;

-- 8.2 Adopción 20 (cancelada por el admin): su única cuota se devolvió.
UPDATE payments
SET status = 'refunded',
    refunded_at = paid_at + INTERVAL '3 days'
WHERE adoption_id = 20;

-- 8.3 Cuotas fallidas
INSERT INTO payments (adoption_id, amount, period_start, period_end, method, status, payment_reference, failure_reason, created_at) VALUES
-- Adopción 7 (pausada): falló la cuota del mes actual.
(7,  5.00, pg_temp.ago('4 months 15 days') + INTERVAL '4 months',
           (pg_temp.ago('4 months 15 days') + INTERVAL '5 months' - INTERVAL '1 day')::DATE,
     'simulated', 'failed', 'SIM-A0007-' || TO_CHAR(pg_temp.ago('4 months 15 days') + INTERVAL '4 months', 'YYYYMMDD') || '-F1',
     'Pago rechazado (simulado)', (pg_temp.ago('4 months 15 days') + INTERVAL '4 months')::DATE + TIME '03:00'),
-- Adopción 11 (pendiente reciente): el primer intento de pago falló.
(11, 5.00, pg_temp.ago('2 days'), (pg_temp.ago('2 days') + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
     'simulated', 'failed', 'SIM-A0011-' || TO_CHAR(pg_temp.ago('2 days'), 'YYYYMMDD') || '-F1',
     'Pago rechazado (simulado)', pg_temp.ago_ts('2 days', '11:02')),
-- Adopción 13 (cancelada): el pago nunca se completó.
(13, 1.00, pg_temp.ago('40 days'), (pg_temp.ago('40 days') + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
     'simulated', 'failed', 'SIM-A0013-' || TO_CHAR(pg_temp.ago('40 days'), 'YYYYMMDD') || '-F1',
     'Pago rechazado (simulado)', pg_temp.ago_ts('40 days', '16:01'));

-- La adopción 12 (pendiente antigua) no tiene ningún intento de pago:
-- el adoptante abandonó la pasarela.

-- -----------------------------------------------------------------------------
-- 9. Donaciones
-- -----------------------------------------------------------------------------
INSERT INTO donations (
    id, user_id, donor_name, donor_email, amount, is_anonymous, message,
    method, status, payment_reference, failure_reason, paid_at, refunded_at, recorded_by, created_at
) OVERRIDING SYSTEM VALUE VALUES
(1,  6,    'Lucía Martínez Navarro', 'lucia.martinez@correo.test', 20.00,  FALSE, '¡Para la comida de este invierno!',
     'simulated',     'completed', 'SIM-D0001', NULL, pg_temp.ago_ts('5 months', '21:00'), NULL, NULL, pg_temp.ago_ts('5 months', '21:00')),
(2,  NULL, NULL,                     NULL,                         50.00,  TRUE,  NULL,
     'simulated',     'completed', 'SIM-D0002', NULL, pg_temp.ago_ts('4 months 10 days', '10:30'), NULL, NULL, pg_temp.ago_ts('4 months 10 days', '10:30')),
(3,  NULL, 'Familia Roig',           'familia.roig@correo.test',   15.00,  FALSE, 'Gracias por cuidar de ellos.',
     'simulated',     'completed', 'SIM-D0003', NULL, pg_temp.ago_ts('3 months 3 days', '18:20'), NULL, NULL, pg_temp.ago_ts('3 months 3 days', '18:20')),
(4,  NULL, 'Jordi',                  NULL,                          3.50,  FALSE, 'Poquito, pero con cariño.',
     'simulated',     'completed', 'SIM-D0004', NULL, pg_temp.ago_ts('2 months 15 days', '12:00'), NULL, NULL, pg_temp.ago_ts('2 months 15 days', '12:00')),
(5,  7,    'Pablo García Esteve',    'pablo.garcia@correo.test',  100.00,  TRUE,  NULL,
     'simulated',     'completed', 'SIM-D0005', NULL, pg_temp.ago_ts('2 months', '20:45'), NULL, NULL, pg_temp.ago_ts('2 months', '20:45')),
(6,  NULL, 'Visitantes de la jornada de puertas abiertas', NULL,   87.40,  FALSE, 'Recaudado en la hucha de la jornada de puertas abiertas.',
     'cash',          'completed', 'CASH-D0006', NULL, pg_temp.ago_ts('1 month 3 days', '19:00'), NULL, 1, pg_temp.ago_ts('1 month 3 days', '19:00')),
(7,  NULL, 'Asociación Amigos de las Rapaces', 'contacto@amigosrapaces.test', 250.00, FALSE, 'Aportación anual de la asociación.',
     'bank_transfer', 'completed', 'TRF-D0007', NULL, pg_temp.ago_ts('25 days', '09:00'), NULL, 2, pg_temp.ago_ts('24 days', '10:00')),
(8,  NULL, 'Marcos',                 'marcos.donante@correo.test', 10.00,  FALSE, NULL,
     'simulated',     'failed',    'SIM-D0008', 'Pago rechazado (simulado)', NULL, NULL, NULL, pg_temp.ago_ts('15 days', '22:10')),
(9,  9,    'Sergio Llorens Puig',    'sergio.llorens@correo.test', 30.00,  FALSE, NULL,
     'simulated',     'refunded',  'SIM-D0009', NULL, pg_temp.ago_ts('12 days', '14:00'), pg_temp.ago_ts('11 days', '09:30'), NULL, pg_temp.ago_ts('12 days', '14:00')),
(10, 10,   'Irene Domínguez Prats',  'irene.dominguez@correo.test', 5.00,  FALSE, NULL,
     'simulated',     'pending',   'SIM-D0010', NULL, NULL, NULL, NULL, NOW()),
(11, NULL, NULL,                     NULL,                          0.50,  TRUE,  'Sin mínimo: ¡cada céntimo cuenta!',
     'simulated',     'completed', 'SIM-D0011', NULL, pg_temp.ago_ts('3 days', '08:30'), NULL, NULL, pg_temp.ago_ts('3 days', '08:30')),
(12, 6,    'Lucía Martínez Navarro', 'lucia.martinez@correo.test', 10.00,  FALSE, 'Por Faro.',
     'simulated',     'completed', 'SIM-D0012', NULL, pg_temp.ago_ts('19 days', '21:15'), NULL, NULL, pg_temp.ago_ts('19 days', '21:15'));

-- -----------------------------------------------------------------------------
-- 10. Lecturas del muro de actualizaciones
-- -----------------------------------------------------------------------------
INSERT INTO update_reads (user_id, update_id, read_at) VALUES
(6, 1,  pg_temp.ago_ts('29 days', '21:00')),
(6, 2,  pg_temp.ago_ts('2 days', '21:30')),
(6, 3,  pg_temp.ago_ts('16 days', '20:00')),
(6, 4,  pg_temp.ago_ts('5 days', '22:00')),
(6, 15, pg_temp.ago_ts('24 days', '20:00')),
(6, 16, pg_temp.ago_ts('20 days', '21:00')),
(7, 1,  pg_temp.ago_ts('28 days', '18:00')),
(7, 5,  pg_temp.ago_ts('14 days', '18:00')),
(8, 5,  pg_temp.ago_ts('10 days', '12:00')),
(9, 9,  pg_temp.ago_ts('20 days', '21:00')),
(10, 12, pg_temp.ago_ts('33 days', '10:00'));

-- -----------------------------------------------------------------------------
-- 11. Notificaciones (campana)
-- -----------------------------------------------------------------------------
INSERT INTO notifications (user_id, type, message, link, is_read, created_at) VALUES
(6,  'new_update',         'Nueva actualización de Rufo: «Revisión del ala: todo en orden».',       '/my-animals/1',  TRUE,  pg_temp.ago_ts('3 days', '12:30')),
(6,  'new_update',         'Nueva actualización de Carbón: «Carbón respira mejor».',                '/my-animals/10', FALSE, pg_temp.ago_ts('4 days', '11:45')),
(6,  'adoption_closed',    'Faro nos ha dejado. Tu adopción se ha cerrado; puedes continuar con otro animal si lo deseas.', '/animals', TRUE, pg_temp.ago_ts('20 days', '18:05')),
(6,  'adoption_welcome',   '¡Bienvenida! Ya has adoptado a Carbón.',                                '/my-animals/10', TRUE,  pg_temp.ago_ts('20 days', '22:06')),
(6,  'donation_thanks',    'Gracias por tu donación de 10,00 €.',                                   '/my-contributions', TRUE, pg_temp.ago_ts('19 days', '21:16')),
(7,  'new_update',         'Nueva actualización de Greta: «Greta y su baño de sol».',               '/my-animals/2',  FALSE, pg_temp.ago_ts('1 day', '10:30')),
(7,  'plan_changed',       'Tu adopción de Greta pasará al plan Extraordinaria (12 €/mes) en la próxima cuota.', '/my-animals/2', TRUE, pg_temp.ago_ts('6 days', '18:00')),
(8,  'payment_failed',     'No hemos podido cobrar la cuota de tu adopción de Lupe. La adopción está pausada hasta que se regularice el pago.', '/my-animals/11', FALSE, pg_temp.ago_ts('15 days', '03:05')),
(8,  'new_update',         'Nueva actualización de Greta: «Greta y su baño de sol».',               '/my-animals/2',  FALSE, pg_temp.ago_ts('1 day', '10:30')),
(9,  'adoption_cancelled', 'Hemos recibido tu baja de la adopción de Nieve. Seguirá activa hasta el final del mes pagado.', '/my-animals/7', TRUE, pg_temp.ago_ts('5 days', '20:01')),
(9,  'new_update',         'Nueva actualización de Sombra: «Sombra recibe visita».',               '/my-animals/8',  FALSE, pg_temp.ago_ts('6 days', '13:00')),
(10, 'payment_failed',     'El pago de tu adopción de Brisa no se ha completado. Puedes reintentarlo desde «Mis animales».', '/my-animals', FALSE, pg_temp.ago_ts('2 days', '11:03')),
(12, 'adoption_welcome',   '¡Bienvenida! Ya has adoptado a Ébano.',                                 '/my-animals/9',  TRUE,  pg_temp.ago_ts('1 month 3 days', '12:20')),
(3,  'update_reminder',    'Turia lleva más de 14 días sin actualización.',                         '/admin/animals/3', FALSE, pg_temp.ago_ts('2 days', '07:00'));

-- -----------------------------------------------------------------------------
-- 12. [FASE 3] Historial veterinario
-- -----------------------------------------------------------------------------
INSERT INTO vet_records (animal_id, record_date, type, description, weight_kg, veterinarian, created_by) VALUES
(1,  pg_temp.ago('3 days'),           'checkup',   'Revisión mensual. Muñón del ala bien cicatrizado.',                    8.40,  'Dra. Paula Sendra', 3),
(1,  pg_temp.ago('4 months'),         'checkup',   'Revisión rutinaria sin incidencias.',                                  8.30,  'Dra. Paula Sendra', 3),
(2,  pg_temp.ago('2 months'),         'checkup',   'Control oftalmológico: visión del ojo izquierdo estable.',             7.90,  'Dra. Paula Sendra', 5),
(4,  pg_temp.ago('6 months'),         'surgery',   'Fijación de la fractura del ala izquierda.',                           9.10,  'Dr. Víctor Albiol', 4),
(4,  pg_temp.ago('10 days'),          'treatment', 'Sesión de fisioterapia. Buena extensión del ala.',                     9.60,  'Dr. Víctor Albiol', 4),
(7,  pg_temp.ago('8 days'),           'treatment', 'Inicio de antiinflamatorio para la artrosis.',                         7.20,  'Dra. Paula Sendra', 5),
(8,  pg_temp.ago('5 months'),         'vaccine',   'Vacunación anual.',                                                    11.80, 'Dr. Víctor Albiol', 4),
(9,  pg_temp.ago('12 days'),          'checkup',   'Análisis de plomo en sangre dentro de valores normales.',              9.30,  'Dr. Víctor Albiol', 4),
(10, pg_temp.ago('3 months'),         'treatment', 'Inicio de nebulizaciones por infección respiratoria.',                 8.80,  'Dra. Paula Sendra', 5),
(10, pg_temp.ago('4 days'),           'checkup',   'Mejoría clara de la función respiratoria.',                            9.40,  'Dra. Paula Sendra', 5),
(11, pg_temp.ago('1 month'),          'checkup',   'Revisión previa al invierno. Sin incidencias.',                        2.10,  'Dra. Paula Sendra', 3),
(12, pg_temp.ago('25 days'),          'checkup',   'Decaimiento general asociado a la edad. Seguimiento diario.',          1.80,  'Dra. Paula Sendra', 3),
(14, pg_temp.ago('10 days'),          'checkup',   'Ingreso: agotamiento y deshidratación leve. Cuarentena.',              6.20,  'Dr. Víctor Albiol', 3);

-- -----------------------------------------------------------------------------
-- 13. [FASE 3] Registro de actividad (algunos ejemplos)
-- -----------------------------------------------------------------------------
INSERT INTO activity_logs (user_id, action, table_name, record_id, details, created_at) VALUES
(3,    'create',  'animals',        14, '{"name": "Pipa"}',                                             pg_temp.ago_ts('10 days', '09:00')),
(1,    'update',  'animals',        12, '{"status": ["in_sanctuary", "deceased"]}',                    pg_temp.ago_ts('20 days', '17:50')),
(2,    'update',  'animals',        13, '{"status": ["in_sanctuary", "transferred"]}',                 pg_temp.ago_ts('2 months', '11:50')),
(1,    'create',  'adoptions',      14, '{"manual": true, "method": "cash"}',                           pg_temp.ago_ts('1 month 3 days', '12:15')),
(2,    'update',  'adoptions',      20, '{"status": ["active", "cancelled"], "refund": true}',          pg_temp.ago_ts('5 months 26 days', '10:00')),
(2,    'create',  'donations',       7, '{"method": "bank_transfer"}',                                  pg_temp.ago_ts('24 days', '10:00')),
(NULL, 'update',  'adoptions',       7, '{"status": ["active", "paused"], "reason": "payment_failed"}', pg_temp.ago_ts('15 days', '03:00')),
(1,    'update',  'users',          14, '{"is_active": [true, false]}',                                 pg_temp.ago_ts('2 months', '10:00'));

-- -----------------------------------------------------------------------------
-- 14. Ajustar los contadores de id tras insertar ids explícitos
-- -----------------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('users', 'id'),          (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('species', 'id'),        (SELECT MAX(id) FROM species));
SELECT setval(pg_get_serial_sequence('animals', 'id'),        (SELECT MAX(id) FROM animals));
SELECT setval(pg_get_serial_sequence('animal_updates', 'id'), (SELECT MAX(id) FROM animal_updates));
SELECT setval(pg_get_serial_sequence('photos', 'id'),         (SELECT MAX(id) FROM photos));
SELECT setval(pg_get_serial_sequence('adoption_plans', 'id'), (SELECT MAX(id) FROM adoption_plans));
SELECT setval(pg_get_serial_sequence('adoptions', 'id'),      (SELECT MAX(id) FROM adoptions));
SELECT setval(pg_get_serial_sequence('donations', 'id'),      (SELECT MAX(id) FROM donations));

COMMIT;