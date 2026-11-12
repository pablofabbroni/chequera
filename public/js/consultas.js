// Módulo de Consultas Oficiales BCRA (Central de Deudores + Cheques Denunciados)

const ConsultasModule = {
  initialized: false,
  entidadesBcra: [],
  entidadesCargadas: false,

  async init() {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    await this.cargarEntidades();
  },

  bindEvents() {
    // Subpestañas
    const tabs = document.querySelectorAll('.bcra-subtab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');

        const panelDeudores = document.getElementById('panelBcraDeudores');
        const panelDenunciados = document.getElementById('panelBcraDenunciados');
        if (panelDeudores) panelDeudores.style.display = target === 'deudores' ? 'block' : 'none';
        if (panelDenunciados) panelDenunciados.style.display = target === 'denunciados' ? 'block' : 'none';
      });
    });

    // Form Central de Deudores
    const formDeudores = document.getElementById('formBcraDeudores');
    if (formDeudores) {
      formDeudores.onsubmit = (e) => this.handleConsultarDeudores(e);
    }

    // Form Cheques Denunciados
    const formDenunciados = document.getElementById('formBcraDenunciados');
    if (formDenunciados) {
      formDenunciados.onsubmit = (e) => this.handleConsultarDenunciado(e);
    }
  },

  async cargarEntidades() {
    if (this.entidadesCargadas && this.entidadesBcra.length > 0) return this.entidadesBcra;
    try {
      const res = await API.get('/bcra/entidades');
      this.entidadesBcra = res.entidades || [];
      this.entidadesCargadas = true;
      this.poblarSelectEntidades('selectBcraBanco');
    } catch (e) {
      console.warn('Error cargando entidades BCRA:', e.message);
    }
    return this.entidadesBcra;
  },

  poblarSelectEntidades(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const valorActual = select.value;
    select.innerHTML = `
      <option value="">-- Seleccionar Entidad Bancaria --</option>
      ${this.entidadesBcra.map(e => `<option value="${e.codigoEntidad}">${e.denominacion} (Cód. ${e.codigoEntidad})</option>`).join('')}
    `;
    if (valorActual) select.value = valorActual;
  },

  limpiarCuit(val = '') {
    return String(val).replace(/\D/g, '');
  },

  escapeHtml(str = '') {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatPeriodo(periodo = '') {
    const p = String(periodo || '');
    if (p.length === 6) {
      return `${p.slice(4, 6)}/${p.slice(0, 4)}`;
    }
    return p || '-';
  },

  getSituacionBadge(sit) {
    const num = Number(sit) || 1;
    let cls = 'sit-1';
    if (num === 2) cls = 'sit-2';
    else if (num >= 3) cls = 'sit-danger';
    return `<span class="bcra-sit-badge ${cls}">Sit. ${num}</span>`;
  },

  async handleConsultarDeudores(e) {
    e.preventDefault();
    const input = document.getElementById('inputBcraCuit');
    const cont = document.getElementById('bcraDeudoresResultado');
    const btn = document.getElementById('btnBuscarBcraCuit');

    const cuit = this.limpiarCuit(input?.value || '');
    if (!/^\d{11}$/.test(cuit)) {
      showToast('Ingresá un CUIT / CUIL / CDI válido de 11 dígitos.', 'error');
      input?.focus();
      return;
    }

    if (btn) btn.disabled = true;
    if (cont) {
      cont.innerHTML = `<div class="bcra-loading">Consultando Central de Deudores y Cheques Rechazados en BCRA...</div>`;
    }

    try {
      const data = await API.get(`/bcra/deudores/${cuit}`);
      if (cont) {
        cont.innerHTML = this.renderReporteDeudoresHTML(data, { compacto: false });
      }
    } catch (error) {
      if (cont) {
        cont.innerHTML = `<div class="bcra-alert-box critico">${this.escapeHtml(error.message)}</div>`;
      }
      showToast(error.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async handleConsultarDenunciado(e) {
    e.preventDefault();
    const selectBanco = document.getElementById('selectBcraBanco');
    const inputNum = document.getElementById('inputBcraNumeroCheque');
    const cont = document.getElementById('bcraDenunciadosResultado');
    const btn = document.getElementById('btnBuscarBcraCheque');

    const codigoEntidad = selectBanco?.value || '';
    const numeroCheque = (inputNum?.value || '').replace(/\D/g, '');

    if (!codigoEntidad || !numeroCheque) {
      showToast('Seleccioná una entidad bancaria e ingresá un número de cheque numérico.', 'error');
      return;
    }

    if (btn) btn.disabled = true;
    if (cont) {
      cont.innerHTML = `<div class="bcra-loading">Verificando cheque #${this.escapeHtml(numeroCheque)} en BCRA...</div>`;
    }

    try {
      const params = new URLSearchParams({ codigoEntidad, numeroCheque });
      const data = await API.get(`/bcra/cheques-denunciados?${params.toString()}`);
      if (cont) {
        cont.innerHTML = this.renderResultadoDenunciadoHTML(data);
      }
    } catch (error) {
      if (cont) {
        cont.innerHTML = `<div class="bcra-alert-box critico">${this.escapeHtml(error.message)}</div>`;
      }
      showToast(error.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  renderReporteDeudoresHTML(data, { compacto = false } = {}) {
    const ev = data.evaluacion || { nivel: 'LIMPIO', titulo: '', alertas: [] };
    const res = data.resumen || {};

    let nivelClass = 'limpio';
    let icono = '✅';
    if (ev.nivel === 'CRITICO') {
      nivelClass = 'critico';
      icono = '🚨';
    } else if (ev.nivel === 'PRECAUCION') {
      nivelClass = 'precaucion';
      icono = '⚠️';
    } else if (ev.nivel === 'NO_DISPONIBLE') {
      nivelClass = 'precaucion';
      icono = '🔌';
    }

    const alertasHTML = (ev.alertas || []).length > 0
      ? `
        <ul class="bcra-alerts-list">
          ${ev.alertas.map(a => `
            <li class="bcra-alert-item ${a.severidad}">
              <span>${a.severidad === 'critica' ? '🔴' : '🟡'}</span>
              <span>${this.escapeHtml(a.texto)}</span>
            </li>
          `).join('')}
        </ul>
      `
      : '';

    const kpisHTML = `
      <div class="bcra-kpi-grid">
        <div class="bcra-kpi-item">
          <span class="bcra-kpi-label">Denominación / AFIP</span>
          <strong class="bcra-kpi-val">${this.escapeHtml(data.denominacion || 'Sin datos registrados')}</strong>
          <span class="bcra-kpi-sub">CUIT: ${this.escapeHtml(data.cuitFormateado)}</span>
        </div>
        <div class="bcra-kpi-item">
          <span class="bcra-kpi-label">Peor Situación Actual</span>
          <strong class="bcra-kpi-val">${res.peorSituacion ? `Situación ${res.peorSituacion}` : 'Sin deuda'}</strong>
          <span class="bcra-kpi-sub">${this.escapeHtml(res.peorSituacionDesc || '')}</span>
        </div>
        <div class="bcra-kpi-item">
          <span class="bcra-kpi-label">Deuda Total Informada</span>
          <strong class="bcra-kpi-val">${formatARS(res.totalDeudaPesos || 0)}</strong>
          <span class="bcra-kpi-sub">${res.cantidadEntidades || 0} entidad(es) • Período ${this.formatPeriodo(data.periodoActual)}</span>
        </div>
        <div class="bcra-kpi-item">
          <span class="bcra-kpi-label">Cheques Rechazados (CUIT)</span>
          <strong class="bcra-kpi-val" style="color: ${res.chequesImpagos > 0 ? 'var(--accent-rose)' : '#fff'};">
            ${res.totalChequesRechazados || 0} (${res.chequesImpagos || 0} impagos)
          </strong>
          <span class="bcra-kpi-sub">Total rechazado: ${formatARS(res.montoRechazadoPesos || 0)}</span>
        </div>
      </div>
    `;

    // Entidades del último período
    const entidades = data.entidadesActuales || [];
    const entidadesHTML = entidades.length > 0
      ? `
        <div class="bcra-section-block">
          <h4>Deudas Informadas (Último Período: ${this.formatPeriodo(data.periodoActual)})</h4>
          <div class="table-responsive desktop-table-view">
            <table class="custom-table" style="font-size: 0.82rem;">
              <thead>
                <tr>
                  <th style="width: 32%;">Entidad</th>
                  <th style="width: 14%;">Situación</th>
                  <th style="width: 18%;">Monto ($)</th>
                  <th style="width: 12%;">Atraso</th>
                  <th style="width: 24%;">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                ${entidades.map(ent => {
                  const flags = [];
                  if (ent.refinanciaciones) flags.push('Refinanciación');
                  if (ent.recategorizacionOblig) flags.push('Recategorización');
                  if (ent.situacionJuridica) flags.push('Sit. Jurídica');
                  if (ent.irrecDisposicionTecnica) flags.push('Irrec. Disp. Téc.');
                  if (ent.procesoJud) flags.push('Proceso Judicial');
                  if (ent.enRevision) flags.push('En Revisión');
                  return `
                    <tr>
                      <td style="font-weight: 600; color: #fff;">${this.escapeHtml(ent.entidad)}</td>
                      <td>${this.getSituacionBadge(ent.situacion)}</td>
                      <td style="font-family: 'Outfit', sans-serif; font-weight: 700;">${formatARS(ent.montoPesos)}</td>
                      <td>${ent.diasAtrasoPago > 0 ? `<span style="color: var(--accent-rose); font-weight: 700;">${ent.diasAtrasoPago}d</span>` : '0d'}</td>
                      <td style="font-size: 0.76rem; color: ${flags.length ? '#fb7185' : 'var(--text-dim)'};">
                        ${flags.length ? this.escapeHtml(flags.join(' • ')) : 'Normal'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="mobile-cards-view">
            ${entidades.map(ent => `
              <div class="check-card-item">
                <div class="card-row-top">
                  <span class="card-check-num" style="font-size: 0.85rem;">${this.escapeHtml(ent.entidad)}</span>
                  ${this.getSituacionBadge(ent.situacion)}
                </div>
                <div class="card-meta-grid">
                  <div>Monto: <span class="val">${formatARS(ent.montoPesos)}</span></div>
                  <div>Atraso: <span class="val">${ent.diasAtrasoPago} días</span></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : `<div class="bcra-empty-sub">No registra financiaciones informadas en el último período de la Central de Deudores.</div>`;

    // Cheques rechazados del CUIT
    const rechazados = data.chequesRechazados || [];
    const rechazadosLimit = compacto ? rechazados.slice(0, 10) : rechazados;
    const rechazadosHTML = rechazados.length > 0
      ? `
        <div class="bcra-section-block">
          <h4>Cheques Rechazados del CUIT (${rechazados.length}${compacto && rechazados.length > 10 ? ' — mostrando últimos 10' : ''})</h4>
          <div class="table-responsive desktop-table-view">
            <table class="custom-table" style="font-size: 0.82rem;">
              <thead>
                <tr>
                  <th style="width: 16%;">N° Cheque</th>
                  <th style="width: 22%;">Causal</th>
                  <th style="width: 15%;">Fecha Rechazo</th>
                  <th style="width: 17%;">Monto ($)</th>
                  <th style="width: 15%;">Pago Cheque</th>
                  <th style="width: 15%;">Estado Multa</th>
                </tr>
              </thead>
              <tbody>
                ${rechazadosLimit.map(ch => `
                  <tr>
                    <td style="font-weight: 700; color: #fff;">#${this.escapeHtml(ch.nroCheque)}</td>
                    <td style="color: #fbbf24; font-weight: 600;">${this.escapeHtml(ch.causal)}</td>
                    <td>${formatFecha(ch.fechaRechazo)}</td>
                    <td style="font-family: 'Outfit', sans-serif; font-weight: 700;">${formatARS(ch.monto)}</td>
                    <td>${ch.fechaPago ? `<span style="color: var(--accent-emerald);">${formatFecha(ch.fechaPago)}</span>` : '<span style="color: var(--accent-rose); font-weight: 700;">Impago</span>'}</td>
                    <td>${ch.fechaPagoMulta ? `<span style="color: var(--accent-emerald);">Paga (${formatFecha(ch.fechaPagoMulta)})</span>` : `<span style="color: var(--accent-rose); font-weight: 700;">${this.escapeHtml(ch.estadoMulta || '-')}</span>`}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="mobile-cards-view">
            ${rechazadosLimit.map(ch => `
              <div class="check-card-item status-rechazado">
                <div class="card-row-top">
                  <span class="card-check-num">#${this.escapeHtml(ch.nroCheque)}</span>
                  <span class="badge-status rechazado">${this.escapeHtml(ch.causal)}</span>
                </div>
                <div class="card-meta-grid">
                  <div>Fecha: <span class="val">${formatFecha(ch.fechaRechazo)}</span></div>
                  <div>Monto: <span class="val">${formatARS(ch.monto)}</span></div>
                  <div>Pago: <span class="val">${ch.fechaPago ? formatFecha(ch.fechaPago) : 'Impago'}</span></div>
                  <div>Multa: <span class="val">${ch.fechaPagoMulta ? 'Paga' : (ch.estadoMulta || '-')}</span></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : `<div class="bcra-empty-sub">No registra cheques rechazados en el BCRA para este CUIT.</div>`;

    // Historial 24 meses (solo en la vista completa del módulo Consultas)
    let historialHTML = '';
    if (!compacto) {
      const periodos = data.historialPeriodos || [];
      historialHTML = periodos.length > 0
        ? `
          <div class="bcra-section-block">
            <h4>Historial Crediticio (Últimos 24 meses)</h4>
            <div class="table-responsive desktop-table-view">
              <table class="custom-table" style="font-size: 0.82rem;">
                <thead>
                  <tr>
                    <th style="width: 16%;">Período</th>
                    <th style="width: 18%;">Peor Situación</th>
                    <th style="width: 24%;">Deuda Total ($)</th>
                    <th style="width: 42%;">Entidades</th>
                  </tr>
                </thead>
                <tbody>
                  ${periodos.map(p => `
                    <tr>
                      <td style="font-weight: 700; color: #fff;">${this.formatPeriodo(p.periodo)}</td>
                      <td>${this.getSituacionBadge(p.peorSituacion)}</td>
                      <td style="font-family: 'Outfit', sans-serif; font-weight: 700;">${formatARS(p.totalPesos)}</td>
                      <td style="font-size: 0.76rem; color: var(--text-muted);">
                        ${p.entidades.map(e => `${this.escapeHtml(e.entidad)} (Sit. ${e.situacion})`).join(' | ')}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="mobile-cards-view">
              ${periodos.slice(0, 12).map(p => `
                <div class="check-card-item">
                  <div class="card-row-top">
                    <span class="card-check-num">Período ${this.formatPeriodo(p.periodo)}</span>
                    ${this.getSituacionBadge(p.peorSituacion)}
                  </div>
                  <div class="card-meta-grid">
                    <div>Total: <span class="val">${formatARS(p.totalPesos)}</span></div>
                    <div>Entidades: <span class="val">${p.entidades.length}</span></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `
        : `<div class="bcra-empty-sub">No registra historial crediticio en los últimos 24 meses.</div>`;
    }

    return `
      <div class="bcra-alert-box ${nivelClass}">
        <div class="bcra-alert-title">${icono} ${this.escapeHtml(ev.titulo)}</div>
        ${alertasHTML}
      </div>
      ${kpisHTML}
      ${entidadesHTML}
      ${rechazadosHTML}
      ${historialHTML}
    `;
  },

  renderResultadoDenunciadoHTML(data) {
    if (!data.servicioDisponible) {
      return `
        <div class="bcra-alert-box precaucion">
          <div class="bcra-alert-title">🔌 ${this.escapeHtml(data.mensaje || 'Servicio BCRA no disponible')}</div>
        </div>
      `;
    }

    if (data.denunciado) {
      const detalles = data.detalles || [];
      return `
        <div class="bcra-alert-box critico">
          <div class="bcra-alert-title">🚨 ¡CHEQUE DENUNCIADO EN BCRA! — N° ${this.escapeHtml(data.numeroCheque)}</div>
          <p style="font-size: 0.86rem; margin-top: 6px; color: #fecdd3;">
            Entidad: <strong>${this.escapeHtml(data.denominacionEntidad)}</strong> (Cód. ${this.escapeHtml(data.codigoEntidad)})
            ${data.fechaProcesamiento ? ` • Procesado: ${formatFecha(data.fechaProcesamiento)}` : ''}
          </p>
        </div>

        ${detalles.length > 0 ? `
          <div class="bcra-section-block" style="margin-top: 14px;">
            <h4>Detalles de la Denuncia (${detalles.length})</h4>
            <div class="table-responsive">
              <table class="custom-table" style="font-size: 0.84rem;">
                <thead>
                  <tr>
                    <th style="width: 22%;">Sucursal</th>
                    <th style="width: 34%;">N° de Cuenta</th>
                    <th style="width: 44%;">Causal</th>
                  </tr>
                </thead>
                <tbody>
                  ${detalles.map(d => `
                    <tr>
                      <td style="font-weight: 600; color: #fff;">${this.escapeHtml(d.sucursal ?? '-')}</td>
                      <td style="font-family: 'Outfit', sans-serif;">${this.escapeHtml(d.numeroCuenta ?? '-')}</td>
                      <td style="color: #fb7185; font-weight: 700;">${this.escapeHtml(d.causal || 'Denunciado')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      `;
    }

    return `
      <div class="bcra-alert-box limpio">
        <div class="bcra-alert-title">✅ Cheque sin denuncia registrada — N° ${this.escapeHtml(data.numeroCheque)}</div>
        <p style="font-size: 0.85rem; margin-top: 6px; color: #d1fae5;">
          ${this.escapeHtml(data.denominacionEntidad ? `Entidad: ${data.denominacionEntidad} (Cód. ${data.codigoEntidad}). ` : '')}
          ${this.escapeHtml(data.mensaje || 'No registra denuncia en el Banco Central.')}
          ${data.fechaProcesamiento ? ` (Actualizado al ${formatFecha(data.fechaProcesamiento)})` : ''}
        </p>
      </div>
    `;
  }
};
