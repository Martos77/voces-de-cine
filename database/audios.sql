-- =====================================================================
-- AUDIOS
-- Fragmentos de voz de cada personaje: en versión original y doblada
-- al castellano. Los archivos .mp3 están en public/audio/; aquí solo
-- se guarda su nombre.
-- =====================================================================

CREATE TABLE IF NOT EXISTS audios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  personaje_id  INT          NOT NULL,
  version       VARCHAR(30)  NOT NULL,          -- 'original' o 'castellano'
  archivo       VARCHAR(200) NOT NULL,          -- nombre del .mp3 en public/audio/
  CHECK (version IN ('original', 'castellano')),
  UNIQUE KEY (personaje_id, version),           -- un fragmento por personaje y versión
  -- Si se borra el personaje, se borran sus audios
  FOREIGN KEY (personaje_id) REFERENCES personajes(id) ON DELETE CASCADE
);