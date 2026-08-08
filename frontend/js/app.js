// CONFIGURACIÓN DE API
const API_BASE = window.location.origin;

// ESTADO GLOBAL DE LA APP
const App = {
  token: localStorage.getItem('token') || null,
  user: (() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('Sesión guardada corrupta, se limpiará.', err);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
  })(),
  currentView: 'login',

  // Inicializar aplicación
  init() {
    this.setupEventListeners();
    this.checkSession();
  },

  // Guardar sesión
  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.checkSession();
  },

  // Cerrar sesión
  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.checkSession();
  },

  // Verificar estado de sesión y actualizar UI
  checkSession() {
    const mainHeader = document.getElementById('main-header');
    
    if (this.token && this.user) {
      // Usuario autenticado
      mainHeader.style.display = 'block';
      document.getElementById('user-name-display').textContent = `${this.user.nombre} (${this.user.username})`;
      
      const badge = document.getElementById('user-badge');
      badge.className = `user-badge ${this.user.rol}`;

      this.renderNavLinks();
      
      // Ir a la vista por defecto (Cartelera) si estaba en login
      if (this.currentView === 'login') {
        this.showView('shows');
      } else {
        this.showView(this.currentView);
      }
    } else {
      // No autenticado
      mainHeader.style.display = 'none';
      this.currentView = 'login';
      this.showView('login');
    }
  },

  // Generar enlaces de navegación por rol
  renderNavLinks() {
    const navLinks = document.getElementById('nav-links');
    navLinks.innerHTML = '';

    const links = [
      { id: 'shows', label: 'Cartelera', icon: 'fa-ticket', roles: ['taquillero', 'administrador'] },
      { id: 'candy', label: 'Dulcería', icon: 'fa-cookie-bite', roles: ['taquillero', 'administrador'] },
      { id: 'cancelations', label: 'Cancelaciones', icon: 'fa-ban', roles: ['taquillero', 'administrador'] },
      { id: 'catalog', label: 'Películas y Funciones', icon: 'fa-sliders', roles: ['administrador'] },
      { id: 'promos', label: 'Promociones', icon: 'fa-tags', roles: ['administrador'] },
      { id: 'reports', label: 'Reportes', icon: 'fa-chart-line', roles: ['administrador'] },
      { id: 'employees', label: 'Empleados', icon: 'fa-users-gear', roles: ['administrador'] }
    ];

    links.forEach(link => {
      if (link.roles.includes(this.user.rol)) {
        const li = document.createElement('li');
        li.id = `nav-item-${link.id}`;
        li.innerHTML = `<a onclick="App.showView('${link.id}')"><i class="fa-solid ${link.icon}"></i> ${link.label}</a>`;
        navLinks.appendChild(li);
      }
    });
  },

  // Cambiar de vista SPA
  showView(viewId) {
    if (!this.token && viewId !== 'login') {
      viewId = 'login';
    }

    this.currentView = viewId;

    // Desactivar todas las vistas
    document.querySelectorAll('.view-section').forEach(view => {
      view.classList.remove('active');
    });

    // Activar vista seleccionada
    const targetView = document.getElementById(`${viewId}-view`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // Activar link de navegación
    document.querySelectorAll('#nav-links li').forEach(li => {
      li.classList.remove('active');
    });
    const activeNavItem = document.getElementById(`nav-item-${viewId}`);
    if (activeNavItem) {
      activeNavItem.classList.add('active');
    }

    // Disparar carga de datos de la vista específica
    this.loadViewData(viewId);
  },

  // Carga automática de datos para la vista activa
  loadViewData(viewId) {
    switch (viewId) {
      case 'shows':
        if (window.CatalogModule) CatalogModule.loadShowsForUsers();
        break;
      case 'catalog':
        if (window.CatalogModule) CatalogModule.loadCatalogAdmin();
        break;
      case 'promos':
        if (window.PromosModule) PromosModule.loadPromos();
        break;
      case 'employees':
        if (window.AuthModule) AuthModule.loadEmployees();
        break;
      case 'candy':
        if (window.CandyModule) CandyModule.loadCandyProducts();
        break;
      case 'reports':
        if (window.ReportsModule) ReportsModule.loadReports();
        break;
      case 'cancelations':
        // Limpiar búsqueda previa
        document.getElementById('cancel-ticket-code').value = '';
        document.getElementById('search-result-container').innerHTML = '';
        break;
    }
  },

  // Configurar escuchas de eventos globales
  setupEventListeners() {
    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      this.clearSession();
    });

    // Logo Click (ir a Cartelera)
    document.getElementById('nav-logo').addEventListener('click', (e) => {
      e.preventDefault();
      if (this.token) this.showView('shows');
    });

    // Cierre genérico de modales al pulsar la 'X' o fuera de ellos
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('active');
      });
    });

    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
      }
    });
  },

  // Helper centralizado para peticiones Fetch
  async fetchAPI(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);

      // Respuestas sin cuerpo (204 No Content) o vacías: no intentar parsear JSON
      const rawText = await response.text();
      let data = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          if (!response.ok) {
            throw new Error(`Error del servidor (${response.status}).`);
          }
          data = {};
        }
      }

      if (!response.ok) {
        throw new Error(data.error || `Ocurrió un error en la solicitud (${response.status}).`);
      }

      return data;
    } catch (err) {
      console.error(`Error en API ${endpoint}:`, err.message);
      throw err;
    }
  },

  // Helper para dar formato de moneda en pesos colombianos ($ COP)
  formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  },

  // Helper para dar formato de fecha legible local
  formatDate(dateStr) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('es-CO', options);
  }
};

// Inicializar al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
