// =====================================================================
// RUTA DE CONEXIONES (el grafo)
// =====================================================================
//   GET /api/conexiones?tipo=voz&id=12       → grafo alrededor de una voz
//   GET /api/conexiones?tipo=pelicula&id=3   → ... de una película
//   GET /api/conexiones?tipo=actor&id=7      → ... de un actor original
//   GET /api/conexiones/buscar?texto=pumba   → voces, actores, películas y personajes
// =====================================================================

const express = require('express');
const conexionesModel = require('../models/conexionesModel');

const router = express.Router();

// Buscador: GET /api/conexiones/buscar?texto=pumba
router.get('/buscar', async (req, res, next) => {
  try {
    const texto = typeof req.query.texto === 'string' ? req.query.texto.trim().slice(0, 100) : '';
    if (texto.length < 2) return res.json([]);   // con una letra saldría de todo
    res.json(await conexionesModel.buscar(texto));
  } catch (error) {
    next(error);
  }
});

// Grafo: GET /api/conexiones?tipo=voz&id=12
router.get('/', async (req, res, next) => {
  try {
    const { tipo } = req.query;
    const id = Number(req.query.id);

    // Solo se aceptan los tres tipos conocidos y un id entero positivo
    if (!conexionesModel.TIPOS.includes(tipo) || !Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Indica un tipo (voz, pelicula o actor) y un id válidos.' });
    }

    const grafo = await conexionesModel.obtener(tipo, id);
    if (!grafo) {
      return res.status(404).json({ error: 'No hay datos de doblaje para mostrar sus conexiones.' });
    }
    res.json(grafo);
  } catch (error) {
    next(error);
  }
});

module.exports = router;