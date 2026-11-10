-- =====================================================================
-- VOCES DE CINE · Creación de la base de datos
-- =====================================================================

-- Creamos la base de datos (utf8mb4 permite tildes, eñes y emojis)
CREATE DATABASE IF NOT EXISTS voces_de_cine
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE voces_de_cine;

-- Si las tablas ya existían, las borramos para empezar de cero.
-- Se borran en orden inverso: primero las que dependen de otras.

DROP TABLE IF EXISTS doblajes;
DROP TABLE IF EXISTS personajes;
DROP TABLE IF EXISTS peliculas_generos;
DROP TABLE IF EXISTS actores_doblaje;
DROP TABLE IF EXISTS actores_originales;
DROP TABLE IF EXISTS generos;
DROP TABLE IF EXISTS peliculas;

-- ---------------------------------------------------------------------
-- PELÍCULAS
-- ---------------------------------------------------------------------
CREATE TABLE peliculas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tmdb_id         INT NOT NULL UNIQUE,      -- su número en TMDB (no se puede repetir)
  titulo          VARCHAR(255) NOT NULL,     -- título en España
  titulo_original VARCHAR(255),
  sinopsis        TEXT,
  anio            SMALLINT,                  -- año de estreno
  duracion        SMALLINT,                  -- en minutos
  valoracion      DECIMAL(3,1),              -- nota media de TMDB, de 0 a 10
  popularidad     DECIMAL(10,3),             -- índice de TMDB, para ordenar
  director        VARCHAR(255),
  poster_path     VARCHAR(255),              -- ruta de la imagen del póster en TMDB
  fondo_path      VARCHAR(255)               -- ruta de la imagen de fondo en TMDB
);

-- ---------------------------------------------------------------------
-- GÉNEROS (usamos el mismo id que TMDB)
-- ---------------------------------------------------------------------

CREATE TABLE generos (
    id      INT PRIMARY KEY,
    nombre  VARCHAR(100) NOT NULL
);

-- Tabla intermedia: une películas con géneros
CREATE TABLE peliculas_generos (
    pelicula_id INT NOT NULL,
    genero_id INT NOT NULL,
    PRIMARY KEY (pelicula_id, genero_id), -- cada pareja solo una vez
    FOREIGN KEY (pelicula_id) REFERENCES peliculas(id) ON DELETE CASCADE,
    FOREIGN KEY (genero_id)   REFERENCES generos(id)   ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- ACTORES ORIGINALES (los de pantalla)
-- ---------------------------------------------------------------------
CREATE TABLE actores_originales (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tmdb_id     INT UNIQUE,                    -- puede quedar vacío si no está en TMDB
  nombre      VARCHAR(255) NOT NULL,
  foto_path   VARCHAR(255)
);

-- ---------------------------------------------------------------------
-- ACTORES Y ACTRICES DE DOBLAJE
-- ---------------------------------------------------------------------
CREATE TABLE actores_doblaje (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(255) NOT NULL UNIQUE,  -- no puede haber dos con el mismo nombre
  biografia   TEXT
);

-- ---------------------------------------------------------------------
-- PERSONAJES: une la película con el actor original
-- "orden" es su posición en el reparto (0 = protagonista)
-- ---------------------------------------------------------------------
CREATE TABLE personajes (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  pelicula_id        INT NOT NULL,
  nombre             VARCHAR(255) NOT NULL,
  actor_original_id  INT,
  orden              SMALLINT DEFAULT 999,
  FOREIGN KEY (pelicula_id)       REFERENCES peliculas(id)          ON DELETE CASCADE,
  FOREIGN KEY (actor_original_id) REFERENCES actores_originales(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- DOBLAJES: quién pone voz a cada personaje
-- "version" permitirá en el futuro añadir el doblaje latino, catalán...
-- "fuente" guarda de dónde sale el dato, para poder verificarlo
-- ---------------------------------------------------------------------
CREATE TABLE doblajes (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  personaje_id      INT NOT NULL,
  actor_doblaje_id  INT NOT NULL,
  version           VARCHAR(30) NOT NULL DEFAULT 'castellano',
  UNIQUE (personaje_id, version),           -- un personaje, una voz por versión
  FOREIGN KEY (personaje_id)     REFERENCES personajes(id)      ON DELETE CASCADE,
  FOREIGN KEY (actor_doblaje_id) REFERENCES actores_doblaje(id) ON DELETE CASCADE
);