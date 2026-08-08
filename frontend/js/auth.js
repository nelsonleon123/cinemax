const AuthModule = {
  init() {
    this.setupLoginForm();
    this.setupEmployeeForm();
  },

  // Manejo de formulario de Login
  setupLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      const alertContainer = document.getElementById('login-alert-container');
      
      alertContainer.innerHTML = '';

      try {
        const response = await App.fetchAPI('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });

        // Limpiar inputs
        form.reset();
        
        // Guardar sesión e iniciar app
        App.setSession(response.token, response.user);
      } catch (err) {
        alertContainer.innerHTML = `
          <div class="alert alert-error">
            <i class="fa-solid fa-triangle-exclamation"></i> ${err.message}
          </div>
        `;
      }
    });
  },

  // Cargar lista de empleados (Solo Admin)
  async loadEmployees() {
    const tbody = document.getElementById('employees-table-body');
    const alertContainer = document.getElementById('employees-alert-container');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Cargando empleados...</td></tr>';

    try {
      const employees = await App.fetchAPI('/api/auth/employees');
      tbody.innerHTML = '';

      if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay empleados registrados.</td></tr>';
        return;
      }

      employees.forEach(emp => {
        const tr = document.createElement('tr');
        
        // No permitir desactivarse a sí mismo
        const isSelf = emp.username === App.user.username;
        const buttonText = emp.activo ? 'Desactivar' : 'Activar';
        const buttonClass = emp.activo ? 'btn-danger' : 'btn-secondary';
        
        tr.innerHTML = `
          <td>${emp.id}</td>
          <td><strong>${emp.username}</strong></td>
          <td>${emp.nombre}</td>
          <td><span class="user-badge ${emp.rol}"><span class="role-dot"></span>${emp.rol}</span></td>
          <td>
            <span style="color: ${emp.activo ? '#4caf50' : '#f44336'}; font-weight: bold;">
              ${emp.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary ${buttonClass}" style="padding: 4px 10px; font-size: 12px;" 
              onclick="AuthModule.toggleEmployee(${emp.id})" ${isSelf ? 'disabled' : ''}>
              <i class="fa-solid ${emp.activo ? 'fa-user-slash' : 'fa-user-check'}"></i> ${buttonText}
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      alertContainer.innerHTML = `
        <div class="alert alert-error">
          <i class="fa-solid fa-triangle-exclamation"></i> Error al cargar empleados: ${err.message}
        </div>
      `;
    }
  },

  // Activar/Desactivar empleado
  async toggleEmployee(id) {
    const alertContainer = document.getElementById('employees-alert-container');
    alertContainer.innerHTML = '';

    try {
      const response = await App.fetchAPI(`/api/auth/employees/${id}/toggle`, {
        method: 'PUT'
      });

      this.loadEmployees();

      alertContainer.innerHTML = `
        <div class="alert alert-success">
          <i class="fa-solid fa-circle-check"></i> ${response.message}
        </div>
      `;
    } catch (err) {
      alertContainer.innerHTML = `
        <div class="alert alert-error">
          <i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}
        </div>
      `;
    }
  },

  // Manejo de formulario de registro de empleado
  setupEmployeeForm() {
    const btnNew = document.getElementById('btn-new-employee');
    const modal = document.getElementById('employee-modal');
    const form = document.getElementById('employee-form');

    if (btnNew && modal) {
      btnNew.addEventListener('click', () => {
        form.reset();
        modal.classList.add('active');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('emp-nombre').value;
        const username = document.getElementById('emp-username').value;
        const password = document.getElementById('emp-password').value;
        const rol = document.getElementById('emp-role').value;
        const alertContainer = document.getElementById('employees-alert-container');

        alertContainer.innerHTML = '';

        try {
          const response = await App.fetchAPI('/api/auth/employees', {
            method: 'POST',
            body: JSON.stringify({ nombre, username, password, rol })
          });

          modal.classList.remove('active');
          this.loadEmployees();

          alertContainer.innerHTML = `
            <div class="alert alert-success">
              <i class="fa-solid fa-circle-check"></i> ${response.message}
            </div>
          `;
        } catch (err) {
          alertContainer.innerHTML = `
            <div class="alert alert-error">
              <i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}
            </div>
          `;
        }
      });
    }
  }
};

// Auto inicializar
document.addEventListener('DOMContentLoaded', () => {
  AuthModule.init();
});
