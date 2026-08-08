const ReportsModule = {
  init() {
    this.setupTabs();
  },

  // Setup de las pestañas de reportes
  setupTabs() {
    const tabs = [
      { btnId: 'tab-rep-movies', secId: 'rep-movies-section' },
      { btnId: 'tab-rep-rooms', secId: 'rep-rooms-section' },
      { btnId: 'tab-rep-days', secId: 'rep-days-section' },
      { btnId: 'tab-rep-candy', secId: 'rep-candy-section' }
    ];

    tabs.forEach(tab => {
      const btn = document.getElementById(tab.btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          // Desactivar todos los botones y secciones
          tabs.forEach(t => {
            document.getElementById(t.btnId).classList.remove('active');
            document.getElementById(t.secId).classList.remove('active');
          });

          // Activar seleccionado
          btn.classList.add('active');
          document.getElementById(tab.secId).classList.add('active');
        });
      }
    });
  },

  // Carga de todos los reportes desde backend y actualización de tarjetas de resumen
  async loadReports() {
    try {
      // Cargar reportes concurrentemente
      const [moviesRep, roomsRep, daysRep, candyRep] = await Promise.all([
        App.fetchAPI('/api/reports/movies'),
        App.fetchAPI('/api/reports/rooms'),
        App.fetchAPI('/api/reports/days'),
        App.fetchAPI('/api/reports/candy')
      ]);

      // Rellenar Tablas
      this.renderMoviesReport(moviesRep);
      this.renderRoomsReport(roomsRep);
      this.renderDaysReport(daysRep);
      this.renderCandyReport(candyRep);

      // Calcular totales para las tarjetas de arriba
      let totalTicketsRevenue = 0;
      let totalTicketsCount = 0;
      moviesRep.forEach(m => {
        totalTicketsRevenue += parseFloat(m.total_recaudado);
        totalTicketsCount += parseInt(m.boletos_vendidos);
      });

      let totalCandyRevenue = 0;
      candyRep.forEach(c => {
        totalCandyRevenue += parseFloat(c.total_recaudado);
      });

      // Rellenar tarjetas
      document.getElementById('rep-summary-tickets').textContent = App.formatCurrency(totalTicketsRevenue);
      document.getElementById('rep-summary-candy').textContent = App.formatCurrency(totalCandyRevenue);
      document.getElementById('rep-summary-tickets-count').textContent = totalTicketsCount;

    } catch (err) {
      console.error('Error al cargar reportes:', err);
    }
  },

  // Renderizar ventas por Película
  renderMoviesReport(data) {
    const tbody = document.getElementById('rep-movies-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay registros.</td></tr>';
      return;
    }

    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.pelicula_id}</td>
        <td><strong>${row.pelicula_titulo}</strong></td>
        <td>${row.boletos_vendidos} boletos</td>
        <td style="font-weight: 600; color: #4caf50;">${App.formatCurrency(row.total_recaudado)}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  // Renderizar ventas por Sala
  renderRoomsReport(data) {
    const tbody = document.getElementById('rep-rooms-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay registros.</td></tr>';
      return;
    }

    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.sala_id}</td>
        <td><strong>${row.sala_nombre}</strong></td>
        <td>${row.boletos_vendidos} boletos</td>
        <td style="font-weight: 600; color: #4caf50;">${App.formatCurrency(row.total_recaudado)}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  // Renderizar ventas por Día (Boletos)
  renderDaysReport(data) {
    const tbody = document.getElementById('rep-days-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No hay registros.</td></tr>';
      return;
    }

    data.forEach(row => {
      const tr = document.createElement('tr');
      // Formato fecha YYYY-MM-DD
      const fechaFormatted = new Date(row.fecha).toISOString().split('T')[0];
      tr.innerHTML = `
        <td><strong>${fechaFormatted}</strong></td>
        <td>${row.boletos_vendidos} boletos</td>
        <td style="font-weight: 600; color: #4caf50;">${App.formatCurrency(row.total_recaudado)}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  // Renderizar ventas por Día (Dulcería)
  renderCandyReport(data) {
    const tbody = document.getElementById('rep-candy-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No hay registros.</td></tr>';
      return;
    }

    data.forEach(row => {
      const tr = document.createElement('tr');
      const fechaFormatted = new Date(row.fecha).toISOString().split('T')[0];
      tr.innerHTML = `
        <td><strong>${fechaFormatted}</strong></td>
        <td>${row.transacciones} compras</td>
        <td style="font-weight: 600; color: #4caf50;">${App.formatCurrency(row.total_recaudado)}</td>
      `;
      tbody.appendChild(tr);
    });
  }
};

// Auto inicializar
document.addEventListener('DOMContentLoaded', () => {
  ReportsModule.init();
});
