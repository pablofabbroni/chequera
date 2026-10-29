// Módulo de Cartera (Gestión de Stock de Cheques y Estados)

const CarteraModule = {
  cheques: [],
  filtroActual: {
    estado: 'Pendiente',
    search: '',
    soloAlertas: false
  },

  init() {
    this.bindEvents();
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
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-dim);">
          Cargando cheques de la cartera...
        </td>
      </tr>
    `;

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
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 30px; color: var(--accent-rose);">
            Error al cargar cartera: ${error.message}
          </td>
        </tr>
      `;
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
    const emptyState = document.getElementById('carteraEmptyState');
    if (!tableBody) return;

    if (this.cheques.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = this.cheques.map(c => {
      const met = c.metricas || {};
      
      // Estado de alerta visual
      let alertaBadge = '';
      if (c.estado === 'Pendiente') {
        if (met.nivelAlerta === 'POR_VENCER_LEGAL') {
          alertaBadge = `
            <div class="tag-urgente critico" title="${met.mensajeAlerta}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              ¡Vence en ${met.diasParaVencLegal}d!
            </div>
          `;
        } else if (met.nivelAlerta === 'COBRO_CERCANO' || met.nivelAlerta === 'LISTO_COBRO') {
          alertaBadge = `
            <div class="tag-urgente aviso" title="${met.mensajeAlerta}">
              Cobro en ${met.diasParaCobro}d
            </div>
          `;
        } else if (met.nivelAlerta === 'VENCIDO') {
          alertaBadge = `<div class="tag-urgente critico">Vencido Legal</div>`;
        }
      }

      // Badge de estado
      const estadoClass = c.estado.toLowerCase();

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff;">#${c.numero}</div>
            <div style="font-size: 0.78rem; color: var(--text-dim);">${formatFecha(c.fecha_recepcion)}</div>
          </td>
          <td>
            <span style="font-weight: 600; color: #e2e8f0;">${c.banco}</span>
          </td>
          <td>
            <div style="font-weight: 500;">${c.emisor}</div>
            <div style="font-size: 0.78rem; color: var(--text-dim);">Entregó: ${c.entregador}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: #fff;">${formatFecha(c.fecha_cobro)}</div>
            ${alertaBadge}
          </td>
          <td>
            <div style="font-weight: 700; font-family: 'Outfit', sans-serif; font-size: 0.98rem; color: #fff;">
              ${formatARS(c.importe)}
            </div>
          </td>
          <td>
            <span style="background: rgba(14, 165, 233, 0.12); color: var(--primary); padding: 2px 8px; border-radius: 4px; font-weight: 600;">
              ${c.tasa_interes}%
            </span>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--accent-emerald);">
              ${formatARS(c.interes_cobrado)}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-dim);" title="Dinero desembolsado">
              Saliente: ${formatARS(c.dinero_saliente)}
            </div>
          </td>
          <td>
            <span class="badge-status ${estadoClass}">
              ● ${c.estado}
            </span>
            ${c.motivo_rechazo ? `<div style="font-size: 0.72rem; color: var(--accent-rose); margin-top: 4px;">Motivo: ${c.motivo_rechazo}</div>` : ''}
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${c.estado === 'Pendiente' ? `
                <button class="btn btn-emerald btn-sm" onclick="CarteraModule.modalCobrar(${c.id}, '${c.numero}')" title="Marcar como Cobrado">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Cobrar
                </button>
                <button class="btn btn-danger btn-sm" onclick="CarteraModule.modalRechazar(${c.id}, '${c.numero}')" title="Marcar como Rechazado">
                  Rechazar
                </button>
                <button class="btn btn-secondary btn-sm" onclick="CarteraModule.abrirEntregar(${c.id})" title="Entregar Cheque a Tercero">
                  Entregar
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm" onclick="CarteraModule.verDetalle(${c.id})" title="Ver Información Completa">
                  Ver
                </button>
              `}
              <button class="btn-icon" onclick="CarteraModule.eliminarCheque(${c.id}, '${c.numero}')" title="Eliminar Cheque" style="color: var(--accent-rose);">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // Modal para Marcar como Cobrado
  modalCobrar(id, numero) {
    if (confirm(`¿Confirma que el Cheque N° ${numero} ha sido COBRADO exitosamente?`)) {
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

  abrirEntregar(id) {
    // Redirige al módulo entregados y preselecciona el cheque
    window.location.hash = '#entregados';
    setTimeout(() => {
      EntregadosModule.abrirModalEntregaConCheque(id);
    }, 150);
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
