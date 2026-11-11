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

module.exports = { crear, buscarPorEmail, obtenerPorId };