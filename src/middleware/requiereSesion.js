// =====================================================================
// REQUIERE SESIÓN
// =====================================================================
// "Middleware": una función que se ejecuta ANTES de una ruta. Si nadie
// ha iniciado sesión, corta la petición con un error 401; si hay
// sesión, deja pasar a la ruta con next().
// Se usará en las rutas de favoritos, valoraciones y perfil.
// =====================================================================

function requiereSesion(req, res, next) {
  if (!req.session.usuarioId) {
    return res.status(401).json({ error: 'Tienes que iniciar sesión.' });
  }
  next();
}

module.exports = requiereSesion;