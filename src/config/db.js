// =====================================================================
// CONEXIÓN CON LA BASE DE DATOS
// =====================================================================
// Crea un "pool" de conexiones con MySQL. Un pool es un grupo de
// conexiones abiertas que se reutilizan, para no tener que abrir una
// nueva en cada petición (es más rápido).
//
// El resto de archivos lo usarán así:
//     const db = require('../config/db');
//     const [filas] = await db.query('SELECT ...');
// =====================================================================

// Carga las variables del archivo .env en process.env
require('dotenv').config();

const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',     // para que las tildes y eñes se guarden bien
  decimalNumbers: true,   // devuelve los decimales como números, no como texto
});

// Lo exportamos para poder usarlo desde otros archivos
module.exports = db;