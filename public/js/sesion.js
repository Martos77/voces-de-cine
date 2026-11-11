// =====================================================================
// SESIÓN DEL USUARIO EN LA CABECERA
// =====================================================================
// Este archivo se carga en todas las páginas. Pregunta a la API quién
// ha iniciado sesión y rellena el hueco de la derecha de la cabecera:
//   - Sin sesión: botón "Entrar".
//   - Con sesión: la inicial y el nombre (enlace al perfil) y "Salir".
// También exporta obtenerUsuario(), para las páginas que necesiten
// saber quién es el usuario (por ejemplo, la ficha de película).
// =====================================================================

import { pedirApi, enviarApi, escapar, iniciales } from './comun.js';

// Guardamos la PROMESA de la petición: aunque varias partes de la página
// llamen a obtenerUsuario(), solo se pregunta una vez a la API.
let peticionUsuario = null;

/**
 * El usuario que ha iniciado sesión ({ id, nombre, email }), o null.
 */
export function obtenerUsuario() {
  if (!peticionUsuario) {
    peticionUsuario = pedirApi('/api/auth/yo').catch(() => null);
  }
  return peticionUsuario;
}

/**
 * Dirección de la página de acceso, recordando la página actual para
 * volver a ella después de iniciar sesión: entrar.html?volver=...
 */
export function enlaceEntrar() {
  const actual = window.location.pathname + window.location.search;
  return `entrar.html?volver=${encodeURIComponent(actual)}`;
}

/**
 * Rellena el hueco de la sesión en la cabecera (<div id="sesion">).
 */
async function pintarSesion() {
  const hueco = document.getElementById('sesion');
  if (!hueco) return;

  const usuario = await obtenerUsuario();

  if (!usuario) {
    hueco.innerHTML = `<a class="boton boton--secundario boton--pequeno" href="${enlaceEntrar()}">Entrar</a>`;
    return;
  }

  hueco.innerHTML = `
    <a class="sesion__usuario" href="perfil.html" title="Mi perfil">
      <span class="sesion__inicial" aria-hidden="true">${escapar(iniciales(usuario.nombre)[0])}</span>
      <span class="sesion__nombre">${escapar(usuario.nombre)}</span>
    </a>
    <button type="button" class="sesion__salir" id="salir">Salir</button>`;

  // "Salir": cierra la sesión y vuelve a la página de inicio
  document.getElementById('salir').addEventListener('click', async () => {
    await enviarApi('/api/auth/logout', 'POST');
    window.location.href = 'index.html';
  });
}

pintarSesion();