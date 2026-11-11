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
// =====================================================================

const express = require('express');
const requiereSesion = require('../middleware/requiereSesion');
const { entero } = require('../utils/parametros');
const usuariosPeliculasModel = require('../models/usuariosPeliculasModel');
const usuariosVocesModel = require('../models/usuariosVocesModel');

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

module.exports = router;