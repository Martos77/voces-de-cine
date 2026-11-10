// =====================================================================
// RUTAS DE TMDB   ·   /api/tmdb
// =====================================================================
// Permiten encontrar y añadir películas que aún no están en el catálogo:
//   GET  /api/tmdb/buscar?texto=...     → busca en TMDB por título
//   POST /api/tmdb/importar/:tmdbId     → añade una película al catálogo
// =====================================================================

const express = require('express');
const tmdb = require('../services/tmdb');
const { guardarPelicula } = require('../services/importacion');
const peliculasModel = require('../models/peliculasModel');
const { entero, texto } = require('../utils/parametros');

const router = express.Router();

// Máximo de resultados de TMDB que devolvemos
const MAX_RESULTADOS = 12;

// Busca películas en TMDB por título. Cada resultado indica si ya está
// en nuestro catálogo: "id" es su id en nuestra base de datos, o null.
router.get('/buscar', async (req, res, next) => {
  try {
    const consulta = texto(req.query.texto);
    if (!consulta) return res.json([]);

    const resultados = (await tmdb.buscarPeliculas(consulta)).slice(0, MAX_RESULTADOS);

    // ¿Cuáles de estas películas tenemos ya?
    const enCatalogo = await peliculasModel.buscarPorTmdbIds(resultados.map((r) => r.tmdbId));

    res.json(resultados.map((r) => ({ ...r, id: enCatalogo.get(r.tmdbId) ?? null })));
  } catch (error) {
    next(error);
  }
});

// Añade una película de TMDB al catálogo y devuelve su id en nuestra
// base de datos. Si ya estaba, no la descarga otra vez: devuelve su id.
// Es POST (y no GET) porque modifica datos: guarda una película nueva.
router.post('/importar/:tmdbId', async (req, res, next) => {
  try {
    const tmdbId = entero(req.params.tmdbId);
    if (!tmdbId) {
      return res.status(400).json({ error: 'El identificador de TMDB no es válido.' });
    }

    const enCatalogo = await peliculasModel.buscarPorTmdbIds([tmdbId]);
    // Si ya la tenemos, usamos su id; si no, la descargamos y guardamos
    const id = enCatalogo.get(tmdbId) ?? await guardarPelicula(tmdbId);

    res.json({ id });
  } catch (error) {
    // Si TMDB no conoce ese id, responde con un error 404
    if (String(error.message).includes('404')) {
      return res.status(404).json({ error: 'No existe ninguna película con ese identificador en TMDB.' });
    }
    next(error);
  }
});

module.exports = router;