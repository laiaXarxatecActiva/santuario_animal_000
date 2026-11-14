-- Solo para Docker Compose: el contenedor de PostgreSQL ejecuta este archivo
-- la primera vez que arranca. La base de datos de desarrollo (sanctuary) ya la
-- crea la imagen con POSTGRES_DB; aquí se añade la de pruebas.
CREATE DATABASE sanctuary_test OWNER sanctuary;
