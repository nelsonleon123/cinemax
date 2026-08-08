const CatalogModule = {
  movies: [],
  shows: [],
  rooms: [],

  init() {
    this.setupMovieForm();
    this.setupShowForm();
    this.setupTabs();
  },

  // Setup tabs inside catalog view
  setupTabs() {
    const tabMovies = document.getElementById('tab-movies-crud');
    const tabShows = document.getElementById('tab-shows-crud');
    const sectionMovies = document.getElementById('movies-crud-section');
    const sectionShows = document.getElementById('shows-crud-section');

    if (tabMovies && tabShows) {
      tabMovies.addEventListener('click', () => {
        tabMovies.classList.add('active');
        tabShows.classList.remove('active');
        sectionMovies.classList.add('active');
        sectionShows.classList.remove('active');
      });

      tabShows.addEventListener('click', () => {
        tabShows.classList.add('active');
        tabMovies.classList.remove('active');
        sectionShows.classList.add('active');
        sectionMovies.classList.remove('active');
      });
    }
  },

  // CARGA DE CARTELERA (Para Ventas)
  async loadShowsForUsers() {
    const container = document.getElementById('shows-list-container');
    if (!container) return;

    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px 0;">Cargando cartelera de funciones...</div>';

    try {
      this.shows = await App.fetchAPI('/api/shows');
      container.innerHTML = '';

      if (this.shows.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px 0; color: var(--text-muted);"><i class="fa-solid fa-face-frown" style="font-size: 40px; margin-bottom: 10px; display: block;"></i> No hay funciones programadas para hoy ni mañana.</div>';
        return;
      }

      this.shows.forEach(show => {
        const card = document.createElement('div');
        card.className = 'show-card';
        card.onclick = () => TicketingModule.startBooking(show);
        
        card.innerHTML = `
          <img src="${show.pelicula_imagen || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300'}" class="show-poster" alt="${show.pelicula_titulo}">
          <div class="show-details">
            <div>
              <h3 class="show-title">${show.pelicula_titulo}</h3>
              <div class="show-meta">
                <span><i class="fa-regular fa-clock"></i> ${show.pelicula_duracion} mins</span>
                <span><i class="fa-solid fa-door-open"></i> ${show.sala_nombre}</span>
                <span><i class="fa-regular fa-calendar"></i> ${App.formatDate(show.fecha)}</span>
              </div>
            </div>
            <div class="show-time-badge">
              <i class="fa-solid fa-clock"></i> ${show.hora.substring(0, 5)}
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    } catch (err) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #f44336; padding: 40px 0;">Error al cargar cartelera: ${err.message}</div>`;
    }
  },

  // CARGA DE DATOS PARA PANEL ADMIN
  async loadCatalogAdmin() {
    this.loadMoviesTable();
    this.loadShowsTable();
    this.loadRoomsDropdown();
  },

  // 1. Catálogo Películas Admin
  async loadMoviesTable() {
    const tbody = document.getElementById('movies-table-body');
    const alertContainer = document.getElementById('catalog-alert-container');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando películas...</td></tr>';

    try {
      this.movies = await App.fetchAPI('/api/movies');
      tbody.innerHTML = '';

      // Rellenar selectores de películas
      this.populateMovieDropdowns();

      if (this.movies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay películas registradas.</td></tr>';
        return;
      }

      this.movies.forEach(movie => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><img src="${movie.imagen_url}" style="width: 40px; height: 55px; object-fit: cover; border-radius: 3px;" alt="poster"></td>
          <td><strong>${movie.titulo}</strong></td>
          <td>${movie.genero}</td>
          <td>${movie.duracion} min</td>
          <td>
            <div class="card-actions">
              <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="CatalogModule.editMovieForm(${movie.id})">
                <i class="fa-solid fa-pen"></i> Editar
              </button>
              <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="CatalogModule.deleteMovie(${movie.id})">
                <i class="fa-solid fa-trash"></i> Eliminar
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      alertContainer.innerHTML = `<div class="alert alert-error">Error al cargar películas: ${err.message}</div>`;
    }
  },

  // 2. Catálogo Funciones Admin
  async loadShowsTable() {
    const tbody = document.getElementById('shows-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando funciones programadas...</td></tr>';

    try {
      const showsList = await App.fetchAPI('/api/shows');
      tbody.innerHTML = '';

      if (showsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay funciones programadas.</td></tr>';
        return;
      }

      showsList.forEach(show => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${show.pelicula_titulo}</strong></td>
          <td>${show.sala_nombre}</td>
          <td>${App.formatDate(show.fecha)}</td>
          <td><span class="show-time-badge" style="align-self: unset;"><i class="fa-solid fa-clock"></i> ${show.hora.substring(0, 5)}</span></td>
          <td>
            <div class="card-actions">
              <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="CatalogModule.editShowForm(${show.id})">
                <i class="fa-solid fa-pen"></i> Editar
              </button>
              <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="CatalogModule.deleteShow(${show.id})">
                <i class="fa-solid fa-trash"></i> Eliminar
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
    }
  },

  // Llenar selectores de películas
  populateMovieDropdowns() {
    const select = document.getElementById('show-movie-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleccione película --</option>';
    this.movies.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.titulo} (${m.duracion} min)`;
      select.appendChild(opt);
    });
  },

  // Cargar salas desde base de datos
  async loadRoomsDropdown() {
    const select = document.getElementById('show-room-select');
    if (!select) return;

    try {
      this.rooms = await App.fetchAPI('/api/shows/rooms');
      select.innerHTML = '<option value="">-- Seleccione sala --</option>';
      this.rooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.nombre;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
    }
  },

  // --- CRUD PELÍCULAS ---
  setupMovieForm() {
    const btnNew = document.getElementById('btn-new-movie');
    const modal = document.getElementById('movie-modal');
    const form = document.getElementById('movie-form');

    if (btnNew && modal) {
      btnNew.addEventListener('click', () => {
        document.getElementById('movie-modal-title').textContent = 'Nueva Película';
        document.getElementById('movie-id').value = '';
        form.reset();
        modal.classList.add('active');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('movie-id').value;
        const titulo = document.getElementById('movie-title').value;
        const genero = document.getElementById('movie-genre').value;
        const duracion = document.getElementById('movie-duration').value;
        const sinopsis = document.getElementById('movie-synopsis').value;
        const imagen_url = document.getElementById('movie-img').value;

        const alertContainer = document.getElementById('catalog-alert-container');
        alertContainer.innerHTML = '';

        const payload = { titulo, genero, duracion, sinopsis, imagen_url };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/movies/${id}` : '/api/movies';

        try {
          await App.fetchAPI(url, {
            method,
            body: JSON.stringify(payload)
          });

          modal.classList.remove('active');
          this.loadMoviesTable();

          alertContainer.innerHTML = `
            <div class="alert alert-success">
              <i class="fa-solid fa-circle-check"></i> Película guardada correctamente.
            </div>
          `;
        } catch (err) {
          alertContainer.innerHTML = `<div class="alert alert-error">Error al guardar película: ${err.message}</div>`;
        }
      });
    }
  },

  editMovieForm(id) {
    const movie = this.movies.find(m => m.id === id);
    if (!movie) return;

    document.getElementById('movie-modal-title').textContent = 'Editar Película';
    document.getElementById('movie-id').value = movie.id;
    document.getElementById('movie-title').value = movie.titulo;
    document.getElementById('movie-genre').value = movie.genero;
    document.getElementById('movie-duration').value = movie.duracion;
    document.getElementById('movie-synopsis').value = movie.sinopsis;
    document.getElementById('movie-img').value = movie.imagen_url;

    document.getElementById('movie-modal').classList.add('active');
  },

  async deleteMovie(id) {
    if (!confirm('¿Está seguro de eliminar esta película? Se eliminarán todas sus funciones asociadas.')) return;
    
    const alertContainer = document.getElementById('catalog-alert-container');
    alertContainer.innerHTML = '';

    try {
      await App.fetchAPI(`/api/movies/${id}`, { method: 'DELETE' });
      this.loadMoviesTable();
      alertContainer.innerHTML = '<div class="alert alert-success"><i class="fa-solid fa-circle-check"></i> Película eliminada correctamente.</div>';
    } catch (err) {
      alertContainer.innerHTML = `<div class="alert alert-error">Error al eliminar película: ${err.message}</div>`;
    }
  },

  // --- CRUD FUNCIONES ---
  setupShowForm() {
    const btnNew = document.getElementById('btn-new-show');
    const modal = document.getElementById('show-modal');
    const form = document.getElementById('show-form');

    if (btnNew && modal) {
      btnNew.addEventListener('click', async () => {
        document.getElementById('show-modal-title').textContent = 'Programar Función';
        document.getElementById('show-id').value = '';
        form.reset();

        try {
          await this.loadMoviesTable();
          await this.loadRoomsDropdown();
        } catch (err) {
          console.error('Error al cargar datos del formulario de funciones:', err);
        }

        modal.classList.add('active');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('show-id').value;
        const pelicula_id = document.getElementById('show-movie-select').value;
        const sala_id = document.getElementById('show-room-select').value;
        const fecha = document.getElementById('show-date').value;
        const hora = document.getElementById('show-time').value;

        const alertContainer = document.getElementById('catalog-alert-container');
        alertContainer.innerHTML = '';

        const payload = { pelicula_id, sala_id, fecha, hora };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/shows/${id}` : '/api/shows';

        try {
          await App.fetchAPI(url, {
            method,
            body: JSON.stringify(payload)
          });

          modal.classList.remove('active');
          this.loadShowsTable();

          alertContainer.innerHTML = `
            <div class="alert alert-success">
              <i class="fa-solid fa-circle-check"></i> Función programada/actualizada con éxito.
            </div>
          `;
        } catch (err) {
          alertContainer.innerHTML = `<div class="alert alert-error">Error al programar función: ${err.message}</div>`;
        }
      });
    }
  },

  async editShowForm(id) {
    try {
      const showsList = await App.fetchAPI('/api/shows');
      const show = showsList.find(s => s.id === id);
      if (!show) return;

      document.getElementById('show-modal-title').textContent = 'Editar Función Programada';
      document.getElementById('show-id').value = show.id;
      document.getElementById('show-movie-select').value = show.pelicula_id;
      document.getElementById('show-room-select').value = show.sala_id;
      
      // Dar formato de fecha YYYY-MM-DD
      const formattedDate = new Date(show.fecha).toISOString().split('T')[0];
      document.getElementById('show-date').value = formattedDate;
      document.getElementById('show-time').value = show.hora;

      document.getElementById('show-modal').classList.add('active');
    } catch (err) {
      console.error(err);
    }
  },

  async deleteShow(id) {
    if (!confirm('¿Está seguro de eliminar esta función? Se perderá el historial de boletos si aplica.')) return;

    const alertContainer = document.getElementById('catalog-alert-container');
    alertContainer.innerHTML = '';

    try {
      await App.fetchAPI(`/api/shows/${id}`, { method: 'DELETE' });
      this.loadShowsTable();
      alertContainer.innerHTML = '<div class="alert alert-success"><i class="fa-solid fa-circle-check"></i> Función eliminada correctamente.</div>';
    } catch (err) {
      alertContainer.innerHTML = `<div class="alert alert-error">Error al eliminar función: ${err.message}</div>`;
    }
  }
};

// Auto inicializar
document.addEventListener('DOMContentLoaded', () => {
  CatalogModule.init();
});
