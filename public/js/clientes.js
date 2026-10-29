// Módulo de Gestión de Clientes (Entregadores de cheques)

const ClientesModule = {
  clientes: [],
  initialized: false,

  init() {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.cargarClientes();
  },

  bindEvents() {
    const searchInput = document.getElementById('searchClientes');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtrados = this.clientes.filter(c => 
          c.nombre.toLowerCase().includes(query) ||
          (c.telefono && c.telefono.toLowerCase().includes(query)) ||
          (c.cuit && c.cuit.toLowerCase().includes(query))
        );
        this.renderTabla(filtrados);
      });
    }

    const btnNuevo = document.getElementById('btnNuevoClienteTab');
    if (btnNuevo) {
      btnNuevo.addEventListener('click', () => this.abrirModalNuevo());
    }

    const formCliente = document.getElementById('formModalCliente');
    if (formCliente) {
      formCliente.onsubmit = (e) => this.handleGuardarCliente(e);
    }
  },

  async cargarClientes() {
    const tableBody = document.getElementById('tablaClientesBody');
    const mobileCards = document.getElementById('clientesMobileCards');

    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-dim);">Cargando directorio de clientes...</td></tr>`;
    }

    try {
      const res = await API.get('/clientes');
      this.clientes = res.clientes || [];
      this.renderTabla(this.clientes);
      this.actualizarResumen();
    } catch (error) {
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 25px; color: var(--accent-rose);">Error al cargar clientes: ${error.message}</td></tr>`;
      }
    }
  },

  actualizarResumen() {
    const totalClientesEl = document.getElementById('resumenTotalClientes');
    const totalVolumenEl = document.getElementById('resumenVolumenClientes');
    const totalGananciaEl = document.getElementById('resumenGananciaClientes');

    if (totalClientesEl) totalClientesEl.textContent = `${this.clientes.length} clientes`;
    
    if (totalVolumenEl || totalGananciaEl) {
      const vol = this.clientes.reduce((acc, c) => acc + Number(c.total_importe || 0), 0);
      const gan = this.clientes.reduce((acc, c) => acc + Number(c.total_ganancia || 0), 0);
      if (totalVolumenEl) totalVolumenEl.textContent = formatARS(vol);
      if (totalGananciaEl) totalGananciaEl.textContent = formatARS(gan);
    }
  },

  renderTabla(lista) {
    const tableBody = document.getElementById('tablaClientesBody');
    const mobileCards = document.getElementById('clientesMobileCards');
    const emptyState = document.getElementById('clientesEmptyState');

    if (!tableBody && !mobileCards) return;

    if (!lista || lista.length === 0) {
      if (tableBody) tableBody.innerHTML = '';
      if (mobileCards) mobileCards.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // 1. Vista de Escritorio (Tabla limpia y contenida)
    if (tableBody) {
      tableBody.innerHTML = lista.map(c => `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${c.nombre}</div>
            ${c.cuit ? `<div style="font-size: 0.75rem; color: var(--text-dim);">CUIT/DNI: ${c.cuit}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 0.85rem; color: #fff;">${c.telefono || '<span style="color: var(--text-dim);">-</span>'}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${c.email || ''}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--primary);">${c.total_cheques || 0} cheques</div>
            <div style="font-size: 0.72rem; color: var(--text-dim);">Ingresados en cartera</div>
          </td>
          <td>
            <div style="font-weight: 700; color: #fff; font-family: 'Outfit', sans-serif;">${formatARS(c.total_importe || 0)}</div>
            <div style="font-size: 0.75rem; color: var(--accent-emerald); font-weight: 600;">
              Ganancia: +${formatARS(c.total_ganancia || 0)}
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="ClientesModule.verChequesEnCartera('${c.nombre.replace(/'/g, "\\'")}')" title="Ver cheques de este cliente en Cartera">
                Ver cheques ↗
              </button>
              <button class="btn-icon" onclick="ClientesModule.abrirModalEditar(${c.id})" title="Editar cliente" style="width: 28px; height: 28px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="btn-icon" onclick="ClientesModule.eliminarCliente(${c.id}, '${c.nombre.replace(/'/g, "\\'")}')" title="Eliminar cliente" style="color: var(--accent-rose); width: 28px; height: 28px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // 2. Vista Móvil (Tarjetas Nativas)
    if (mobileCards) {
      mobileCards.innerHTML = lista.map(c => `
        <div class="check-card-item">
          <div class="card-row-top">
            <div>
              <span class="card-check-num">${c.nombre}</span>
              ${c.cuit ? `<span class="card-bank-name">• CUIT: ${c.cuit}</span>` : ''}
            </div>
            <span class="badge-status pendiente">${c.total_cheques || 0} ch.</span>
          </div>

          <div class="card-amount-box">
            <div>
              <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-dim); font-weight: 600;">Volumen Total</div>
              <div class="card-amount-main">${formatARS(c.total_importe || 0)}</div>
            </div>
            <div style="font-size: 0.75rem; text-align: right; color: var(--accent-emerald); font-weight: 700;">
              +${formatARS(c.total_ganancia || 0)}
              <div style="font-size: 0.68rem; color: var(--text-dim); font-weight: normal;">utilidad neta</div>
            </div>
          </div>

          <div class="card-meta-grid">
            <div>Teléfono: <span class="val">${c.telefono || '-'}</span></div>
            <div>Email: <span class="val">${c.email || '-'}</span></div>
          </div>

          ${c.notas ? `<div style="font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 4px;">${c.notas}</div>` : ''}

          <div class="card-actions-row">
            <button class="btn btn-secondary btn-sm" onclick="ClientesModule.verChequesEnCartera('${c.nombre.replace(/'/g, "\\'")}')" style="flex: 2; padding: 9px;">
              Ver cheques ↗
            </button>
            <button class="btn-icon" onclick="ClientesModule.abrirModalEditar(${c.id})" title="Editar" style="padding: 8px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn-icon" onclick="ClientesModule.eliminarCliente(${c.id}, '${c.nombre.replace(/'/g, "\\'")}')" title="Eliminar" style="color: var(--accent-rose); padding: 8px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `).join('');
    }
  },

  verChequesEnCartera(nombreCliente) {
    window.location.hash = '#cartera';
    setTimeout(() => {
      const search = document.getElementById('searchCartera');
      if (search) {
        search.value = nombreCliente;
        search.dispatchEvent(new Event('input'));
      }
    }, 150);
  },

  abrirModalNuevo() {
    const modal = document.getElementById('modalClienteGlobal');
    const form = document.getElementById('formModalCliente');
    const title = document.getElementById('modalClienteTitulo');
    if (!modal) return;

    if (form) form.reset();
    document.getElementById('inputClienteId').value = '';
    if (title) title.textContent = 'Nuevo Cliente (Entregador)';
    modal.classList.add('show');
    setTimeout(() => document.getElementById('inputClienteNombre')?.focus(), 100);
  },

  abrirModalEditar(id) {
    const c = this.clientes.find(item => item.id === id);
    if (!c) return;

    const modal = document.getElementById('modalClienteGlobal');
    const title = document.getElementById('modalClienteTitulo');
    if (!modal) return;

    document.getElementById('inputClienteId').value = c.id;
    document.getElementById('inputClienteNombre').value = c.nombre || '';
    document.getElementById('inputClienteTelefono').value = c.telefono || '';
    document.getElementById('inputClienteEmail').value = c.email || '';
    document.getElementById('inputClienteCuit').value = c.cuit || '';
    document.getElementById('inputClienteNotas').value = c.notas || '';

    if (title) title.textContent = `Editar Cliente: ${c.nombre}`;
    modal.classList.add('show');
  },

  async handleGuardarCliente(e) {
    e.preventDefault();
    const id = document.getElementById('inputClienteId').value;
    const nombre = document.getElementById('inputClienteNombre').value.trim();
    const telefono = document.getElementById('inputClienteTelefono').value.trim();
    const email = document.getElementById('inputClienteEmail').value.trim();
    const cuit = document.getElementById('inputClienteCuit').value.trim();
    const notas = document.getElementById('inputClienteNotas').value.trim();

    if (!nombre) {
      showToast('El nombre del cliente es obligatorio.', 'error');
      return;
    }

    try {
      if (id) {
        // Actualizar
        const res = await API.put(`/clientes/${id}`, { nombre, telefono, email, cuit, notas });
        showToast(res.mensaje, 'success');
      } else {
        // Crear
        const res = await API.post('/clientes', { nombre, telefono, email, cuit, notas });
        showToast(res.mensaje, 'success');
      }

      document.getElementById('modalClienteGlobal').classList.remove('show');
      this.cargarClientes();
    } catch (error) {
      showToast(error.message, 'error');
    }
  },

  async eliminarCliente(id, nombre) {
    if (confirm(`¿Confirma eliminar al cliente "${nombre}"? Los cheques registrados mantendrán su registro histórico.`)) {
      try {
        const res = await API.delete(`/clientes/${id}`);
        showToast(res.mensaje, 'success');
        this.cargarClientes();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  }
};
