// =====================================================================
// UTILIDADES PARA LEER LOS PARÁMETROS DE LAS PETICIONES
// =====================================================================
// Todo lo que llega en una dirección (?anio=1995) es texto. Estas
// funciones lo convierten al tipo correcto y descartan los valores no
// válidos, para que los modelos reciban siempre datos limpios.
// Si un valor no es válido, devuelven null, que significa "sin filtro".
// =====================================================================

/**
 * Número entero positivo. "1995" → 1995; "abc" o "-3" → null.
 */
function entero(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

/**
 * Número con decimales. "7.5" → 7.5; vacío o "abc" → null.
 */
function decimal(valor) {
  if (valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Texto sin espacios sobrantes y de 100 caracteres como máximo.
 * Si queda vacío, null.
 */
function texto(valor) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().slice(0, 100);
  return limpio || null;
}

module.exports = { entero, decimal, texto };