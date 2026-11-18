// Módulo de Cartera (Gestión de Stock de Cheques y Estados)

const CarteraModule = {
  cheques: [],
  initialized: false,
  filtroActual: {
    estado: 'Pendiente',
    search: '',
    cliente: '',
    soloAlertas: false
  },

  init() {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.cargarComboClientes();
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

    // Selector de Cliente
    const selectCliente = document.getElementById('carteraFiltroCliente');
    if (selectCliente) {
      selectCliente.addEventListener('change', (e) => {
        this.filtroActual.cliente = e.target.value;
        this.cargarCheques();
      });
    }

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

    // Modal Rechazo Form
    const formRechazo = document.getElementById('formRechazoCheque');
    if (formRechazo) {
      formRechazo.onsubmit = (e) => this.handleConfirmarRechazo(e);
    }

    // Modal Cobro Form y Controles Reactivos
    this.poblarSelectTasaBanco();
    const formCobro = document.getElementById('formCobrarCheque');
    if (formCobro) {
      formCobro.onsubmit = (e) => this.handleConfirmarCobro(e);
    }

    const radiosCobro = document.querySelectorAll('input[name="tipoCobroCheque"]');
    radiosCobro.forEach(radio => {
      radio.addEventListener('change', () => this.actualizarVistaTipoCobro());
    });

    const inputImpuesto = document.getElementById('inputCobroImpuesto');
    if (inputImpuesto) {
      inputImpuesto.addEventListener('input', () => this.actualizarCalculoCobroEnVivo());
      inputImpuesto.addEventListener('change', () => this.actualizarCalculoCobroEnVivo());
    }

    const selectTasaBanco = document.getElementById('selectCobroTasaBanco');
    if (selectTasaBanco) {
      selectTasaBanco.addEventListener('change', () => this.actualizarCalculoCobroEnVivo());
      selectTasaBanco.addEventListener('input', () => this.actualizarCalculoCobroEnVivo());
    }

    // Modal Editar Cheque Form y Controles Reactivos
    const formEditar = document.getElementById('formEditarCheque');
    if (formEditar) {
      formEditar.onsubmit = (e) => this.handleConfirmarEdicion(e);
    }

    const editImporte = document.getElementById('editChequeImporte');
    const editFechaRecep = document.getElementById('editChequeFechaRecepcion');
    const editFechaCobro = document.getElementById('editChequeFechaCobro');
    const editTasa = document.getElementById('editChequeTasa');
    const btnEditConsultarBcra = document.getElementById('btnEditChequeConsultarBcra');
    const editBancoSelect = document.getElementById('editChequeBanco');
    const editBancoOtro = document.getElementById('editChequeBancoOtro');

    if (editImporte) editImporte.addEventListener('input', () => this.calcularEditEnVivo());
    if (editFechaRecep) editFechaRecep.addEventListener('change', () => this.calcularEditEnVivo());
    if (editFechaCobro) editFechaCobro.addEventListener('change', () => this.calcularEditEnVivo());

    if (editTasa) {
      editTasa.addEventListener('keydown', (e) => {
        const allowed = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
        if (/^[0-9]$/.test(e.key)) return;
        if ((e.key === '.' || e.key === ',') && !editTasa.value.includes('.') && !editTasa.value.includes(',')) return;
        e.preventDefault();
      });

      editTasa.addEventListener('input', () => {
        let val = editTasa.value.replace(/[^0-9.,]/g, '');
        const parts = val.split(/[.,]/);
        if (parts.length > 2) {
          val = parts[0] + '.' + parts.slice(1).join('');
        }
        if (val !== editTasa.value) {
          editTasa.value = val;
        }
        this.calcularEditEnVivo();
      });
      editTasa.addEventListener('change', () => this.calcularEditEnVivo());
    }

    if (btnEditConsultarBcra) {
      btnEditConsultarBcra.addEventListener('click', () => this.consultarBcraDesdeEdicion());
    }

    if (editBancoSelect && editBancoOtro) {
      editBancoSelect.addEventListener('change', (e) => {
        if (e.target.value === 'OTRO') {
          editBancoOtro.style.display = 'block';
          editBancoOtro.required = true;
          editBancoOtro.focus();
        } else {
          editBancoOtro.style.display = 'none';
          editBancoOtro.required = false;
        }
      });
    }
  },

  poblarSelectTasaBanco() {
    const select = document.getElementById('selectCobroTasaBanco');
    if (!select || select.options.length > 0) return;

    const opciones = [];
    for (let t = 1; t <= 30; t += 0.5) {
      const label = Number.isInteger(t) ? `${t} %` : `${String(t).replace('.', ',')} %`;
      const selected = t === 3 ? 'selected' : '';
      opciones.push(`<option value="${t}" ${selected}>${label}</option>`);
    }
    select.innerHTML = opciones.join('');
  },

  async cargarComboClientes() {
    const select = document.getElementById('carteraFiltroCliente');
    if (!select) return;

    try {
      const res = await API.get('/clientes');
      const clientes = res.clientes || [];
      const valorPrevio = this.filtroActual.cliente || select.value;

      select.innerHTML = `
        <option value="">Todos los clientes</option>
        ${clientes.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
      `;

      if (valorPrevio) {
        select.value = valorPrevio;
      }
    } catch (e) {
      console.error('Error cargando clientes en filtro de cartera:', e);
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

      if (this.filtroActual.cliente) {
        queryParams.append('cliente', this.filtroActual.cliente);
      }

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
              ${c.cuit_emisor ? `<div style="font-size: 0.72rem; color: var(--text-dim);">CUIT: ${c.cuit_emisor}</div>` : ''}
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
              ${c.estado === 'Cobrado' && Number(c.descuento_banco) > 0 ? `
                <div style="font-size: 0.76rem; color: var(--accent-emerald); font-weight: 700;">
                  Neta: +${formatARS(Number(c.interes_cobrado) - Number(c.descuento_banco))}
                </div>
                <div style="font-size: 0.7rem; color: var(--accent-rose);">
                  Desc. banco (${String(c.tasa_descuento_banco).replace('.', ',')}%): -${formatARS(c.descuento_banco)}
                </div>
              ` : `
                <div style="font-size: 0.78rem; color: var(--accent-emerald); font-weight: 600;">
                  +${formatARS(c.interes_cobrado)} (${String(c.tasa_interes).replace('.', ',')}%)
                </div>
                <div style="font-size: 0.72rem; color: var(--text-dim);">
                  Saliente: ${formatARS(c.dinero_saliente)}
                </div>
              `}
            </td>

            <!-- Columna 5: Acciones Uniformes (Cobrado, Entregar, Rechazado, Editar, Revertir, Eliminar) -->
            <td>
              ${c.estado === 'Pendiente' ? `
                <div class="table-actions-grid">
                  <button class="btn-action cobrar" onclick="CarteraModule.modalCobrar(${c.id}, '${c.numero}')" title="Registrar Cobro">
                    Cobrado
                  </button>
                  <button class="btn-action entregar" onclick="EntregadosModule.abrirModalEntregaConCheque(${c.id})" title="Entregar Cheque a Tercero">
                    Entregar
                  </button>
                  <button class="btn-action rechazar" onclick="CarteraModule.modalRechazar(${c.id}, '${c.numero}')" title="Marcar como Rechazado">
                    Rechazado
                  </button>
                  <button class="btn-action editar" onclick="CarteraModule.abrirModalEditar(${c.id})" title="Editar datos del Cheque">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    <span>Editar</span>
                  </button>
                  <button class="btn-action eliminar" onclick="CarteraModule.eliminarCheque(${c.id}, '${c.numero}')" title="Eliminar Cheque" style="flex: 1 1 100%;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    <span>Eliminar</span>
                  </button>
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <div>
                    <span class="badge-status ${estadoClass}">● ${c.estado}</span>
                    ${c.estado === 'Cobrado' && c.tipo_cobro ? `<div style="font-size: 0.68rem; color: var(--text-dim); margin-top: 2px;">${c.tipo_cobro === 'ANTICIPADO' ? 'Cobro anticipado' : 'Cobro en fecha'}</div>` : ''}
                    ${c.motivo_rechazo ? `<div style="font-size: 0.72rem; color: var(--accent-rose);">Motivo: ${c.motivo_rechazo}</div>` : ''}
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="CarteraModule.revertirACartera(${c.id}, '${c.numero}')" title="Revertir acción y devolver a Cartera como Pendiente" style="padding: 3px 8px; font-size: 0.74rem; color: var(--accent-amber); border-color: rgba(245, 158, 11, 0.45); display: inline-flex; align-items: center; gap: 4px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                      <span>Revertir</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="CarteraModule.abrirModalEditar(${c.id})" title="Editar datos del Cheque" style="padding: 3px 8px; font-size: 0.74rem; color: #38bdf8; border-color: rgba(14, 165, 233, 0.4); display: inline-flex; align-items: center; gap: 4px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      <span>Editar</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="CarteraModule.verDetalle(${c.id})" title="Ver Detalle" style="padding: 3px 8px; font-size: 0.74rem;">
                      Detalle
                    </button>
                    <button class="btn-icon" onclick="CarteraModule.eliminarCheque(${c.id}, '${c.numero}')" title="Eliminar" style="color: var(--accent-rose); width: 26px; height: 26px; margin-left: auto;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
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
                ${c.estado === 'Cobrado' && Number(c.descuento_banco) > 0 ? `
                  <span style="color: var(--accent-emerald); font-weight: 700;">Neta: +${formatARS(Number(c.interes_cobrado) - Number(c.descuento_banco))}</span>
                  <span style="color: var(--accent-rose); font-size: 0.72rem;">Desc. banco (${String(c.tasa_descuento_banco).replace('.', ',')}%): -${formatARS(c.descuento_banco)}</span>
                ` : `
                  <span style="color: var(--accent-emerald); font-weight: 700;">+${formatARS(c.interes_cobrado)} (${String(c.tasa_interes).replace('.', ',')}%)</span>
                  <span style="color: var(--text-dim);">Saliente: ${formatARS(c.dinero_saliente)}</span>
                `}
              </div>
            </div>

            <div class="card-meta-grid">
              <div>Emisor: <span class="val">${c.emisor}</span></div>
              <div>CUIT Emisor: <span class="val">${c.cuit_emisor || '-'}</span></div>
              <div>Entregó: <span class="val">${c.entregador}</span></div>
              <div>Cobro: <span class="val">${formatFecha(c.fecha_cobro)}</span></div>
              <div>Venc. legal: <span class="val">${met.fechaVencimientoLegal || '-'}</span></div>
            </div>

            ${c.motivo_rechazo ? `<div style="font-size: 0.75rem; color: var(--accent-rose); background: rgba(244,63,94,0.1); padding: 4px 8px; border-radius: 4px;">Motivo: ${c.motivo_rechazo}</div>` : ''}

            ${c.estado === 'Pendiente' ? `
              <div class="card-actions-row">
                <button class="btn-action cobrar" onclick="CarteraModule.modalCobrar(${c.id}, '${c.numero}')">
                  Cobrado
                </button>
                <button class="btn-action entregar" onclick="EntregadosModule.abrirModalEntregaConCheque(${c.id})">
                  Entregar
                </button>
                <button class="btn-action rechazar" onclick="CarteraModule.modalRechazar(${c.id}, '${c.numero}')">
                  Rechazado
                </button>
                <button class="btn-action editar" onclick="CarteraModule.abrirModalEditar(${c.id})">
                  Editar
                </button>
                <button class="btn-icon-uniform" onclick="CarteraModule.eliminarCheque(${c.id}, '${c.numero}')" title="Eliminar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            ` : `
              <div class="card-actions-row">
                <button class="btn-action revertir" onclick="CarteraModule.revertirACartera(${c.id}, '${c.numero}')">
                  Revertir
                </button>
                <button class="btn-action editar" onclick="CarteraModule.abrirModalEditar(${c.id})">
                  Editar
                </button>
                <button class="btn btn-secondary btn-sm" onclick="CarteraModule.verDetalle(${c.id})" style="flex: 1;">
                  Detalle
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

  chequeCobroActual: null,

  // Modal para Marcar como Cobrado (2 opciones: En Fecha con Impuesto o Anticipado con Tasa Bancaria)
  async modalCobrar(id, numero) {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.poblarSelectTasaBanco();

    let ch = this.cheques.find(c => c.id === id);
    if (!ch) {
      try {
        const res = await API.get(`/cheques/${id}`);
        ch = res.cheque;
      } catch (e) {
        showToast('No se pudo obtener la información del cheque.', 'error');
        return;
      }
    }

    this.chequeCobroActual = ch;
    const modal = document.getElementById('modalCobrarCheque');
    const resumenBox = document.getElementById('cobroChequeResumenBox');
    if (!modal) return;

    if (resumenBox) {
      resumenBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="font-size: 0.92rem; color: #fff; font-weight: 700;">
              Cheque #${ch.numero} • <span style="color: var(--primary);">${ch.banco}</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              Emisor: ${ch.emisor} | Cobro: ${formatFecha(ch.fecha_cobro)}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.05rem; font-weight: 700; color: #fff; font-family: 'Outfit', sans-serif;">
              ${formatARS(ch.importe)}
            </div>
            <div style="font-size: 0.75rem; color: var(--accent-emerald); font-weight: 600;">
              Interés cliente: +${formatARS(ch.interes_cobrado)} (${String(ch.tasa_interes).replace('.', ',')}%)
            </div>
          </div>
        </div>
      `;
    }

    // Resetear a opción por defecto: EN_FECHA con 1.2%
    const radioFecha = document.querySelector('input[name="tipoCobroCheque"][value="EN_FECHA"]');
    if (radioFecha) radioFecha.checked = true;
    const inputImpuesto = document.getElementById('inputCobroImpuesto');
    if (inputImpuesto) inputImpuesto.value = '1.2';
    const selectTasa = document.getElementById('selectCobroTasaBanco');
    if (selectTasa) selectTasa.value = '3';

    this.actualizarVistaTipoCobro();
    modal.classList.add('show');
  },

  actualizarVistaTipoCobro() {
    const tipo = document.querySelector('input[name="tipoCobroCheque"]:checked')?.value || 'EN_FECHA';
    const cardFecha = document.getElementById('cardOpcionCobroFecha');
    const cardAnticipado = document.getElementById('cardOpcionCobroAnticipado');
    const boxFecha = document.getElementById('boxCobroEnFecha');
    const boxAnticipado = document.getElementById('boxCobroAnticipado');

    if (cardFecha) cardFecha.classList.toggle('active', tipo === 'EN_FECHA');
    if (cardAnticipado) cardAnticipado.classList.toggle('active', tipo === 'ANTICIPADO');
    if (boxFecha) boxFecha.style.display = tipo === 'EN_FECHA' ? 'flex' : 'none';
    if (boxAnticipado) boxAnticipado.style.display = tipo === 'ANTICIPADO' ? 'flex' : 'none';

    this.actualizarCalculoCobroEnVivo();
  },

  actualizarCalculoCobroEnVivo() {
    const ch = this.chequeCobroActual;
    if (!ch) return;

    const tipo = document.querySelector('input[name="tipoCobroCheque"]:checked')?.value || 'EN_FECHA';
    let tasaBanco = 0;
    if (tipo === 'EN_FECHA') {
      tasaBanco = parseFloat(document.getElementById('inputCobroImpuesto')?.value) || 0;
    } else {
      tasaBanco = parseFloat(document.getElementById('selectCobroTasaBanco')?.value) || 0;
    }

    const importe = Number(ch.importe) || 0;
    const interesCliente = Number(ch.interes_cobrado) || 0;
    const descuentoBanco = Math.round((importe * (tasaBanco / 100)) * 100) / 100;
    const netoAcreditado = Math.round((importe - descuentoBanco) * 100) / 100;
    const gananciaFinal = Math.round((interesCliente - descuentoBanco) * 100) / 100;

    const lblNominal = document.getElementById('cobroPreviewNominal');
    const lblDescLabel = document.getElementById('cobroPreviewDescuentoLabel');
    const lblDescMonto = document.getElementById('cobroPreviewDescuentoMonto');
    const lblNeto = document.getElementById('cobroPreviewNetoBanco');
    const lblGanancia = document.getElementById('cobroPreviewGananciaFinal');

    const tasaTexto = String(tasaBanco).replace('.', ',');
    if (lblNominal) lblNominal.textContent = formatARS(importe);
    if (lblDescLabel) {
      lblDescLabel.textContent = tipo === 'EN_FECHA'
        ? `Impuesto al Cheque (${tasaTexto}%):`
        : `Interés Bancario Descuento (${tasaTexto}%):`;
    }
    if (lblDescMonto) lblDescMonto.textContent = `-${formatARS(descuentoBanco)}`;
    if (lblNeto) lblNeto.textContent = formatARS(netoAcreditado);
    if (lblGanancia) {
      lblGanancia.textContent = `${gananciaFinal >= 0 ? '+' : ''}${formatARS(gananciaFinal)}`;
      lblGanancia.style.color = gananciaFinal >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    }
  },

  cerrarModalCobrar() {
    const modal = document.getElementById('modalCobrarCheque');
    if (modal) modal.classList.remove('show');
    this.chequeCobroActual = null;
  },

  handleConfirmarCobro(e) {
    e.preventDefault();
    if (!this.chequeCobroActual) return;

    const id = this.chequeCobroActual.id;
    const tipoCobro = document.querySelector('input[name="tipoCobroCheque"]:checked')?.value || 'EN_FECHA';
    const tasaDescuentoBanco = tipoCobro === 'EN_FECHA'
      ? (parseFloat(document.getElementById('inputCobroImpuesto')?.value) || 0)
      : (parseFloat(document.getElementById('selectCobroTasaBanco')?.value) || 0);

    this.cerrarModalCobrar();
    this.ejecutarCambioEstado(id, 'Cobrado', null, tipoCobro, tasaDescuentoBanco);
  },

  chequeRechazoId: null,

  // Modal para Marcar como Rechazado (Motivo Opcional)
  modalRechazar(id, numero) {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.chequeRechazoId = id;
    const modal = document.getElementById('modalRechazoCheque');
    const input = document.getElementById('rechazoMotivoInput');
    const txt = document.getElementById('rechazoChequeTexto');
    if (modal) {
      if (input) input.value = '';
      if (txt) txt.innerHTML = `¿Confirmar estado Rechazado para el Cheque <strong>#${numero}</strong>?`;
      modal.classList.add('show');
      setTimeout(() => input?.focus(), 100);
    }
  },

  cerrarModalRechazo() {
    const modal = document.getElementById('modalRechazoCheque');
    if (modal) modal.classList.remove('show');
    this.chequeRechazoId = null;
  },

  handleConfirmarRechazo(e) {
    e.preventDefault();
    if (!this.chequeRechazoId) return;
    const id = this.chequeRechazoId;
    const motivo = document.getElementById('rechazoMotivoInput')?.value.trim() || null;
    this.cerrarModalRechazo();
    this.ejecutarCambioEstado(id, 'Rechazado', motivo);
  },

  async ejecutarCambioEstado(id, nuevoEstado, motivoRechazo = null, tipoCobro = null, tasaDescuentoBanco = 0) {
    try {
      const res = await API.patch(`/cheques/${id}/estado`, {
        nuevoEstado,
        motivoRechazo,
        tipoCobro,
        tasaDescuentoBanco
      });
      showToast(res.mensaje, 'success');
      this.cargarCheques();
      if (typeof DashboardModule !== 'undefined' && DashboardModule.initialized) {
        DashboardModule.cargarMetricas();
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  },

  async revertirACartera(id, numero) {
    if (!confirm(`¿Confirmás revertir el cheque #${numero} a la Cartera?\n\nVolverá al estado PENDIENTE y se cancelará el registro de su cobro o rechazo.`)) {
      return;
    }
    try {
      const res = await API.patch(`/cheques/${id}/estado`, { nuevoEstado: 'Pendiente' });
      showToast(res.mensaje || `Cheque #${numero} devuelto a Cartera como Pendiente.`, 'success');
      this.cargarCheques();
      if (typeof DashboardModule !== 'undefined' && DashboardModule.initialized) {
        DashboardModule.cargarMetricas();
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  },

  // ==========================================
  // MODAL EDITAR CHEQUE
  // ==========================================
  chequeEdicionActual: null,

  async abrirModalEditar(chequeId) {
    try {
      const res = await API.get(`/cheques/${chequeId}`);
      const ch = res.cheque;
      this.chequeEdicionActual = ch;

      const modal = document.getElementById('modalEditarCheque');
      if (!modal) return;

      document.getElementById('editChequeId').value = ch.id;
      document.getElementById('editChequeNumero').value = ch.numero || '';
      document.getElementById('editChequeEmisor').value = ch.emisor || '';
      document.getElementById('editChequeCuit').value = ch.cuit_emisor || '';
      document.getElementById('editChequeFechaRecepcion').value = ch.fecha_recepcion ? ch.fecha_recepcion.split('T')[0] : '';
      document.getElementById('editChequeFechaCobro').value = ch.fecha_cobro ? ch.fecha_cobro.split('T')[0] : '';
      document.getElementById('editChequeImporte').value = ch.importe || '';
      document.getElementById('editChequeNotas').value = ch.notas || '';

      const badgeCuit = document.getElementById('editChequeCuitBadge');
      if (badgeCuit) {
        badgeCuit.style.display = 'none';
        badgeCuit.innerHTML = '';
      }

      // Cargar clientes en select de entregador
      await this.cargarComboEntregadorEdicion(ch.entregador);

      // Cargar bancos en select de banco
      await this.cargarComboBancosEdicion(ch.banco);

      // Asignar tasa de interés editable a mano
      const editTasaInput = document.getElementById('editChequeTasa');
      if (editTasaInput) {
        editTasaInput.value = (ch.tasa_interes !== undefined && ch.tasa_interes !== null) ? ch.tasa_interes : '5';
      }

      // Calcular preview inicial
      this.calcularEditEnVivo();

      modal.classList.add('show');
    } catch (err) {
      showToast('Error al cargar datos del cheque para editar: ' + err.message, 'error');
    }
  },

  cerrarModalEditar() {
    const modal = document.getElementById('modalEditarCheque');
    if (modal) modal.classList.remove('show');
    this.chequeEdicionActual = null;
  },

  async cargarComboEntregadorEdicion(entregadorActual = '') {
    const select = document.getElementById('editChequeEntregador');
    if (!select) return;

    try {
      const res = await API.get('/clientes');
      const clientes = res.clientes || [];
      const opts = ['<option value="">-- Seleccionar cliente --</option>'];

      let encontrado = false;
      clientes.forEach(cl => {
        const sel = cl.nombre === entregadorActual ? 'selected' : '';
        if (sel) encontrado = true;
        opts.push(`<option value="${ConsultasModule.escapeHtml(cl.nombre)}" ${sel}>${ConsultasModule.escapeHtml(cl.nombre)}</option>`);
      });

      if (entregadorActual && !encontrado) {
        opts.push(`<option value="${ConsultasModule.escapeHtml(entregadorActual)}" selected>${ConsultasModule.escapeHtml(entregadorActual)}</option>`);
      }

      select.innerHTML = opts.join('');
    } catch (e) {
      console.warn('Error al cargar clientes en modal editar:', e);
      if (entregadorActual) {
        select.innerHTML = `<option value="${ConsultasModule.escapeHtml(entregadorActual)}" selected>${ConsultasModule.escapeHtml(entregadorActual)}</option>`;
      }
    }
  },

  async cargarComboBancosEdicion(bancoActual = '') {
    const select = document.getElementById('editChequeBanco');
    const inputOtro = document.getElementById('editChequeBancoOtro');
    if (!select) return;

    const bancosPrincipales = [
      'Banco Santander',
      'Banco Galicia',
      'Banco BBVA',
      'Banco Macro',
      'Banco Nación',
      'Banco Provincia',
      'Banco Ciudad',
      'Banco Credicoop',
      'Banco ICBC',
      'Banco HSBC',
      'Banco Patagonia',
      'Banco Supervielle',
      'Banco Comafi',
      'Banco Hipotecario',
      'Banco de Córdoba (Bancor)',
      'Banco de Santa Fe',
      'Banco Entre Ríos',
      'Banco del Chaco',
      'Banco San Juan',
      'Banco Columbia',
      'Banco Roela',
      'Brubank',
      'Ualá / Wilobank'
    ];

    let entidadesBcra = [];
    try {
      if (typeof ConsultasModule !== 'undefined' && typeof ConsultasModule.cargarEntidades === 'function') {
        entidadesBcra = await ConsultasModule.cargarEntidades();
      }
    } catch (e) {
      // ignore
    }

    const opts = ['<option value="">-- Seleccionar Banco --</option>'];
    let coincidencia = false;

    bancosPrincipales.forEach(b => {
      const isSel = b.toLowerCase() === (bancoActual || '').toLowerCase();
      if (isSel) coincidencia = true;
      opts.push(`<option value="${b}" ${isSel ? 'selected' : ''}>${b}</option>`);
    });

    if (entidadesBcra && entidadesBcra.length > 0) {
      opts.push('<optgroup label="Otras Entidades Financieras BCRA">');
      entidadesBcra.forEach(ent => {
        if (!bancosPrincipales.some(b => b.toLowerCase().includes(ent.denominacion.toLowerCase()))) {
          const isSel = ent.denominacion.toLowerCase() === (bancoActual || '').toLowerCase();
          if (isSel) coincidencia = true;
          opts.push(`<option value="${ConsultasModule.escapeHtml(ent.denominacion)}" ${isSel ? 'selected' : ''}>${ConsultasModule.escapeHtml(ent.denominacion)}</option>`);
        }
      });
      opts.push('</optgroup>');
    }

    opts.push('<option value="OTRO">Otro banco / Entidad no listada...</option>');
    select.innerHTML = opts.join('');

    if (bancoActual && !coincidencia) {
      select.value = 'OTRO';
      if (inputOtro) {
        inputOtro.style.display = 'block';
        inputOtro.value = bancoActual;
      }
    } else {
      if (inputOtro) {
        inputOtro.style.display = 'none';
        inputOtro.value = '';
      }
    }
  },

  obtenerTasaEdicion() {
    const input = document.getElementById('editChequeTasa');
    if (!input) return 0;
    const num = parseFloat(String(input.value || '').replace(',', '.'));
    return isNaN(num) ? 0 : Math.max(0, num);
  },

  calcularEditEnVivo() {
    const importeEl = document.getElementById('editChequeImporte');
    const fechaRecepEl = document.getElementById('editChequeFechaRecepcion');
    const fechaCobroEl = document.getElementById('editChequeFechaCobro');

    const importe = parseFloat(importeEl?.value) || 0;
    const tasa = this.obtenerTasaEdicion();

    const interesCobrado = Math.round((importe * (tasa / 100)) * 100) / 100;
    const dineroSaliente = Math.round((importe - interesCobrado) * 100) / 100;

    let diasPlazo = 0;
    if (fechaRecepEl?.value && fechaCobroEl?.value) {
      const f1 = new Date(fechaRecepEl.value);
      const f2 = new Date(fechaCobroEl.value);
      const diffMs = f2.getTime() - f1.getTime();
      diasPlazo = Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    const previewImporte = document.getElementById('editPreviewImporte');
    const previewInteres = document.getElementById('editPreviewInteres');
    const previewSaliente = document.getElementById('editPreviewSaliente');
    const previewDias = document.getElementById('editPreviewDias');

    if (previewImporte) previewImporte.textContent = formatARS(importe);
    if (previewInteres) previewInteres.textContent = formatARS(interesCobrado);
    if (previewSaliente) previewSaliente.textContent = formatARS(dineroSaliente);
    if (previewDias) previewDias.textContent = diasPlazo >= 0 ? `${diasPlazo} días` : 'Fecha cobro anterior a recepción';
  },

  async consultarBcraDesdeEdicion() {
    const inputCuit = document.getElementById('editChequeCuit');
    const badge = document.getElementById('editChequeCuitBadge');
    const cuitRaw = inputCuit?.value || '';
    const cuitDigitos = cuitRaw.replace(/\D/g, '');

    if (!/^\d{11}$/.test(cuitDigitos)) {
      showToast('Ingresá un CUIT válido de 11 dígitos para consultar el BCRA.', 'error');
      inputCuit?.focus();
      return;
    }

    if (badge) {
      badge.style.display = 'block';
      badge.className = 'bcra-inline-status cargando';
      badge.innerHTML = `<span>Consultando BCRA...</span>`;
    }

    try {
      const res = await API.get(`/bcra/deudores/${cuitDigitos}`);
      const sitMax = res.resumen?.peorSituacion || 1;
      const tieneRechazos = (res.resumen?.chequesRechazadosCount || 0) > 0;

      if (badge) {
        if (sitMax >= 3 || tieneRechazos) {
          badge.className = 'bcra-inline-status alerta';
          badge.innerHTML = `<span>⚠️ BCRA: Sit. ${sitMax}${tieneRechazos ? ` • ${res.resumen.chequesRechazadosCount} rechazo(s)` : ''}</span>`;
        } else {
          badge.className = 'bcra-inline-status normal';
          badge.innerHTML = `<span>✓ BCRA: Sit. ${sitMax} (Normal)</span>`;
        }
      }

      if (typeof IngresoModule !== 'undefined' && typeof IngresoModule.abrirModalReporteBcra === 'function') {
        IngresoModule.abrirModalReporteBcra(res);
      }
    } catch (e) {
      if (badge) {
        badge.className = 'bcra-inline-status';
        badge.innerHTML = `<span style="color: var(--accent-rose);">Error al consultar BCRA</span>`;
      }
      showToast('Error consultando BCRA: ' + e.message, 'error');
    }
  },

  async handleConfirmarEdicion(e) {
    e.preventDefault();
    const id = document.getElementById('editChequeId')?.value;
    if (!id) return;

    const btnSubmit = document.getElementById('btnSubmitEditCheque');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Guardando...</span>';
    }

    try {
      const bancoSelect = document.getElementById('editChequeBanco');
      const bancoOtro = document.getElementById('editChequeBancoOtro');
      const banco = bancoSelect.value === 'OTRO' ? bancoOtro.value.trim() : bancoSelect.value;

      const cuitRaw = document.getElementById('editChequeCuit')?.value || '';
      const cuitDigitos = cuitRaw.replace(/\D/g, '');
      if (!/^\d{11}$/.test(cuitDigitos)) {
        showToast('El CUIT del Emisor debe tener 11 dígitos numéricos.', 'error');
        document.getElementById('editChequeCuit')?.focus();
        return;
      }

      const tasaValor = this.obtenerTasaEdicion();
      if (isNaN(tasaValor) || tasaValor < 0) {
        showToast('La tasa de interés debe ser un número válido.', 'error');
        return;
      }

      const payload = {
        numero: document.getElementById('editChequeNumero').value.trim(),
        banco: banco,
        emisor: document.getElementById('editChequeEmisor').value.trim(),
        cuit_emisor: cuitDigitos,
        entregador: document.getElementById('editChequeEntregador').value.trim(),
        fecha_recepcion: document.getElementById('editChequeFechaRecepcion').value,
        fecha_cobro: document.getElementById('editChequeFechaCobro').value,
        importe: parseFloat(document.getElementById('editChequeImporte').value),
        tasa_interes: tasaValor,
        notas: document.getElementById('editChequeNotas')?.value.trim() || ''
      };

      const res = await API.put(`/cheques/${id}`, payload);
      showToast(res.mensaje || 'Cheque actualizado exitosamente.', 'success');
      this.cerrarModalEditar();
      await this.cargarCheques();
      if (typeof DashboardModule !== 'undefined' && DashboardModule.initialized) {
        DashboardModule.cargarMetricas();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Guardar Cambios</span>';
      }
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
      const descBanco = Number(ch.descuento_banco) || 0;
      const gananciaNeta = Math.round(((Number(ch.interes_cobrado) || 0) - descBanco) * 100) / 100;
      const infoCobro = ch.estado === 'Cobrado'
        ? `\nModalidad Cobro: ${ch.tipo_cobro === 'ANTICIPADO' ? 'Anticipado (Venta al banco)' : 'En fecha (Impuesto al cheque)'}\nDescuento Banco (${ch.tasa_descuento_banco || 0}%): -${formatARS(descBanco)}\nGanancia Neta Final: ${formatARS(gananciaNeta)}`
        : '';
      alert(`INFORMACIÓN DEL CHEQUE N° ${ch.numero}\n\nBanco: ${ch.banco}\nEmisor: ${ch.emisor}${ch.cuit_emisor ? `\nCUIT Emisor: ${ch.cuit_emisor}` : ''}\nEntregador: ${ch.entregador}\nImporte: ${formatARS(ch.importe)}\nTasa: ${ch.tasa_interes}%\nGanancia Interés Inicial: ${formatARS(ch.interes_cobrado)}${infoCobro}\nEstado: ${ch.estado}\nFecha Cobro: ${formatFecha(ch.fecha_cobro)}\nVencimiento Legal (30d): ${ch.metricas?.fechaVencimientoLegal || '-'}\n${ch.notas ? 'Notas: ' + ch.notas : ''}`);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }
};
