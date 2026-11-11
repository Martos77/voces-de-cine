// =====================================================================
// VALIDACIÓN DE LOS DATOS DE USUARIO
// =====================================================================
// Comprobaciones comunes al registro (auth.js) y a la edición del
// perfil (usuario.js). Cada función devuelve un mensaje de error o null.
// =====================================================================

const MIN_CONTRASENA = 8;
const MAX_NOMBRE = 50;

// Comprobación sencilla del formato del correo: algo@algo.algo
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarNombre(nombre) {
  if (!nombre) return 'Escribe tu nombre.';
  if (nombre.length > MAX_NOMBRE) return `El nombre no puede tener más de ${MAX_NOMBRE} caracteres.`;
  return null;
}

function validarEmail(email) {
  return FORMATO_EMAIL.test(email) ? null : 'Escribe un correo electrónico válido.';
}

function validarContrasena(contrasena) {
  return contrasena.length >= MIN_CONTRASENA
    ? null
    : `La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`;
}

/**
 * Lee del cuerpo de la petición un texto limpio: siempre una cadena,
 * sin espacios al principio ni al final.
 */
function leerTexto(cuerpo, campo) {
  return String(cuerpo[campo] ?? '').trim();
}

module.exports = { validarNombre, validarEmail, validarContrasena, leerTexto };