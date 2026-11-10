// =====================================================================
// SERVIDOR DE VOCES DE CINE
// =====================================================================
// Punto de entrada de la aplicación. Arranca con: npm run dev
// =====================================================================

require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');

const rutasPeliculas = require('./routes/peliculas');
const rutasActores = require('./routes/actores');
const rutasGeneros = require('./routes/generos');
const rutasTmdb = require('./routes/tmdb');

const app = express();
const PUERTO = process.env.PORT || 3000;

// --- Archivos de la web (HTML, CSS, JS e imágenes) ---
// Cualquier archivo de la carpeta "public" se puede pedir directamente:
//   http://localhost:3000/             → public/index.html
//   http://localhost:3000/css/estilos.css → public/css/estilos.css
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Rutas de la API ---
// Todo lo que empiece por /api/peliculas lo gestiona routes/peliculas.js
app.use('/api/peliculas', rutasPeliculas);
app.use('/api', rutasActores); // /api/actores-doblaje/... y /api/actores-originales/...
app.use('/api/generos', rutasGeneros);
app.use('/api/tmdb', rutasTmdb);

// Cualquier otra dirección de la API que no exista → error 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Esta dirección de la API no existe.' });
});

// --- Gestión de errores ---
// Si algo falla en una ruta (por ejemplo, MySQL está apagado), llega aquí.
// El detalle se muestra en la terminal para poder arreglarlo, pero al
// usuario solo se le envía un mensaje general (por seguridad, no se dan
// pistas sobre el funcionamiento interno).
app.use((error, req, res, next) => {
  console.error('[Error]', error);
  res.status(500).json({ error: 'Se ha producido un error en el servidor.' });
});

// Puerto e IP en los que escucha el servidor.
// - En local: el puerto del .env (o 3000) y todas las direcciones.
// - En alwaysdata: la plataforma indica la IP y el puerto en las
//   variables de entorno IP y PORT, y el servidor debe usar esos.
const PORT = process.env.PORT || 3000;
const IP = process.env.IP; // en local no existe: se escucha en todas

app.listen(PORT, IP, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});