// Módulo de Cheques Entregados (Pagos con cheques a terceros)

const EntregadosModule = {
  entregados: [],
  chequesDisponibles: [],

  init() {
    this.bindEvents();
    this.cargarEntregados();
  },

  bindEvents() {
    const btnNuevoEntrega = document.getElementById('btnNuevaEntrega');
    if (btnNuevoEntrega) {
      btnNuevoEntrega.addEventListener('click', () => this.abrirModalEntrega());
    }

    const btnCerrarModal = document.getElementById('btnCerrarModalEntrega');
    const modal = document.getElementById('modalEntregarCheque');
    if (btnCerrarModal && modal) {
      btnCerrarModal.addEventListener('click', () => modal.classList.remove('show'));
    }

    const formEntrega = document.getElementById('formEntregarCheque');
    if (formEntrega) {
      formEntrega.addEventListener('submit', (e) => this.handleGuardarEntrega(e));
    }

    // Buscador
    const searchEntregados = document.getElementById('searchEntregados');
    if (searchEntregados) {
      searchEntregados.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtrados = this.entregados.filter(item => 
          item.numero.toLowerCase().includes(query) ||
          item.destinatario.toLowerCase().includes(query) ||
          item.banco.toLowerCase().includes(query) ||
          (item.concepto && item.concepto.toLowerCase().includes(query))
        );
        this.renderTabla(filtrados);
      });
    }

    // Selector de cheque en el modal (actualiza preview)
    const selectCheque = document.getElementById('selectChequeParaEntregar');
    if (selectCheque) {
      selectCheque.addEventListener('change', (e) => {
        const chequeId = parseInt(e.target.value, 10);
        const ch = this.chequesDisponibles.find(c => c.id === chequeId);
        const previewEl = document.getElementById('previewChequeSeleccionado');
        if (ch && previewEl) {
          previewEl.style.display = 'block';
          previewEl.innerHTML = `
            <div style="font-size: 0.85rem; color: #fff;">
              <strong>${ch.banco}</strong> - Cheque #${ch.numero}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              Emisor: ${ch.emisor} | Cobro: ${formatFecha(ch.fecha_cobro)}
            </div>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent-emerald); margin-top: 4px;">
              ${formatARS(ch.importe)}
            </div>
          `;
        } else if (previewEl) {
          previewEl.style.display = 'none';
        }
      });
    }
  },

  async cargarEntregados() {
    const tableBody = document.getElementById('tablaEntregadosBody');
    if (!tableBody) return;

    try {
      const res = await API.get('/entregas');
      this.entregados = res.entregados || [];

      // Actualizar métricas del encabezado
      const totalImporteEl = document.getElementById('totalEntregadosImporte');
      const totalCantEl = document.getElementById('totalEntregadosCantidad');
      if (totalImporteEl) totalImporteEl.textContent = formatARS(res.totalImporte || 0);
      if (totalCantEl) totalCantEl.textContent = `${res.totalEntregados || 0} cheques`;

      this.renderTabla(this.entregados);
    } catch (error) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--accent-rose);">
            Error al cargar cheques entregados: ${error.message}
          </td>
        </tr>
      `;
    }
  },

  renderTabla(lista) {
    const tableBody = document.getElementById('tablaEntregadosBody');
    const mobileCards = document.getElementById('entregadosMobileCards');
    const emptyState = document.getElementById('entregadosEmptyState');

    if (!tableBody && !mobileCards) return;

    if (!lista || lista.length === 0) {
      if (tableBody) tableBody.innerHTML = '';
      if (mobileCards) mobileCards.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // 1. Renderizar Tabla para Escritorio
    if (tableBody) {
      tableBody.innerHTML = lista.map(e => `
        <tr>
          <td><div style="font-weight: 600; color: #fff;">${formatFecha(e.fecha_entrega)}</div></td>
          <td>
            <div style="font-weight: 700; color: #fff;">#${e.numero}</div>
            <div style="font-size: 0.78rem; color: var(--text-dim);">${e.banco}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--primary);">${e.destinatario}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${e.concepto || 'Sin concepto'}</div>
          </td>
          <td>
            <div style="font-size: 0.85rem;">Emisor: ${e.emisor}</div>
            <div style="font-size: 0.78rem; color: var(--text-dim);">Entregó: ${e.entregador}</div>
          </td>
          <td><span style="font-weight: 500;">${formatFecha(e.fecha_cobro)}</span></td>
          <td>
            <div style="font-weight: 700; font-family: 'Outfit', sans-serif; font-size: 1rem; color: #fff;">
              ${formatARS(e.importe)}
            </div>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="EntregadosModule.revertir(${e.entrega_id})" title="Cancelar entrega y devolver a Cartera">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              Revertir
            </button>
          </td>
        </tr>
      `).join('');
    }

    // 2. Renderizar Tarjetas para Móviles
    if (mobileCards) {
      mobileCards.innerHTML = lista.map(e => `
        <div class="check-card-item status-entregado">
          <div class="card-row-top">
            <div>
              <span class="card-check-num">#${e.numero}</span>
              <span class="card-bank-name">• ${e.banco}</span>
            </div>
            <span class="badge-status entregado">● Entregado</span>
          </div>

          <div class="card-amount-box">
            <div>
              <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-dim); font-weight: 600;">Importe Entregado</div>
              <div class="card-amount-main">${formatARS(e.importe)}</div>
            </div>
            <div style="font-size: 0.75rem; text-align: right; color: var(--primary); font-weight: 600;">
              Fecha: ${formatFecha(e.fecha_entrega)}
            </div>
          </div>

          <div class="card-meta-grid">
            <div>Destinatario: <span class="val">${e.destinatario}</span></div>
            <div>Cobro Cheque: <span class="val">${formatFecha(e.fecha_cobro)}</span></div>
            <div>Emisor: <span class="val">${e.emisor}</span></div>
            <div>Entregó: <span class="val">${e.entregador}</span></div>
          </div>

          ${e.concepto ? `
            <div style="font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 4px;">
              Concepto: <strong style="color: #fff;">${e.concepto}</strong>
            </div>
          ` : ''}

          <div class="card-actions-row">
            <button class="btn btn-secondary btn-sm" onclick="EntregadosModule.revertir(${e.entrega_id})" style="width: 100%;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              Revertir Entrega a Cartera
            </button>
          </div>
        </div>
      `).join('');
    }
  },

  async abrirModalEntrega() {
    const modal = document.getElementById('modalEntregarCheque');
    const select = document.getElementById('selectChequeParaEntregar');
    const inputFecha = document.getElementById('inputFechaEntrega');
    const previewEl = document.getElementById('previewChequeSeleccionado');

    if (inputFecha) {
      inputFecha.value = new Date().toISOString().split('T')[0];
    }

    if (previewEl) previewEl.style.display = 'none';

    // Cargar cheques pendientes disponibles para entregar
    try {
      const res = await API.get('/cheques?estado=Pendiente');
      this.chequesDisponibles = res.cheques || [];

      if (this.chequesDisponibles.length === 0) {
        showToast('No hay cheques pendientes disponibles en cartera para entregar.', 'warning');
        return;
      }

      select.innerHTML = '<option value="">-- Seleccionar cheque de cartera --</option>' +
        this.chequesDisponibles.map(c => `
          <option value="${c.id}">
            #${c.numero} | ${c.banco} | ${formatARS(c.importe)} (Cobro: ${formatFecha(c.fecha_cobro)})
          </option>
        `).join('');

      modal.classList.add('show');
    } catch (e) {
      showToast('Error cargando cheques disponibles.', 'error');
    }
  },

  async abrirModalEntregaConCheque(chequeId) {
    await this.abrirModalEntrega();
    const select = document.getElementById('selectChequeParaEntregar');
    if (select) {
      select.value = chequeId;
      select.dispatchEvent(new Event('change'));
    }
  },

  async handleGuardarEntrega(e) {
    e.preventDefault();
    const select = document.getElementById('selectChequeParaEntregar');
    const destinatario = document.getElementById('inputDestinatario').value.trim();
    const fecha_entrega = document.getElementById('inputFechaEntrega').value;
    const concepto = document.getElementById('inputConceptoEntrega').value.trim();
    const notas = document.getElementById('inputNotasEntrega')?.value.trim() || '';

    if (!select.value || !destinatario || !fecha_entrega) {
      showToast('Debe completar los campos requeridos.', 'error');
      return;
    }

    try {
      const res = await API.post('/entregas', {
        cheque_id: parseInt(select.value, 10),
        destinatario,
        fecha_entrega,
        concepto,
        notas
      });

      showToast(res.mensaje, 'success');
      document.getElementById('modalEntregarCheque').classList.remove('show');
      document.getElementById('formEntregarCheque').reset();
      this.cargarEntregados();
    } catch (error) {
      showToast(error.message, 'error');
    }
  },

  async revertir(entregaId) {
    if (confirm('¿Desea revertir esta entrega? El cheque volverá a figurar como PENDIENTE en su Cartera.')) {
      try {
        const res = await API.delete(`/entregas/${entregaId}`);
        showToast(res.mensaje, 'success');
        this.cargarEntregados();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  }
};
