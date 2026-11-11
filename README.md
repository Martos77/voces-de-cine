# Voces de Cine

**Diseño y desarrollo de una plataforma web para el descubrimiento de películas a través del doblaje**

Trabajo Final de Grado · Grado en Técnicas de Interacción Digital y Multimedia (UOC)
Área: Desarrollo Web · Autor: Eric Martos Garcia · Tutor: Mikel Zorrita Berasategui

**🌐 Aplicación publicada:** https://vocesdecine.alwaysdata.net
**💻 Código fuente:** https://github.com/Martos77/voces-de-cine

---

## Descripción

Voces de Cine es una aplicación web que permite descubrir películas a partir de su doblaje al castellano. Además de la información general de cada película, muestra qué profesional del doblaje pone voz a cada personaje y permite navegar entre películas, personajes, actores originales y actores de doblaje.

La información cinematográfica general (títulos, sinopsis, pósteres, repartos) se obtiene de la API de **TMDB**, y los datos de doblaje se cargan desde archivos CSV elaborados a partir de **eldoblaje.com**.

## Estado actual (PEC 2)

FIGMA PROTOTIPO: https://www.figma.com/proto/xboMmiGp0zxygVRGUQ0Mbh/Untitled?node-id=4-183&starting-point-node-id=4%3A183&t=MWlqvwSxCgcomn5C-1

FIGMA: https://www.figma.com/design/xboMmiGp0zxygVRGUQ0Mbh/Untitled?node-id=0-1&t=chH9tM9bxcPATUtU-1

Primera versión funcional del núcleo de la plataforma:

- Catálogo de películas con búsqueda por título, filtros (género, años, duración, valoración, director, actor original, solo con doblaje), ordenación y paginación.
- Búsqueda en TMDB de películas que no están en el catálogo e importación automática al abrirlas.
- Ficha de película con el reparto presentado como un guion de doblaje (personaje · actor original · voz en castellano).
- Sección «Con las mismas voces»: películas que comparten profesionales del doblaje.
- Ficha del actor de doblaje: personajes destacados, actores a los que dobla habitualmente y filmografía.
- Ficha del actor original con sus voces en castellano.
- Scripts de importación de datos desde TMDB y desde CSV.

> El diseño visual actual es provisional. Se sustituirá en la PEC 3 por el definido en el prototipo de Figma.

**Pendiente:** buscador de profesionales del doblaje, usuarios (registro, favoritos, valoraciones), sistema de recomendación, prueba de concepto de visualización en grafo, aplicación del diseño definitivo, despliegue y pruebas con usuarios.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML, CSS y JavaScript (módulos ES, sin frameworks) |
| Backend | Node.js + Express |
| Base de datos | MySQL (mediante XAMPP / phpMyAdmin) |
| Datos externos | API de TMDB (v3) |
| Librerías | `mysql2`, `dotenv`, `csv-parse` |

## Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior (incluye npm).
- [XAMPP](https://www.apachefriends.org/) o cualquier servidor MySQL / MariaDB.
- Una clave de la API de TMDB (gratuita): <https://www.themoviedb.org/settings/api>

## Instalación y puesta en marcha

### 1. Instalar las dependencias

Desde la carpeta del proyecto:

```bash
npm install
```

### 2. Crear la base de datos

1. Arranca **MySQL** desde el panel de XAMPP.
2. Abre phpMyAdmin (<http://localhost/phpmyadmin>).
3. Elige una de estas dos opciones:
   - **Con datos (recomendado):** crea una base de datos llamada `voces_de_cine` e importa el archivo `database/voces_de_cine.sql`, que incluye el catálogo y los datos de doblaje ya cargados. Con esta opción puedes saltar directamente al paso 5.
   - **Vacía:** importa `database/schema.sql`, que crea la base de datos y sus tablas sin datos.

### 3. Configurar las variables de entorno

Copia el archivo `.env.example`, renómbralo a `.env` y completa los valores:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=voces_de_cine
TMDB_API_KEY=tu_clave_de_tmdb
```

> El archivo `.env` contiene datos privados y no se incluye en el proyecto.

### 4. Cargar los datos (solo si has creado la base de datos vacía)

```bash
# Catálogo general: películas más conocidas de TMDB (50 páginas ≈ 1.000 películas)
npm run importar-populares -- 50

# Datos de doblaje desde data/doblajes.csv
npm run importar
```

Si una película del CSV ya estaba en la base de datos, añade `--actualizar` para completar su reparto:

```bash
npm run importar -- --actualizar
```

### 5. Arrancar la aplicación

```bash
npm start        # modo normal
npm run dev      # modo desarrollo: se reinicia al guardar cambios
```

Abre <http://localhost:3000> en el navegador.

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm start` | Arranca el servidor. |
| `npm run dev` | Arranca el servidor y lo reinicia automáticamente al modificar el código. |
| `npm run importar` | Importa los doblajes de `data/doblajes.csv`, completando la información con TMDB. |
| `npm run importar-populares -- N` | Importa las películas más conocidas de TMDB (N páginas de 20; por defecto 20). |

## Formato del CSV de doblajes

Archivo `data/doblajes.csv`, separado por comas o punto y coma:

```csv
tmdb_id,personaje,actor_original,actor_doblaje
862,Woody,Tom Hanks,Óscar Barberán
```

| Columna | Contenido |
|---|---|
| `tmdb_id` | Identificador de la película en TMDB (aparece en la URL de la película en themoviedb.org). |
| `personaje` | Nombre del personaje en castellano. |
| `actor_original` | Nombre del actor original, tal como aparece en TMDB. |
| `actor_doblaje` | Nombre del actor o actriz de doblaje. |

## Estructura del proyecto

```
voces-de-cine/
├── data/
│   └── doblajes.csv            # Datos de doblaje
├── database/
│   ├── schema.sql              # Estructura de la base de datos
│   └── voces_de_cine.sql       # Copia de la base de datos con datos
├── public/                     # Frontend (archivos estáticos)
│   ├── index.html              # Catálogo
│   ├── pelicula.html           # Ficha de película
│   ├── actor-doblaje.html      # Ficha del actor de doblaje
│   ├── actor-original.html     # Ficha del actor original
│   ├── css/estilos.css
│   └── js/                     # Lógica de cada página + funciones comunes
├── scripts/                    # Scripts de importación de datos
│   ├── importar.js
│   ├── importar-populares.js
│   └── probar-tmdb.js
├── src/                        # Backend
│   ├── server.js               # Punto de entrada del servidor
│   ├── config/db.js            # Conexión a MySQL
│   ├── routes/                 # Rutas de la API
│   ├── models/                 # Consultas a la base de datos
│   ├── services/               # Conexión con TMDB e importación
│   └── utils/                  # Funciones auxiliares
├── .env.example
├── package.json
└── README.md
```

El backend sigue una organización en tres partes: las **rutas** reciben las peticiones, los **modelos** consultan la base de datos y los **servicios** se comunican con TMDB.

## Modelo de datos

La base de datos tiene siete tablas: `peliculas`, `generos`, `peliculas_generos`, `actores_originales`, `actores_doblaje`, `personajes` y `doblajes`. La tabla `personajes` relaciona cada película con su actor original, y `doblajes` asocia cada personaje con su voz en castellano.

## Seguridad

- Consultas SQL parametrizadas y lista blanca para la ordenación (protección frente a inyección SQL).
- Escapado del contenido antes de insertarlo en el HTML (protección frente a XSS).
- Claves y credenciales en variables de entorno, fuera del código.

## Despliegue

La aplicación está publicada en [alwaysdata](https://www.alwaysdata.com) (plan gratuito), que ofrece Node.js y MariaDB (compatible con MySQL) en el mismo servicio:

- **Servidor:** sitio de tipo Node.js que ejecuta `node src/server.js`. La plataforma indica la IP y el puerto mediante las variables de entorno `IP` y `PORT`.
- **Base de datos:** MariaDB, importada a partir de `database/voces_de_cine.sql`.
- **Configuración:** archivo `.env` en el servidor con los datos de la base de datos y la clave de TMDB (no se incluye en el repositorio).
- **Actualización:** los cambios se suben a GitHub y se descargan en el servidor con `git pull`.

## Atribución

Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.
Los datos de doblaje proceden de [eldoblaje.com](https://www.eldoblaje.com/).

Proyecto académico sin finalidad comercial.
