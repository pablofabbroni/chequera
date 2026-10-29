// Módulo de Cartera (Gestión de Stock de Cheques y Estados)

const CarteraModule = {
  cheques: [],
  initialized: false,
  filtroActual: {
    estado: 'Pendiente',
    search: '',
    soloAlertas: false
  },

  init() {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.cargarCheques();
  },

  bindEvents() {
    // Selector de estado
    const tabs = document.querySelectorAll('.cartera-status-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.filtroActual.estado = e.currentTarget.dataset.status;
        this.cargarCheques();
      });
    });

    // Buscador
    const searchInput = document.getElementById('searchCartera');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filtroActual.search = e.target.value.trim();
          this.cargarCheques();
        }, 300);
      });
    }

    // Toggle Solo Alertas
    const checkAlertas = document.getElementById('checkSoloAlertas');
    if (checkAlertas) {
      checkAlertas.addEventListener('change', (e) => {
        this.filtroActual.soloAlertas = e.target.checked;
        this.cargarCheques();
      });
    }

    // Botón Exportar Excel
    const btnExcel = document.getElementById('btnExportarExcel');
    if (btnExcel) {
      btnExcel.addEventListener('click', () => {
        const token = API.getToken();
        window.location.href = `/api/cheques/exportar/excel?token=${token}`;
      });
    }
  },

  async cargarCheques() {
    const tableBody = document.getElementById('tablaCarteraBody');
    const mobileCards = document.getElementById('carteraMobileCards');

    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-dim);">
            Cargando cheques de cartera...
          </td>
        </tr>
      `;
    }

    if (mobileCards) {
      mobileCards.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-dim);">
          Cargando cheques...
        </div>
      `;
    }

    try {
      const queryParams = new URLSearchParams({
        estado: this.filtroActual.estado,
        search: this.filtroActual.search,
        soloAlertas: this.filtroActual.soloAlertas ? 'true' : 'false'
      });

      const res = await API.get(`/cheques?${queryParams.toString()}`);
      this.cheques = res.cheques || [];
      this.renderTabla();
      this.actualizarContadores();
    } catch (error) {
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 30px; color: var(--accent-rose);">
              Error al cargar cartera: ${error.message}
            </td>
          </tr>
        `;
      }
    }
  },

  actualizarContadores() {
    const badgePendientes = document.getElementById('badgeCarteraPendientes');
    if (badgePendientes) {
      const pendientes = this.cheques.filter(c => c.estado === 'Pendiente').length;
      badgePendientes.textContent = pendientes;
    }
  },

  renderTabla() {
    const tableBody = document.getElementById('tablaCarteraBody');
    const mobileCards = document.getElementById('carteraMobileCards');
    const emptyState = document.getElementById('carteraEmptyState');

    if (!tableBody && !mobileCards) return;

    if (this.cheques.length === 0) {
      if (tableBody) tableBody.innerHTML = '';
      if (mobileCards) mobileCards.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // 1. Renderizado de Tabla Compacta para Escritorio (5 Columnas Optimizadas sin Scroll)
    if (tableBody) {
      tableBody.innerHTML = this.cheques.map(c => {
        const met = c.metricas || {};
        let alertaBadge = '';
        if (c.estado === 'Pendiente') {
          if (met.nivelAlerta === 'POR_VENCER_LEGAL') {
            alertaBadge = `<div class="tag-urgente critico">⚠️ Vence en ${met.diasParaVencLegal}d</div>`;
          } else if (met.nivelAlerta === 'COBRO_CERCANO' || met.nivelAlerta === 'LISTO_COBRO') {
            alertaBadge = `<div class="tag-urgente aviso">Cobro en ${met.diasParaCobro}d</div>`;
          } else if (met.nivelAlerta === 'VENCIDO') {
            alertaBadge = `<div class="tag-urgente critico">Vencido Legal</div>`;
          }
        }

        const estadoClass = c.estado.toLowerCase();

        return `
          <tr>
            <!-- Columna 1: Cheque y Banco -->
            <td>
              <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">#${c.numero}</div>
              <div style="font-size: 0.82rem; color: var(--primary); font-weight: 600;">${c.banco}</div>
              <div style="font-size: 0.75rem; color: var(--text-dim);">Recepción: ${formatFecha(c.fecha_recepcion)}</div>
            </td>

            <!-- Columna 2: Emisor y Entregador -->
            <td>
              <div style="font-weight: 600; color: #fff;">${c.emisor}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Entregó: <span style="color: #e2e8f0;">${c.entregador}</span></div>
            </td>

            <!-- Columna 3: Fecha Cobro y Alerta -->
            <td>
              <div style="font-weight: 700; color: #fff;">${formatFecha(c.fecha_cobro)}</div>
              ${alertaBadge}
              <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">Vence legal: ${met.fechaVencimientoLegal || '-'}</div>
            </td>

            <!-- Columna 4: Importe y Rendimiento -->
            <td>
              <div style="font-weight: 700; font-family: 'Outfit', sans-serif; font-size: 1.05rem; color: #fff;">
                ${formatARS(c.importe)}
              </div>
              <div style="font-size: 0.78rem; color: var(--accent-emerald); font-weight: 600;">
                +${formatARS(c.interes_cobrado)} (${c.tasa_interes}%)
              </div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">
                Saliente: ${formatARS(c.dinero_saliente)}
              </div>
            </td>

            <!-- Columna 5: Acciones (ÚNICAS 2 OPCIONES: Cobrado y Rechazado) -->
            <td>
              ${c.estado === 'Pendiente' ? `
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <button class="btn btn-emerald btn-sm" onclick="CarteraModule.modalCobrar(${c.id}, '${c.numero}')" title="Marcar como Cobrado">
                    Cobrado
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="CarteraModule.modalRechazar(${c.id}, '${c.numero}')" title="Marcar como Rechazado">
                    Rechazado
                  </button>
                  <button class="btn-icon" onclick="CarteraModule.eliminarCheque(${c.id}, '${c.numero}')" title="Eliminar" style="color: var(--accent-rose); width: 28px; height: 28px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              ` : `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge-status ${estadoClass}">● ${c.estado}</span>
                  ${c.motivo_rechazo ? `<div style="font-size: 0.72rem; color: var(--accent-rose);">Motivo: ${c.motivo_rechazo}</div>` : ''}
                  <button class="btn-icon" onclick="CarteraModule.eliminarCheque(${c.id}, '${c.numero}')" title="Eliminar" style="color: var(--accent-rose); width: 28px; height: 28px; margin-left: auto;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              `}
            </td>
          </tr>
        `;
      }).join('');
    }

    // 2. Renderizado de Tarjetas Nativas para Móviles (100% Responsive)
    if (mobileCards) {
      mobileCards.innerHTML = this.cheques.map(c => {
        const met = c.metricas || {};
        let alertaBadge = '';
        if (c.estado === 'Pendiente') {
          if (met.nivelAlerta === 'POR_VENCER_LEGAL') {
            alertaBadge = `<div class="tag-urgente critico" style="display: inline-flex;">⚠️ ¡Vence legal en ${met.diasParaVencLegal}d!</div>`;
          } else if (met.nivelAlerta === 'COBRO_CERCANO' || met.nivelAlerta === 'LISTO_COBRO') {
            alertaBadge = `<div class="tag-urgente aviso" style="display: inline-flex;">📅 Cobro en ${met.diasParaCobro}d</div>`;
          } else if (met.nivelAlerta === 'VENCIDO') {
            alertaBadge = `<div class="tag-urgente critico" style="display: inline-flex;">⛔ Vencido Legal</div>`;
          }
        }

        const estadoClass = c.estado.toLowerCase();

        return `
          <div class="check-card-item status-${estadoClass}">
            <div class="card-row-top">
              <div>
                <span class="card-check-num">#${c.numero}</span>
                <span class="card-bank-name">• ${c.banco}</span>
              </div>
              <span class="badge-status ${estadoClass}">● ${c.estado}</span>
            </div>

            ${alertaBadge ? `<div class="card-alert-strip">${alertaBadge}</div>` : ''}

            <div class="card-amount-box">
              <div>
                <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-dim); font-weight: 600;">Importe</div>
                <div class="card-amount-main">${formatARS(c.importe)}</div>
              </div>
              <div class="card-amount-details">
                <span style="color: var(--accent-emerald); font-weight: 700;">+${formatARS(c.interes_cobrado)} (${c.tasa_interes}%)</span>
                <span style="color: var(--text-dim);">Saliente: ${formatARS(c.dinero_saliente)}</span>
              </div>
            </div>

            <div class="card-meta-grid">
              <div>Emisor: <span class="val">${c.emisor}</span></div>
              <div>Entregó: <span class="val">${c.entregador}</span></div>
              <div>Cobro: <span class="val">${formatFecha(c.fecha_cobro)}</span></div>
              <div>Venc. legal: <span class="val">${met.fechaVencimientoLegal || '-'}</span></div>
            </div>

            ${c.motivo_rechazo ? `<div style="font-size: 0.75rem; color: var(--accent-rose); background: rgba(244,63,94,0.1); padding: 4px 8px; border-radius: 4px;">Motivo: ${c.motivo_rechazo}</div>` : ''}

            ${c.estado === 'Pendiente' ? `
              <div class="card-actions-row">
                <button class="btn btn-emerald btn-sm" onclick="CarteraModule.modalCobrar(${c.id}, '${c.numero}')" style="flex: 1; padding: 10px; font-weight: 700;">
                  Cobrado
                </button>
                <button class="btn btn-danger btn-sm" onclick="CarteraModule.modalRechazar(${c.id}, '${c.numero}')" style="flex: 1; padding: 10px; font-weight: 700;">
                  Rechazado
                </button>
                <button class="btn-icon" onclick="CarteraModule.eliminarCheque(${c.id}, '${c.numero}')" title="Eliminar" style="color: var(--accent-rose);">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            ` : `
              <div class="card-actions-row">
                <button class="btn btn-secondary btn-sm" onclick="CarteraModule.verDetalle(${c.id})" style="flex: 1;">
                  Ver Detalle
                </button>
                <button class="btn-icon" onclick="CarteraModule.eliminarCheque(${c.id}, '${c.numero}')" title="Eliminar" style="color: var(--accent-rose);">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            `}
          </div>
        `;
      }).join('');
    }
  },

  // Modal para Marcar como Cobrado
  modalCobrar(id, numero) {
    if (confirm(`¿Confirma cambiar estado a COBRADO para el Cheque N° ${numero}?`)) {
      this.ejecutarCambioEstado(id, 'Cobrado');
    }
  },

  // Modal para Marcar como Rechazado
  modalRechazar(id, numero) {
    const motivo = prompt(`Indique el motivo de RECHAZO del Cheque N° ${numero}:`, 'Sin fondos / Rechazado por el banco');
    if (motivo !== null) {
      this.ejecutarCambioEstado(id, 'Rechazado', motivo);
    }
  },

  async ejecutarCambioEstado(id, nuevoEstado, motivoRechazo = null) {
    try {
      const res = await API.patch(`/cheques/${id}/estado`, {
        nuevoEstado,
        motivoRechazo
      });
      showToast(res.mensaje, 'success');
      this.cargarCheques();
    } catch (error) {
      showToast(error.message, 'error');
    }
  },

  async eliminarCheque(id, numero) {
    if (confirm(`¿Está seguro de eliminar el Cheque N° ${numero}? Esta acción no se puede deshacer.`)) {
      try {
        const res = await API.delete(`/cheques/${id}`);
        showToast(res.mensaje, 'success');
        this.cargarCheques();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  },

  async verDetalle(id) {
    try {
      const res = await API.get(`/cheques/${id}`);
      const ch = res.cheque;
      alert(`INFORMACIÓN DEL CHEQUE N° ${ch.numero}\n\nBanco: ${ch.banco}\nEmisor: ${ch.emisor}\nEntregador: ${ch.entregador}\nImporte: ${formatARS(ch.importe)}\nTasa: ${ch.tasa_interes}%\nGanancia Interés: ${formatARS(ch.interes_cobrado)}\nEstado: ${ch.estado}\nFecha Cobro: ${formatFecha(ch.fecha_cobro)}\nVencimiento Legal (30d): ${ch.metricas?.fechaVencimientoLegal}\n${ch.notas ? 'Notas: ' + ch.notas : ''}`);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }
};
