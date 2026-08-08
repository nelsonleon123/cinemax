const TicketingModule = {
  currentShow: null,
  selectedSeats: [], // Array de objetos asiento { asiento_id, etiqueta, precio_base }
  appliedPromo: null,

  init() {
    this.setupCheckoutForm();
    this.setupBackButton();
  },

  // Iniciar proceso de selección
  async startBooking(show) {
    this.currentShow = show;
    this.selectedSeats = [];
    this.appliedPromo = null;

    // Reset de inputs en checkout
    document.getElementById('checkout-comprador').value = '';
    document.getElementById('checkout-promo').value = '';
    document.getElementById('promo-applied-badge').innerHTML = '';
    document.getElementById('booking-checkout-alert').innerHTML = '';
    
    // Ocultar fila de descuento inicialmente
    document.getElementById('summary-discount-row').style.display = 'none';

    // Rellenar cabecera de función
    document.getElementById('booking-show-title').textContent = `${show.pelicula_titulo} - ${show.sala_nombre}`;
    document.getElementById('booking-show-time').innerHTML = `
      <i class="fa-regular fa-calendar"></i> ${App.formatDate(show.fecha)} &nbsp;&nbsp;|&nbsp;&nbsp; 
      <i class="fa-regular fa-clock"></i> ${show.hora.substring(0, 5)} Hs
    `;

    // Cambiar a vista de boletería
    App.showView('booking');

    // Cargar mapa
    await this.loadSeatMap();
    this.updateCheckoutSummary();
  },

  // Cargar mapa de asientos e interactividad
  async loadSeatMap() {
    const mapContainer = document.getElementById('seating-map-container');
    mapContainer.innerHTML = '<div style="padding: 20px;">Cargando distribución de asientos...</div>';

    try {
      const response = await App.fetchAPI(`/api/shows/${this.currentShow.id}/seats`);
      mapContainer.innerHTML = '';

      // Agrupar asientos por fila
      const seatsByRow = {};
      response.asientos.forEach(seat => {
        if (!seatsByRow[seat.fila]) {
          seatsByRow[seat.fila] = [];
        }
        seatsByRow[seat.fila].push(seat);
      });

      // Ordenar las filas alfabéticamente
      const sortedRows = Object.keys(seatsByRow).sort();

      sortedRows.forEach(rowName => {
        const rowSeats = seatsByRow[rowName].sort((a, b) => a.columna - b.columna);
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';

        // 1. Etiqueta izquierda de fila
        const leftLabel = document.createElement('span');
        leftLabel.className = 'row-label';
        leftLabel.textContent = rowName;
        rowDiv.appendChild(leftLabel);

        // Dividir asientos en dos bloques (izquierda y derecha) con pasillo central
        const totalSeatsInRow = rowSeats.length;
        const middleIndex = Math.ceil(totalSeatsInRow / 2);

        // Bloque izquierdo
        const leftBlock = document.createElement('div');
        leftBlock.className = 'seats-block';
        for (let i = 0; i < middleIndex; i++) {
          leftBlock.appendChild(this.createSeatDOM(rowSeats[i]));
        }
        rowDiv.appendChild(leftBlock);

        // Pasillo central (aisle)
        const aisle = document.createElement('div');
        aisle.className = 'aisle';
        rowDiv.appendChild(aisle);

        // Bloque derecho
        const rightBlock = document.createElement('div');
        rightBlock.className = 'seats-block';
        for (let i = middleIndex; i < totalSeatsInRow; i++) {
          rightBlock.appendChild(this.createSeatDOM(rowSeats[i]));
        }
        rowDiv.appendChild(rightBlock);

        // 2. Etiqueta derecha de fila
        const rightLabel = document.createElement('span');
        rightLabel.className = 'row-label';
        rightLabel.textContent = rowName;
        rowDiv.appendChild(rightLabel);

        mapContainer.appendChild(rowDiv);
      });
    } catch (err) {
      mapContainer.innerHTML = `<div style="color: #f44336; padding: 20px;">Error al estructurar sala: ${err.message}</div>`;
    }
  },

  // Generar el nodo de asiento individual
  createSeatDOM(seat) {
    const seatEl = document.createElement('div');
    // Clases del asiento
    seatEl.className = `seat ${seat.tipo_asiento} ${seat.ocupado ? 'occupied' : 'disponible'}`;
    seatEl.id = `seat-${seat.asiento_id}`;
    seatEl.dataset.id = seat.asiento_id;
    seatEl.dataset.etiqueta = seat.etiqueta;
    seatEl.dataset.precio = seat.precio_base;
    
    // Etiqueta visual para hover
    seatEl.title = `Asiento ${seat.etiqueta} - ${seat.tipo_asiento.toUpperCase()} (${App.formatCurrency(seat.precio_base)})`;
    seatEl.textContent = seat.etiqueta;

    if (!seat.ocupado) {
      seatEl.addEventListener('click', () => this.toggleSeatSelection(seat));
    }

    return seatEl;
  },

  // Alternar selección de asiento
  toggleSeatSelection(seat) {
    const index = this.selectedSeats.findIndex(s => s.asiento_id === seat.asiento_id);
    const seatEl = document.getElementById(`seat-${seat.asiento_id}`);

    if (index === -1) {
      // Agregar
      this.selectedSeats.push({
        asiento_id: seat.asiento_id,
        etiqueta: seat.etiqueta,
        precio_base: parseFloat(seat.precio_base)
      });
      if (seatEl) seatEl.classList.add('selected');
    } else {
      // Quitar
      this.selectedSeats.splice(index, 1);
      if (seatEl) seatEl.classList.remove('selected');
    }

    this.updateCheckoutSummary();
  },

  // Actualizar panel lateral de cobro
  updateCheckoutSummary() {
    const seatsCount = this.selectedSeats.length;
    document.getElementById('summary-seats-count').textContent = seatsCount;

    const listContainer = document.getElementById('summary-seats-list');
    const submitBtn = document.getElementById('btn-confirm-booking');

    if (seatsCount === 0) {
      listContainer.textContent = 'Ninguno';
      submitBtn.disabled = true;
    } else {
      listContainer.textContent = this.selectedSeats.map(s => s.etiqueta).join(', ');
      submitBtn.disabled = false;
    }

    // Calcular montos
    let subtotal = 0;
    this.selectedSeats.forEach(s => subtotal += s.precio_base);

    let descuento = 0;
    if (this.appliedPromo && seatsCount > 0) {
      if (this.appliedPromo.tipo === 'porcentaje') {
        descuento = subtotal * (parseFloat(this.appliedPromo.valor) / 100);
      } else if (this.appliedPromo.tipo === 'monto_fijo') {
        // El monto fijo aplica por boleto
        descuento = parseFloat(this.appliedPromo.valor) * seatsCount;
      }
      
      // No permitir descuento superior al subtotal
      if (descuento > subtotal) descuento = subtotal;

      document.getElementById('summary-discount-row').style.display = 'flex';
      document.getElementById('summary-discount-val').textContent = `-${App.formatCurrency(descuento)}`;
    } else {
      document.getElementById('summary-discount-row').style.display = 'none';
    }

    const total = subtotal - descuento;

    document.getElementById('summary-subtotal').textContent = App.formatCurrency(subtotal);
    document.getElementById('summary-total').textContent = App.formatCurrency(total);
  },

  // Configurar envío del checkout
  setupCheckoutForm() {
    const form = document.getElementById('booking-checkout-form');
    const promoBtn = document.getElementById('btn-apply-promo');

    if (promoBtn) {
      promoBtn.addEventListener('click', async () => {
        const codeInput = document.getElementById('checkout-promo');
        const promoCode = codeInput.value.trim().toUpperCase();
        const alertContainer = document.getElementById('booking-checkout-alert');
        const badgeContainer = document.getElementById('promo-applied-badge');
        
        alertContainer.innerHTML = '';
        badgeContainer.innerHTML = '';
        this.appliedPromo = null;

        if (!promoCode) {
          this.updateCheckoutSummary();
          return;
        }

        try {
          const promo = await App.fetchAPI(`/api/promos/validate/${promoCode}`);
          this.appliedPromo = promo;
          
          badgeContainer.innerHTML = `
            <div class="badge-discount-applied">
              <i class="fa-solid fa-circle-check"></i> Promo: ${promo.codigo} (-${promo.tipo === 'porcentaje' ? promo.valor + '%' : App.formatCurrency(promo.valor)})
            </div>
          `;
          
          this.updateCheckoutSummary();
        } catch (err) {
          alertContainer.innerHTML = `
            <div class="alert alert-error" style="padding: 8px 12px; font-size: 13px;">
              <i class="fa-solid fa-circle-xmark"></i> Promo inválida: ${err.message}
            </div>
          `;
          codeInput.value = '';
          this.updateCheckoutSummary();
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const comprador = document.getElementById('checkout-comprador').value;
        const promo_codigo = document.getElementById('checkout-promo').value;
        const alertContainer = document.getElementById('booking-checkout-alert');
        
        alertContainer.innerHTML = '';

        const payload = {
          funcion_id: this.currentShow.id,
          asiento_ids: this.selectedSeats.map(s => s.asiento_id),
          comprador,
          promo_codigo: promo_codigo ? promo_codigo : null
        };

        try {
          // Deshabilitar botón para evitar envíos múltiples
          document.getElementById('btn-confirm-booking').disabled = true;

          const response = await App.fetchAPI('/api/tickets/sell', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

          // Mostrar los boletos generados en el modal de recibo
          this.showReceipts(response.boletos);

          // Volver a cargar el mapa de asientos
          this.selectedSeats = [];
          this.appliedPromo = null;
          form.reset();
          document.getElementById('promo-applied-badge').innerHTML = '';
          await this.loadSeatMap();
          this.updateCheckoutSummary();
        } catch (err) {
          alertContainer.innerHTML = `
            <div class="alert alert-error">
              <i class="fa-solid fa-triangle-exclamation"></i> Error al vender: ${err.message}
            </div>
          `;
          document.getElementById('btn-confirm-booking').disabled = false;
        }
      });
    }
  },

  // Mostrar recibo impreso simulado en modal
  showReceipts(boletos) {
    const container = document.getElementById('receipt-tickets-container');
    const modal = document.getElementById('receipt-modal');
    if (!container || !modal) return;

    container.innerHTML = '';

    boletos.forEach(boleto => {
      const discountText = boleto.precio_original !== boleto.precio_pagado 
        ? `Original:   ${App.formatCurrency(boleto.precio_original)}\nDescuento:  ${App.formatCurrency(boleto.precio_original - boleto.precio_pagado)}`
        : 'Descuento:  N/A';

      const receipt = document.createElement('div');
      receipt.className = 'receipt-wrapper';
      receipt.innerHTML = `
        <div class="receipt-header">
          <h3>CINEMAX</h3>
          <p>SENA TADS - PROYECTO CINE</p>
          <p>NIT: 890.900.269-0</p>
        </div>
        <div class="receipt-body">
          <div class="receipt-row bold">
            <span>CÓDIGO ÚNICO:</span>
            <span>${boleto.codigo_unico}</span>
          </div>
          <div class="receipt-row">
            <span>Fecha/Hora Venta:</span>
            <span>${new Date(boleto.fecha_expedicion).toLocaleString('es-CO')}</span>
          </div>
          <div class="receipt-row">
            <span>Película:</span>
            <span style="max-width: 250px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${boleto.pelicula_titulo}</span>
          </div>
          <div class="receipt-row">
            <span>Sala / Asiento:</span>
            <span>${boleto.sala_nombre} / ${boleto.asiento_etiqueta} (${boleto.tipo_asiento.toUpperCase()})</span>
          </div>
          <div class="receipt-row">
            <span>Cliente:</span>
            <span>${boleto.comprador}</span>
          </div>
          <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
          <pre style="font-family: inherit; font-size: inherit; margin: 0; line-height: 1.4;">${discountText}</pre>
          <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
          <div class="receipt-row bold" style="font-size: 15px;">
            <span>TOTAL PAGADO:</span>
            <span>${App.formatCurrency(boleto.precio_pagado)}</span>
          </div>
          <div class="receipt-row" style="font-size: 11px; margin-top: 5px;">
            <span>Atendido por:</span>
            <span>${boleto.vendedor_nombre}</span>
          </div>
        </div>
        <div class="receipt-footer">
          <p>*** Gracias por su compra ***</p>
          <p>Conserve su boleta física para ingresar.</p>
        </div>
      `;
      container.appendChild(receipt);
    });

    // Configurar botones de impresión y cierre del modal
    document.getElementById('btn-close-receipt').onclick = () => modal.classList.remove('active');
    document.getElementById('receipt-modal-close').onclick = () => modal.classList.remove('active');
    document.getElementById('btn-print-receipt-sim').onclick = () => {
      alert('Enviando boletos a la impresora térmica de taquilla (Simulado)');
    };

    modal.classList.add('active');
  },

  setupBackButton() {
    const btn = document.getElementById('booking-back-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        App.showView('shows');
      });
    }
  }
};

// Auto inicializar
document.addEventListener('DOMContentLoaded', () => {
  TicketingModule.init();
});
