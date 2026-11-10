// Script de prueba: descarga una película de TMDB y la muestra.
// Uso: node scripts/probar-tmdb.js 862

const tmdb = require('../src/services/tmdb');

// process.argv[2] es el primer valor que escribimos después del nombre del script
const tmdbId = process.argv[2] || 862;

tmdb.obtenerPelicula(tmdbId)
  .then((pelicula) => console.log(pelicula))
  .catch((error) => console.error('Error:', error.message));