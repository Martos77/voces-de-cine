// =====================================================================
// RUTAS DEL USUARIO: /api/usuario/...
// =====================================================================
// Todas exigen haber iniciado sesión (requiereSesion): el usuario es
// siempre el de la sesión (req.session.usuarioId), nunca uno que llegue
// en la petición. Así nadie puede cambiar los datos de otro usuario.
//
//   GET /api/usuario/peliculas/:id → estado de la película para el usuario
//   PUT /api/usuario/peliculas/:id → cambiar vista, favorita, pendiente
//                                    o valoración (solo lo que se envíe)
//   GET    /api/usuario/voces/:id  → ¿es una voz favorita? { favorita }
//   PUT    /api/usuario/voces/:id  → añadirla a las favoritas
//   DELETE /api/usuario/voces/:id  → quitarla de las favoritas
//   GET    /api/usuario/perfil     → datos, películas y voces del usuario
//   PUT    /api/usuario/datos      → cambiar nombre, correo o contraseña
//   DELETE /api/usuario/cuenta     → eliminar la cuenta y todos sus datos
//   GET    /api/usuario/recomendaciones → películas recomendadas con su motivo
// =====================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const requiereSesion = require('../middleware/requiereSesion');
const { entero } = require('../utils/parametros');
const usuariosPeliculasModel = require('../models/usuariosPeliculasModel');
const usuariosVocesModel = require('../models/usuariosVocesModel');
const recomendacionesModel = require('../models/recomendacionesModel');

const usuariosModel = require('../models/usuariosModel');
const { COSTE_BCRYPT } = require('./auth');
const { validarNombre, validarEmail, validarContrasena, leerTexto } = require('../utils/validacion');

const router = express.Router();

// Todas las rutas de este archivo pasan antes por requiereSesion
router.use(requiereSesion);

/**
 * Lee el id de la dirección (/peliculas/:id o /voces/:id). Si no es
 * válido, responde con un error 400 y devuelve null.
 */
function leerId(req, res) {
  const id = entero(req.params.id);
  if (!id) res.status(400).json({ error: 'El identificador no es válido.' });
  return id;
}

// GET /api/usuario/peliculas/:id
router.get('/peliculas/:id', async (req, res, next) => {
  try {
    const peliculaId = leerId(req, res);
    if (!peliculaId) return;
    res.json(await usuariosPeliculasModel.obtenerEstado(req.session.usuarioId, peliculaId));
  } catch (error) {
    next(error);
  }
});

// PUT /api/usuario/peliculas/:id  { vista?, favorita?, pendiente?, valoracion? }
router.put('/peliculas/:id', async (req, res, next) => {
  try {
    const peliculaId = leerId(req, res);
    if (!peliculaId) return;

    const usuarioId = req.session.usuarioId;
    const cambios = req.body;

    // Partimos del estado actual y aplicamos solo lo que se ha enviado
    const estado = await usuariosPeliculasModel.obtenerEstado(usuarioId, peliculaId);

    for (const campo of ['vista', 'favorita', 'pendiente']) {
      if (campo in cambios) {
        if (typeof cambios[campo] !== 'boolean') {
          return res.status(400).json({ error: `El campo "${campo}" debe ser true o false.` });
        }
        estado[campo] = cambios[campo];
      }
    }

    if ('valoracion' in cambios) {
      const v = cambios.valoracion;
      // null = quitar la valoración; si no, un número entero de 1 a 5
      if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 5)) {
        return res.status(400).json({ error: 'La valoración debe ser un número del 1 al 5.' });
      }
      estado.valoracion = v;
    }

    // Reglas para que el estado sea coherente:
    // - Si se valora una película, es que se ha visto.
    // - Si se marca como vista (o se valora), deja de estar pendiente.
    if (cambios.valoracion) estado.vista = true;
    if (cambios.vista === true || cambios.valoracion) estado.pendiente = false;

    try {
      await usuariosPeliculasModel.guardarEstado(usuarioId, peliculaId, estado);
    } catch (e) {
      // La película no existe (falla la clave foránea)
      if (e.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(404).json({ error: 'Esa película no existe.' });
      }
      throw e;
    }

    res.json(estado);
  } catch (error) {
    next(error);
  }
});

