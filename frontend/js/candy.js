const CandyModule = {
  products: [],
  cart: {}, // Mapa de producto_id -> { producto, cantidad }

  init() {
    this.setupCartForm();
    this.setupProductForm();
  },

  // Cargar catálogo de dulcería
  async loadCandyProducts() {
    const container = document.getElementById('candy-products-list');
    const newBtn = document.getElementById('btn-new-candy');
    if (!container) return;

    const isAdmin = App.user && App.user.rol === 'administrador';
    if (newBtn) newBtn.style.display = isAdmin ? 'flex' : 'none';

    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px 0;">Cargando catálogo de dulcería...</div>';

    try {
      this.products = await App.fetchAPI('/api/candy/products');
      container.innerHTML = '';

      if (this.products.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px 0;">No hay productos de dulcería registrados.</div>';
        return;
      }

      this.products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card candy-card';
        card.innerHTML = `
          <img src="${p.imagen_url || 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=300'}" class="candy-poster" alt="${p.nombre}">
          <div class="card-body">
            <h3 class="card-title" title="${p.nombre}">${p.nombre}</h3>
            <div class="candy-price">${App.formatCurrency(p.precio)}</div>
            <button class="btn" style="width: 100%; justify-content: center;" onclick="CandyModule.addToCart(${p.id})">
              <i class="fa-solid fa-cart-plus"></i> Agregar al Carrito
            </button>
            ${isAdmin ? `
              <div class="card-actions" style="margin-top: 8px;">
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="CandyModule.editProductForm(${p.id})">
                  <i class="fa-solid fa-pen"></i> Editar
                </button>
                <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="CandyModule.deleteProduct(${p.id})">
                  <i class="fa-solid fa-trash"></i> Eliminar
                </button>
              </div>
            ` : ''}
          </div>
        `;
        container.appendChild(card);
      });
    } catch (err) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #f44336; padding: 40px 0;">Error al cargar dulcería: ${err.message}</div>`;
    }
  },

  // --- CRUD PRODUCTOS DE DULCERÍA (Solo Admin) ---
  setupProductForm() {
    const btnNew = document.getElementById('btn-new-candy');
    const modal = document.getElementById('candy-modal');
    const form = document.getElementById('candy-product-form');

    if (btnNew && modal) {
      btnNew.addEventListener('click', () => {
        document.getElementById('candy-modal-title').textContent = 'Nuevo Producto';
        document.getElementById('candy-product-id').value = '';
        form.reset();
        modal.classList.add('active');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('candy-product-id').value;
        const nombre = document.getElementById('candy-product-name').value;
        const precio = document.getElementById('candy-product-price').value;
        const imagen_url = document.getElementById('candy-product-img').value;

        const alertContainer = document.getElementById('candy-form-alert');
        alertContainer.innerHTML = '';

        const payload = { nombre, precio, imagen_url };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/candy/products/${id}` : '/api/candy/products';

        try {
          await App.fetchAPI(url, { method, body: JSON.stringify(payload) });
          modal.classList.remove('active');
          this.loadCandyProducts();
        } catch (err) {
          alertContainer.innerHTML = `<div class="alert alert-error">Error al guardar producto: ${err.message}</div>`;
        }
      });
    }
  },

  editProductForm(id) {
    const product = this.products.find(p => p.id === id);
    if (!product) return;

    document.getElementById('candy-modal-title').textContent = 'Editar Producto';
    document.getElementById('candy-product-id').value = product.id;
    document.getElementById('candy-product-name').value = product.nombre;
    document.getElementById('candy-product-price').value = product.precio;
    document.getElementById('candy-product-img').value = product.imagen_url;

    document.getElementById('candy-modal').classList.add('active');
  },

  async deleteProduct(id) {
    if (!confirm('¿Está seguro de eliminar este producto de dulcería?')) return;

    try {
      await App.fetchAPI(`/api/candy/products/${id}`, { method: 'DELETE' });
      this.loadCandyProducts();
    } catch (err) {
      alert(`Error al eliminar producto: ${err.message}`);
    }
  },

  // Agregar producto al carrito
  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    if (this.cart[productId]) {
      this.cart[productId].cantidad += 1;
    } else {
      this.cart[productId] = {
        producto: product,
        cantidad: 1
      };
    }

    this.renderCart();
  },

  // Reducir cantidad o quitar del carrito
  changeQuantity(productId, delta) {
    if (!this.cart[productId]) return;

    this.cart[productId].cantidad += delta;

    if (this.cart[productId].cantidad <= 0) {
      delete this.cart[productId];
    }

    this.renderCart();
  },

  // Renderizar la barra lateral del carrito
  renderCart() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total');
    const submitBtn = document.getElementById('btn-confirm-candy');
    
    if (!container) return;

    container.innerHTML = '';
    let total = 0;
    const cartKeys = Object.keys(this.cart);

    if (cartKeys.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px 0;" id="cart-empty-message">El carrito está vacío</p>';
      totalEl.textContent = App.formatCurrency(0);
      submitBtn.disabled = true;
      return;
    }

    submitBtn.disabled = false;

    cartKeys.forEach(id => {
      const item = this.cart[id];
      const subtotal = item.producto.precio * item.cantidad;
      total += subtotal;

      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      cartItem.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-name">${item.producto.nombre}</div>
          <div class="cart-item-price">${App.formatCurrency(item.producto.precio)} c/u</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" type="button" onclick="CandyModule.changeQuantity(${id}, -1)">-</button>
          <span>${item.cantidad}</span>
          <button class="qty-btn" type="button" onclick="CandyModule.changeQuantity(${id}, 1)">+</button>
        </div>
        <div style="font-weight: 600; width: 80px; text-align: right;">
          ${App.formatCurrency(subtotal)}
        </div>
      `;
      container.appendChild(cartItem);
    });

    totalEl.textContent = App.formatCurrency(total);
  },

  // Setup del formulario de Checkout de dulcería
  setupCartForm() {
    const form = document.getElementById('candy-checkout-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const comprador = document.getElementById('candy-comprador').value;
      const alertContainer = document.getElementById('candy-checkout-alert');
      alertContainer.innerHTML = '';

      // Mapear el carrito al formato esperado por el backend
      const productos = Object.keys(this.cart).map(id => {
        return {
          producto_id: parseInt(id),
          cantidad: this.cart[id].cantidad
        };
      });

      const payload = {
        comprador,
        productos
      };

      try {
        document.getElementById('btn-confirm-candy').disabled = true;

        const response = await App.fetchAPI('/api/candy/sell', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        // Mostrar el recibo impreso de dulcería
        this.showCandyReceipt(response.venta);

        // Limpiar el carrito y resetear formulario
        this.cart = {};
        form.reset();
        this.renderCart();
      } catch (err) {
        alertContainer.innerHTML = `
          <div class="alert alert-error">
            <i class="fa-solid fa-triangle-exclamation"></i> Error al vender: ${err.message}
          </div>
        `;
        document.getElementById('btn-confirm-candy').disabled = false;
      }
    });
  },

  // Mostrar el recibo impreso de dulcería en el modal
  showCandyReceipt(venta) {
    const container = document.getElementById('receipt-tickets-container');
    const modal = document.getElementById('receipt-modal');
    if (!container || !modal) return;

    container.innerHTML = '';

    const receipt = document.createElement('div');
    receipt.className = 'receipt-wrapper';

    // Generar las líneas de artículos
    let itemsText = '';
    venta.items.forEach(item => {
      const subtotalFormatted = App.formatCurrency(item.subtotal);
      // Formato alineado: Nombre cant x Precio = Subtotal
      itemsText += `${item.producto_nombre}\n  ${item.cantidad} x ${App.formatCurrency(item.precio_unitario)} = ${subtotalFormatted}\n`;
    });

    receipt.innerHTML = `
      <div class="receipt-header">
        <h3>CINEMAX DULCERÍA</h3>
        <p>SENA TADS - PROYECTO CINE</p>
        <p>NIT: 890.900.269-0</p>
      </div>
      <div class="receipt-body">
        <div class="receipt-row bold">
          <span>TICKET VENTA:</span>
          <span>${venta.codigo_unico}</span>
        </div>
        <div class="receipt-row">
          <span>Fecha/Hora:</span>
          <span>${new Date(venta.fecha_venta).toLocaleString('es-CO')}</span>
        </div>
        <div class="receipt-row">
          <span>Cliente:</span>
          <span>${venta.comprador}</span>
        </div>
        <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
        <pre style="font-family: inherit; font-size: inherit; margin: 0; line-height: 1.5; white-space: pre-wrap;">${itemsText}</pre>
        <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
        <div class="receipt-row bold" style="font-size: 16px;">
          <span>TOTAL COMPRA:</span>
          <span>${App.formatCurrency(venta.total)}</span>
        </div>
        <div class="receipt-row" style="font-size: 11px; margin-top: 10px;">
          <span>Atendido por:</span>
          <span>${venta.vendedor_nombre}</span>
        </div>
      </div>
      <div class="receipt-footer">
        <p>*** Gracias por su compra ***</p>
        <p>Disfrute de su función.</p>
      </div>
    `;
    
    container.appendChild(receipt);

    // Ajustar botones de impresión
    document.getElementById('btn-close-receipt').onclick = () => modal.classList.remove('active');
    document.getElementById('receipt-modal-close').onclick = () => modal.classList.remove('active');
    document.getElementById('btn-print-receipt-sim').onclick = () => {
      alert('Imprimiendo ticket de compra de dulcería (Simulado)');
    };

    modal.classList.add('active');
  }
};

// Auto inicializar
document.addEventListener('DOMContentLoaded', () => {
  CandyModule.init();
});
