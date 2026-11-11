// =====================================================================
// MODELO: RELACIÓN DE LOS USUARIOS CON LAS PELÍCULAS
// =====================================================================
// Tabla "usuarios_peliculas": una fila por usuario y película con
// vista, favorita, pendiente y valoración (de 1 a 5, o null).
// =====================================================================

const db = require('../config/db');

// Estado de una película con la que el usuario aún no ha hecho nada
const ESTADO_VACIO = { vista: false, favorita: false, pendiente: false, valoracion: null };

/**
 * Estado de una película para un usuario. Si no hay fila, el estado vacío.
 */
async function obtenerEstado(usuarioId, peliculaId) {
  const [filas] = await db.query(
    `SELECT vista, favorita, pendiente, valoracion
       FROM usuarios_peliculas
      WHERE usuario_id = ? AND pelicula_id = ?`,
    [usuarioId, peliculaId]
  );
  if (filas.length === 0) return { ...ESTADO_VACIO };

  // MySQL devuelve los BOOLEAN como 0 y 1: los convertimos en true/false
  const f = filas[0];
  return { vista: !!f.vista, favorita: !!f.favorita, pendiente: !!f.pendiente, valoracion: f.valoracion };
}

/**
 * Guarda el estado completo de una película para un usuario.
 * - Si la fila no existe, la crea (INSERT).
 * - Si ya existe, la actualiza (ON DUPLICATE KEY UPDATE): la clave
 *   primaria (usuario_id, pelicula_id) evita filas repetidas.
 * - Si el estado queda vacío (nada marcado ni valorado), borra la fila
 *   para no guardar datos que no sirven.
 */
async function guardarEstado(usuarioId, peliculaId, estado) {
  const { vista, favorita, pendiente, valoracion } = estado;

  if (!vista && !favorita && !pendiente && valoracion === null) {
    await db.query(
      'DELETE FROM usuarios_peliculas WHERE usuario_id = ? AND pelicula_id = ?',
      [usuarioId, peliculaId]
    );
    return;
  }

  await db.query(
    `INSERT INTO usuarios_peliculas (usuario_id, pelicula_id, vista, favorita, pendiente, valoracion)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       vista = VALUES(vista), favorita = VALUES(favorita),
       pendiente = VALUES(pendiente), valoracion = VALUES(valoracion)`,
    [usuarioId, peliculaId, vista, favorita, pendiente, valoracion]
  );
}

/**
 * Todas las películas con las que el usuario ha hecho algo, con su
 * estado y los datos para mostrar la tarjeta, de la más reciente a la
 * más antigua. El perfil las reparte después en sus listas.
 */
async function listar(usuarioId) {
  const [filas] = await db.query(
    `SELECT p.id, p.titulo, p.anio, p.poster_path,
            up.vista, up.favorita, up.pendiente, up.valoracion
       FROM usuarios_peliculas up
       JOIN peliculas p ON p.id = up.pelicula_id
      WHERE up.usuario_id = ?
      ORDER BY up.actualizado_en DESC`,
    [usuarioId]
  );
  return filas.map((f) => ({ ...f, vista: !!f.vista, favorita: !!f.favorita, pendiente: !!f.pendiente }));
}

module.exports = { obtenerEstado, guardarEstado, listar };