// --- Voces favoritas ------------------------------------------------------

// GET /api/usuario/voces/:id
router.get('/voces/:id', async (req, res, next) => {
  try {
    const actorId = leerId(req, res);
    if (!actorId) return;
    res.json({ favorita: await usuariosVocesModel.esFavorita(req.session.usuarioId, actorId) });
  } catch (error) {
    next(error);
  }
});

// PUT /api/usuario/voces/:id
router.put('/voces/:id', async (req, res, next) => {
  try {
    const actorId = leerId(req, res);
    if (!actorId) return;
    try {
      await usuariosVocesModel.anadir(req.session.usuarioId, actorId);
    } catch (e) {
      // El profesional no existe (falla la clave foránea)
      if (e.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(404).json({ error: 'Ese profesional del doblaje no existe.' });
      }
      throw e;
    }
    res.json({ favorita: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/usuario/voces/:id
router.delete('/voces/:id', async (req, res, next) => {
  try {
    const actorId = leerId(req, res);
    if (!actorId) return;
    await usuariosVocesModel.quitar(req.session.usuarioId, actorId);
    res.json({ favorita: false });
  } catch (error) {
    next(error);
  }
});

// --- Recomendaciones ----------------------------------------------------

// GET /api/usuario/recomendaciones
router.get('/recomendaciones', async (req, res, next) => {
  try {
    res.json(await recomendacionesModel.obtener(req.session.usuarioId));
  } catch (error) {
    next(error);
  }
});

// --- Perfil -------------------------------------------------------------

// GET /api/usuario/perfil
router.get('/perfil', async (req, res, next) =>  {
  try {
    const usuarioId = req.session.usuarioId;
    // Promise.all lanza las tres consultas a la vez y espera a todas
    const [usuario, peliculas, voces] = await Promise.all([
      usuariosModel.obtenerPorId(usuarioId),
      usuariosPeliculasModel.listar(usuarioId),
      usuariosVocesModel.listar(usuarioId),
    ]);
    res.json({ usuario, peliculas, voces });
  } catch (error) {
    next(error);
  }
});

/**
 * Comprueba la contraseña actual del usuario de la sesión.
 * Se pide antes de cambiar datos o eliminar la cuenta: así, si alguien
 * encuentra la sesión abierta en otro ordenador, no puede hacerlo.
 */
async function contrasenaCorrecta(usuarioId, contrasena) {
  const hash = await usuariosModel.obtenerHash(usuarioId);
  return hash !== null && bcrypt.compare(contrasena, hash);
}

// PUT /api/usuario/datos  { nombre, email, contrasenaActual, contrasenaNueva? }
router.put('/datos', async (req, res, next) => {
  try {
    const usuarioId = req.session.usuarioId;
    const nombre = leerTexto(req.body, 'nombre');
    const email = leerTexto(req.body, 'email').toLowerCase();
    const contrasenaNueva = String(req.body.contrasenaNueva ?? '');

    // Si la contraseña nueva está vacía, no se cambia
    const error = validarNombre(nombre) || validarEmail(email)
      || (contrasenaNueva && validarContrasena(contrasenaNueva));
    if (error) return res.status(400).json({ error });

    if (!await contrasenaCorrecta(usuarioId, String(req.body.contrasenaActual ?? ''))) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }

    const contrasenaHash = contrasenaNueva ? await bcrypt.hash(contrasenaNueva, COSTE_BCRYPT) : null;
    try {
      await usuariosModel.actualizar(usuarioId, { nombre, email, contrasenaHash });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Ya existe otra cuenta con ese correo.' });
      }
      throw e;
    }

    res.json(await usuariosModel.obtenerPorId(usuarioId));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/usuario/cuenta  { contrasena }
router.delete('/cuenta', async (req, res, next) => {
  try {
    const usuarioId = req.session.usuarioId;
    if (!await contrasenaCorrecta(usuarioId, String(req.body.contrasena ?? ''))) {
      return res.status(401).json({ error: 'La contraseña no es correcta.' });
    }

    // Se borra el usuario (y, en cascada, todos sus datos) y la sesión
    await usuariosModel.eliminar(usuarioId);
    req.session.destroy(() => {
      res.clearCookie('voces.sid');
      res.status(204).end();
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;