// =====================================================================
// RUTAS DE AUTENTICACIÓN: /api/auth/...
// =====================================================================
//   POST /api/auth/registro → crear una cuenta (e iniciar sesión)
//   POST /api/auth/login    → iniciar sesión
//   POST /api/auth/logout   → cerrar sesión
//   GET  /api/auth/yo       → ¿quién ha iniciado sesión? (o null)
// =====================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const usuariosModel = require('../models/usuariosModel');

const router = express.Router();

// "Coste" del cifrado: cuanto más alto, más lento es calcular el hash
// (y más difícil probar contraseñas a ciegas). 10 es el valor habitual.
const COSTE_BCRYPT = 10;

const MIN_CONTRASENA = 8;
const MAX_NOMBRE = 50;

// Comprobación sencilla del formato del correo: algo@algo.algo
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Comprueba los datos de registro. Devuelve un mensaje de error o null.
 */
function validarRegistro({ nombre, email, contrasena }) {
  if (!nombre) return 'Escribe tu nombre.';
  if (nombre.length > MAX_NOMBRE) return `El nombre no puede tener más de ${MAX_NOMBRE} caracteres.`;
  if (!FORMATO_EMAIL.test(email)) return 'Escribe un correo electrónico válido.';
  if (contrasena.length < MIN_CONTRASENA) return `La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`;
  return null;
}

/**
 * Inicia la sesión de un usuario. Primero "regenera" la sesión (le da
 * un identificador nuevo): así, si alguien hubiera conseguido el
 * identificador anterior, no le serviría (ataque de fijación de sesión).
 */
function iniciarSesion(req, usuarioId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.usuarioId = usuarioId;
      resolve();
    });
  });
}

// POST /api/auth/registro  { nombre, email, contrasena }
router.post('/registro', async (req, res, next) => {
  try {
    // String(... ?? '') convierte a texto aunque llegue vacío o raro;
    // trim() quita espacios; el correo se guarda en minúsculas.
    const nombre = String(req.body.nombre ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const contrasena = String(req.body.contrasena ?? '');

    const error = validarRegistro({ nombre, email, contrasena });
    if (error) return res.status(400).json({ error });

    // Ciframos la contraseña: en la base de datos solo se guarda el hash
    const contrasenaHash = await bcrypt.hash(contrasena, COSTE_BCRYPT);

    let id;
    try {
      id = await usuariosModel.crear({ nombre, email, contrasenaHash });
    } catch (e) {
      // El correo ya existe (UNIQUE): error 409 "conflicto"
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
      }
      throw e;
    }

    await iniciarSesion(req, id);
    res.status(201).json(await usuariosModel.obtenerPorId(id));
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login  { email, contrasena }
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const contrasena = String(req.body.contrasena ?? '');

    const usuario = await usuariosModel.buscarPorEmail(email);

    // bcrypt.compare cifra lo escrito y lo compara con el hash guardado.
    // El mensaje es el mismo si falla el correo o la contraseña, para
    // no dar pistas sobre qué correos están registrados.
    const correcta = usuario && await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!correcta) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    await iniciarSesion(req, usuario.id);
    res.json(await usuariosModel.obtenerPorId(usuario.id));
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res, next) => {
  // destroy() borra la sesión de la base de datos; clearCookie() borra
  // la cookie del navegador
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('voces.sid');
    res.status(204).end();   // 204: todo bien, sin contenido
  });
});

// GET /api/auth/yo → el usuario que ha iniciado sesión, o null
router.get('/yo', async (req, res, next) => {
  try {
    if (!req.session.usuarioId) return res.json(null);
    res.json(await usuariosModel.obtenerPorId(req.session.usuarioId));
  } catch (error) {
    next(error);
  }
});

module.exports = router;