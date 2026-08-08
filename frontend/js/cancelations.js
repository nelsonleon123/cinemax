const CancelationsModule = {
  currentTicket: null,

  init() {
    this.setupSearchForm();
  },

  // Setup search form
  setupSearchForm() {
    const form = document.getElementById('cancel-search-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const code = document.getElementById('cancel-ticket-code').value.trim();
      const alertContainer = document.getElementById('cancel-alert-container');
      const resultsContainer = document.getElementById('search-result-container');
      
      alertContainer.innerHTML = '';
      resultsContainer.innerHTML = '';
      this.currentTicket = null;

      try {
        const ticket = await App.fetchAPI(`/api/tickets/search/${code}`);
        this.currentTicket = ticket;
        this.renderTicketDetails(ticket);
      } catch (err) {
        alertContainer.innerHTML = `
          <div class="alert alert-error">
            <i class="fa-solid fa-triangle-exclamation"></i> ${err.message}
          </div>
        `;
      }
    });
  },

  // Render ticket details and option to cancel
  renderTicketDetails(ticket) {
    const container = document.getElementById('search-result-container');
    if (!container) return;

    const isCancelable = ticket.estado === 'vendido';
    const statusText = ticket.estado === 'vendido' ? 'Vendido' : 'Cancelado';

    container.innerHTML = `
      <div class="cancellation-ticket-detail">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
          <div>
            <span class="ticket-status-badge ${ticket.estado}">${statusText}</span>
            <h2 style="margin: 8px 0 0 0; font-size: 20px;">Boleto: ${ticket.codigo_unico}</h2>
          </div>
          <div style="text-align: right;">
            <p style="color: var(--text-muted); font-size: 12px;">Expedido por</p>
            <strong style="color: var(--primary-color);">${ticket.vendedor_nombre}</strong>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
          <div>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">Cliente</p>
            <strong>${ticket.comprador}</strong>
          </div>
          <div>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">Fecha Expedición</p>
            <strong>${new Date(ticket.fecha_expedicion).toLocaleString('es-CO')}</strong>
          </div>
          <div>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">Película</p>
            <strong>${ticket.pelicula_titulo}</strong>
          </div>
          <div>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">Función (Sala y Horario)</p>
            <strong>${ticket.sala_nombre} - ${App.formatDate(ticket.funcion_fecha)} a las ${ticket.funcion_hora.substring(0, 5)} Hs</strong>
          </div>
          <div>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">Asiento</p>
            <strong>${ticket.asiento_etiqueta} (${ticket.tipo_asiento.toUpperCase()})</strong>
          </div>
          <div>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">Precio Pagado</p>
            <strong style="color: #4caf50; font-size: 18px;">${App.formatCurrency(ticket.precio_pagado)}</strong>
            ${ticket.precio_original !== ticket.precio_pagado ? `<span style="font-size:12px; color:var(--text-muted); text-decoration:line-through; margin-left:8px;">${App.formatCurrency(ticket.precio_original)}</span>` : ''}
          </div>
        </div>

        ${isCancelable ? `
          <button class="btn btn-danger" style="width: 100%; justify-content: center;" onclick="CancelationsModule.cancelCurrentTicket()">
            <i class="fa-solid fa-ban"></i> Cancelar Boleto y Liberar Asiento
          </button>
        ` : `
          <div class="alert alert-success" style="text-align: center; margin-bottom: 0;">
            <i class="fa-solid fa-circle-check"></i> Este boleto ya se encuentra cancelado y su asiento liberado.
          </div>
        `}
      </div>
    `;
  },

  // Process cancellation
  async cancelCurrentTicket() {
    if (!this.currentTicket) return;
    if (!confirm(`¿Está seguro de cancelar el boleto ${this.currentTicket.codigo_unico}? Esta acción no se puede deshacer y liberará el asiento.`)) return;

    const alertContainer = document.getElementById('cancel-alert-container');
    alertContainer.innerHTML = '';

    try {
      const response = await App.fetchAPI('/api/tickets/cancel', {
        method: 'POST',
        body: JSON.stringify({ codigo_boleto: this.currentTicket.codigo_unico })
      });

      alertContainer.innerHTML = `
        <div class="alert alert-success">
          <i class="fa-solid fa-circle-check"></i> ${response.message}
        </div>
      `;

      // Recargar detalles para reflejar estado cancelado
      const code = this.currentTicket.codigo_unico;
      const updatedTicket = await App.fetchAPI(`/api/tickets/search/${code}`);
      this.currentTicket = updatedTicket;
      this.renderTicketDetails(updatedTicket);
    } catch (err) {
      alertContainer.innerHTML = `
        <div class="alert alert-error">
          <i class="fa-solid fa-triangle-exclamation"></i> Error al cancelar: ${err.message}
        </div>
      `;
    }
  }
};

// Auto inicializar
document.addEventListener('DOMContentLoaded', () => {
  CancelationsModule.init();
});
