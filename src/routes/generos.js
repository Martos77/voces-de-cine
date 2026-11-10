// =====================================================================
// RUTAS DE GÉNEROS   ·   GET /api/generos
// =====================================================================

const express = require('express');
const generosModel = require('../models/generosModel');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await generosModel.listar());
  } catch (error) {
    next(error);
  }
});

module.exports = router;