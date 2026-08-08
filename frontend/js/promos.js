const PromosModule = {
  promos: [],

  init() {
    this.setupPromoForm();
  },

  // Cargar promociones en tabla
  async loadPromos() {
    const tbody = document.getElementById('promos-table-body');
    const alertContainer = document.getElementById('promos-alert-container');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Cargando promociones...</td></tr>';

    try {
      this.promos = await App.fetchAPI('/api/promos');
      tbody.innerHTML = '';

      if (this.promos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay promociones registradas.</td></tr>';
        return;
      }

      this.promos.forEach(p => {
        const tr = document.createElement('tr');
        
        // Formato fechas
        const inicio = new Date(p.fecha_inicio).toISOString().split('T')[0];
        const fin = new Date(p.fecha_fin).toISOString().split('T')[0];
        
        const valorText = p.tipo === 'porcentaje' ? `${p.valor}%` : App.formatCurrency(p.valor);
        const activeText = p.activa ? 'Activa' : 'Inactiva';
        const activeColor = p.activa ? '#4caf50' : '#f44336';

        tr.innerHTML = `
          <td><strong>${p.codigo}</strong></td>
          <td>${p.descripcion}</td>
          <td>${p.tipo === 'porcentaje' ? 'Porcentaje' : 'Monto Fijo'}</td>
          <td style="font-weight: 600;">${valorText}</td>
          <td style="font-size: 13px; color: var(--text-muted);">${inicio} al ${fin}</td>
          <td><span style="color: ${activeColor}; font-weight: bold;">${activeText}</span></td>
          <td>
            <div class="card-actions">
              <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="PromosModule.editPromoForm(${p.id})">
                <i class="fa-solid fa-pen"></i> Editar
              </button>
              <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="PromosModule.deletePromo(${p.id})">
                <i class="fa-solid fa-trash"></i> Eliminar
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      alertContainer.innerHTML = `<div class="alert alert-error">Error al cargar promociones: ${err.message}</div>`;
    }
  },

  // Setup del formulario de promociones (Crear/Editar)
  setupPromoForm() {
    const btnNew = document.getElementById('btn-new-promo');
    const modal = document.getElementById('promo-modal');
    const form = document.getElementById('promo-form');

    if (btnNew && modal) {
      btnNew.addEventListener('click', () => {
        document.getElementById('promo-modal-title').textContent = 'Nueva Promoción';
        document.getElementById('promo-id').value = '';
        document.getElementById('promo-status-group').style.display = 'none';
        form.reset();
        modal.classList.add('active');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('promo-id').value;
        const codigo = document.getElementById('promo-code').value;
        const descripcion = document.getElementById('promo-desc').value;
        const tipo = document.getElementById('promo-type').value;
        const valor = document.getElementById('promo-val').value;
        const fecha_inicio = document.getElementById('promo-start').value;
        const fecha_fin = document.getElementById('promo-end').value;
        
        let activa = true;
        if (id) {
          activa = document.getElementById('promo-active').value === 'true';
        }

        const alertContainer = document.getElementById('promos-alert-container');
        alertContainer.innerHTML = '';

        const payload = { codigo, descripcion, tipo, valor, fecha_inicio, fecha_fin, activa };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/promos/${id}` : '/api/promos';

        try {
          await App.fetchAPI(url, {
            method,
            body: JSON.stringify(payload)
          });

          modal.classList.remove('active');
          this.loadPromos();

          alertContainer.innerHTML = `
            <div class="alert alert-success">
              <i class="fa-solid fa-circle-check"></i> Promoción guardada correctamente.
            </div>
          `;
        } catch (err) {
          alertContainer.innerHTML = `<div class="alert alert-error">Error al guardar promoción: ${err.message}</div>`;
        }
      });
    }
  },

  // Preparar formulario para edición
  editPromoForm(id) {
    const promo = this.promos.find(p => p.id === id);
    if (!promo) return;

    document.getElementById('promo-modal-title').textContent = 'Editar Promoción';
    document.getElementById('promo-id').value = promo.id;
    document.getElementById('promo-code').value = promo.codigo;
    document.getElementById('promo-desc').value = promo.descripcion;
    document.getElementById('promo-type').value = promo.tipo;
    document.getElementById('promo-val').value = promo.valor;
    
    // Dar formato de fecha YYYY-MM-DD
    const start = new Date(promo.fecha_inicio).toISOString().split('T')[0];
    const end = new Date(promo.fecha_fin).toISOString().split('T')[0];
    document.getElementById('promo-start').value = start;
    document.getElementById('promo-end').value = end;

    // Mostrar el grupo de estado activa/inactiva solo en edición
    document.getElementById('promo-status-group').style.display = 'block';
    document.getElementById('promo-active').value = promo.activa ? 'true' : 'false';

    document.getElementById('promo-modal').classList.add('active');
  },

  // Eliminar promoción
  async deletePromo(id) {
    if (!confirm('¿Está seguro de eliminar esta promoción? Se conservará en el historial de boletos existentes pero ya no se podrá aplicar.')) return;
    
    const alertContainer = document.getElementById('promos-alert-container');
    alertContainer.innerHTML = '';

    try {
      await App.fetchAPI(`/api/promos/${id}`, { method: 'DELETE' });
      this.loadPromos();
      alertContainer.innerHTML = '<div class="alert alert-success"><i class="fa-solid fa-circle-check"></i> Promoción eliminada correctamente.</div>';
    } catch (err) {
      alertContainer.innerHTML = `<div class="alert alert-error">Error al eliminar promoción: ${err.message}</div>`;
    }
  }
};

// Auto inicializar
document.addEventListener('DOMContentLoaded', () => {
  PromosModule.init();
});
