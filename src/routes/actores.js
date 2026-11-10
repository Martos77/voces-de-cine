// =====================================================================
// RUTAS DE ACTORES
// =====================================================================
//   GET /api/actores-doblaje/:id     → ficha de un actor/actriz de doblaje
//   GET /api/actores-originales/:id  → ficha de un actor original
// =====================================================================

const express = require('express');
const actoresDoblajeModel = require('../models/actoresDoblajeModel');
const actoresOriginalesModel = require('../models/actoresOriginalesModel');
const { texto } = require('../utils/parametros');

const router = express.Router();

/**
 * Convierte el id de la dirección en número.
 * Devuelve null si no es un entero positivo (por ejemplo, "abc").
 */
function leerId(texto) {
  const id = Number(texto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * GET /api/actores-doblaje?texto=...
 * Busca profesionales del doblaje por su nombre o por un personaje.
 * Sin texto, devuelve todos.
 */
router.get('/actores-doblaje', async (req, res, next) => {
  try {
    // texto() limpia el valor: quita espacios y devuelve null si está vacío
    const voces = await actoresDoblajeModel.buscar(texto(req.query.texto));
    res.json(voces);
  } catch (error) {
    next(error);
  }
});

// Ficha de un actor o actriz de doblaje
router.get('/actores-doblaje/:id', async (req, res, next) => {
  try {
    const id = leerId(req.params.id);
    const actor = id ? await actoresDoblajeModel.obtenerPorId(id) : null;
    if (!actor) {
      return res.status(404).json({ error: 'No existe ningún profesional del doblaje con ese identificador.' });
    }
    res.json(actor);
  } catch (error) {
    next(error);
  }
});

// Ficha de un actor original
router.get('/actores-originales/:id', async (req, res, next) => {
  try {
    const id = leerId(req.params.id);
    const actor = id ? await actoresOriginalesModel.obtenerPorId(id) : null;
    if (!actor) {
      return res.status(404).json({ error: 'No existe ningún actor original con ese identificador.' });
    }
    res.json(actor);
  } catch (error) {
    next(error);
  }
});

module.exports = router;