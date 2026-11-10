// =====================================================================
// RUTAS DE PELÍCULAS   ·   /api/peliculas
// =====================================================================
//   GET /api/peliculas                         → listado de películas
//   GET /api/peliculas/:id                     → ficha de una película
//   GET /api/peliculas/:id/voces-compartidas   → películas con voces en común
//
// Las rutas solo reciben la petición, llaman al modelo y responden.
// Las consultas SQL están en el modelo.
// =====================================================================

const express = require('express');
const peliculasModel = require('../models/peliculasModel');
const { entero, decimal, texto } = require('../utils/parametros');

// Un Router es un "mini servidor" con sus propias rutas, que luego
// conectamos al servidor principal en server.js
const router = express.Router();

// Listado de películas con búsqueda, filtros y paginación.
// Ejemplo: /api/peliculas?texto=toy&genero=16&orden=valoracion&pagina=2
router.get('/', async (req, res, next) => {
  try {
    // req.query contiene los parámetros de la dirección (lo que va tras el ?)
    const q = req.query;
    const resultado = await peliculasModel.buscar({
      texto: texto(q.texto),
      genero: entero(q.genero),
      anioDesde: entero(q.anioDesde),
      anioHasta: entero(q.anioHasta),
      duracionMax: entero(q.duracionMax),
      valoracionMin: decimal(q.valoracionMin),
      director: texto(q.director),
      actor: texto(q.actor),
      soloDoblaje: q.soloDoblaje === '1',
      orden: texto(q.orden),
      pagina: entero(q.pagina),
    });
    // { peliculas: [...], total, pagina, totalPaginas }
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

// Ficha de una película. ":id" es un parámetro: en /api/peliculas/3,
// req.params.id vale "3"
router.get('/:id', async (req, res, next) => {
  try {
    // Todo lo que llega en la URL es texto: lo convertimos a número
    const id = Number(req.params.id);

    // Si no es un número entero positivo (por ejemplo "abc"), no existe
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(404).json({ error: 'No existe ninguna película con ese identificador.' });
    }

    const pelicula = await peliculasModel.obtenerPorId(id);
    if (!pelicula) {
      return res.status(404).json({ error: 'No existe ninguna película con ese identificador.' });
    }

    res.json(pelicula);
  } catch (error) {
    next(error);
  }
});

// Películas con voces de doblaje en común con la indicada
router.get('/:id/voces-compartidas', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(404).json({ error: 'No existe ninguna película con ese identificador.' });
    }

    const peliculas = await peliculasModel.vocesCompartidas(id);
    res.json(peliculas);
  } catch (error) {
    next(error);
  }
});

module.exports = router;