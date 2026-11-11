// =====================================================================
// SESIONES DE USUARIO
// =====================================================================
// Una sesión permite que el servidor "recuerde" quién ha iniciado sesión
// entre una petición y la siguiente:
//   1. Al iniciar sesión, el servidor guarda el id del usuario en la
//      sesión y envía al navegador una cookie con un identificador
//      aleatorio (no con los datos del usuario).
//   2. En cada petición siguiente, el navegador devuelve esa cookie y
//      el servidor recupera la sesión: req.session.usuarioId.
// Las sesiones se guardan en la base de datos (tabla "sessions", que se
// crea sola), para que no se pierdan si el servidor se reinicia.
// =====================================================================

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const db = require('./db');

// Duración de la sesión: 7 días (en milisegundos)
const DURACION = 7 * 24 * 60 * 60 * 1000;

// Sin clave secreta no se pueden firmar las cookies: mejor avisar claro
if (!process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET en el archivo .env');
}

// Almacén de sesiones en MySQL, usando la misma conexión que el resto
// de la aplicación (db)
const almacen = new MySQLStore({
  expiration: DURACION,          // las sesiones caducadas se borran solas
  createDatabaseTable: true,     // crea la tabla "sessions" si no existe
  endConnectionOnClose: false,   // la conexión es compartida: no cerrarla
}, db);

module.exports = session({
  name: 'voces.sid',             // nombre de la cookie
  secret: process.env.SESSION_SECRET, // firma la cookie para que no se pueda falsificar
  store: almacen,
  resave: false,                 // no volver a guardar la sesión si no ha cambiado
  saveUninitialized: false,      // no crear sesiones para quien no ha iniciado sesión
  cookie: {
    httpOnly: true,              // el JavaScript de la página no puede leer la cookie (protege frente a XSS)
    sameSite: 'lax',             // no se envía desde otras webs (protege frente a CSRF)
    secure: 'auto',              // solo por HTTPS cuando la web va por HTTPS (en alwaysdata)
    maxAge: DURACION,
  },
});