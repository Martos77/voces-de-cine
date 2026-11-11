// =====================================================================
// MODELO DE USUARIOS
// =====================================================================
// Consultas a la tabla "usuarios". Las contraseñas llegan aquí ya
// cifradas (el hash): este archivo nunca ve la contraseña original.
// =====================================================================

const db = require('../config/db');

/**
 * Crea un usuario y devuelve su id.
 * Si el correo ya existe, MySQL lanza un error ER_DUP_ENTRY (lo
 * controla la ruta), gracias al UNIQUE de la columna email.
 */
async function crear({ nombre, email, contrasenaHash }) {
  const [resultado] = await db.query(
    'INSERT INTO usuarios (nombre, email, contrasena_hash) VALUES (?, ?, ?)',
    [nombre, email, contrasenaHash]
  );
  return resultado.insertId;
}

/**
 * Busca un usuario por su correo, CON el hash de la contraseña
 * (solo se usa para comprobarla al iniciar sesión).
 * Devuelve el usuario o null si no existe.
 */
async function buscarPorEmail(email) {
  const [filas] = await db.query(
    'SELECT id, nombre, email, contrasena_hash FROM usuarios WHERE email = ?',
    [email]
  );
  return filas[0] ?? null;
}

/**
 * Datos públicos de un usuario (SIN la contraseña), o null si no existe.
 */
async function obtenerPorId(id) {
  const [filas] = await db.query(
    'SELECT id, nombre, email, creado_en FROM usuarios WHERE id = ?',
    [id]
  );
  return filas[0] ?? null;
}

/**
 * Hash de la contraseña de un usuario (para comprobarla antes de
 * cambiar sus datos o eliminar la cuenta), o null si no existe.
 */
async function obtenerHash(id) {
  const [filas] = await db.query('SELECT contrasena_hash FROM usuarios WHERE id = ?', [id]);
  return filas[0]?.contrasena_hash ?? null;
}

/**
 * Cambia el nombre y el correo y, si se indica, la contraseña.
 */
async function actualizar(id, { nombre, email, contrasenaHash }) {
  if (contrasenaHash) {
    await db.query(
      'UPDATE usuarios SET nombre = ?, email = ?, contrasena_hash = ? WHERE id = ?',
      [nombre, email, contrasenaHash, id]
    );
  } else {
    await db.query('UPDATE usuarios SET nombre = ?, email = ? WHERE id = ?', [nombre, email, id]);
  }
}

/**
 * Elimina un usuario. Gracias a ON DELETE CASCADE, la base de datos
 * borra también sus películas y voces favoritas.
 */
async function eliminar(id) {
  await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
}

module.exports = { crear, buscarPorEmail, obtenerPorId, obtenerHash, actualizar, eliminar };