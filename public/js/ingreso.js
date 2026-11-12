// Módulo de Ingreso de Cheques con Cálculos Financieros Reactivos y Gestión Integrada de Clientes

const IngresoModule = {
  initialized: false,
  isSubmitting: false,
  clientes: [],
  ultimoCuitConsultado: null,
  ultimoReporteCuit: null,
  ultimaConsultaChequeKey: null,
  chequeTimer: null,

  async init() {
    this.poblarSelectTasas();
    this.resetFechas();
    await this.cargarComboClientes();
    await this.cargarBancosAdicionalesBcra();

    if (this.initialized) {
      this.calcularEnVivo();
      return;
    }
    this.initialized = true;

    const form = document.getElementById('formIngresoCheque');
    if (!form) return;

    // Escuchar cambios reactivos para calcular en vivo
    const importeInput = document.getElementById('inputImporte');
    const tasaInput = document.getElementById('inputTasa');
    const fechaRecepInput = document.getElementById('inputFechaRecepcion');
    const fechaCobroInput = document.getElementById('inputFechaCobro');

    if (importeInput) importeInput.addEventListener('input', () => this.calcularEnVivo());
    if (tasaInput) {
      tasaInput.addEventListener('change', () => this.calcularEnVivo());
      tasaInput.addEventListener('input', () => this.calcularEnVivo());
    }
    if (fechaRecepInput) fechaRecepInput.addEventListener('change', () => this.calcularEnVivo());
    if (fechaCobroInput) fechaCobroInput.addEventListener('change', () => this.calcularEnVivo());

    form.addEventListener('reset', () => {
      setTimeout(() => {
        if (tasaInput) tasaInput.value = '5';
        this.resetBcraStatus();
        this.resetFechas();
        this.calcularEnVivo();
      }, 10);
    });

    // Banco selector custom
    // Banco selector custom + verificación de cheque denunciado en BCRA
    const bancoSelect = document.getElementById('selectBanco');
    const bancoOtroInput = document.getElementById('inputBancoOtro');
    const numChequeInput = document.getElementById('inputNumeroCheque');
    const btnVerificarCheque = document.getElementById('btnVerificarChequeBcra');

    if (bancoSelect && bancoOtroInput) {
      bancoSelect.addEventListener('change', (e) => {
        if (e.target.value === 'OTRO') {
          bancoOtroInput.style.display = 'block';
          bancoOtroInput.required = true;
          bancoOtroInput.focus();
        } else {
          bancoOtroInput.style.display = 'none';
          bancoOtroInput.required = false;
        }
        this.programarVerificacionCheque(150);
      });
    }

    if (numChequeInput) {
      numChequeInput.addEventListener('input', () => this.programarVerificacionCheque(650));
      numChequeInput.addEventListener('blur', () => this.programarVerificacionCheque(50));
    }

    if (btnVerificarCheque) {
      btnVerificarCheque.addEventListener('click', () => this.verificarChequeDenunciado(true));
    }

    // CUIT Emisor + Popup de reporte BCRA
    const cuitInput = document.getElementById('inputCuitEmisor');
    const btnConsultarCuit = document.getElementById('btnConsultarCuitBcra');
    if (cuitInput) {
      cuitInput.addEventListener('input', () => {
        const clean = cuitInput.value.replace(/\D/g, '');
        if (clean.length === 11 && clean !== this.ultimoCuitConsultado) {
          this.consultarCuitBcra(true);
        } else if (clean.length < 11) {
          const badge = document.getElementById('ingresoCuitBcraBadge');
          if (badge) badge.style.display = 'none';
        }
      });
      cuitInput.addEventListener('blur', () => {
        const clean = cuitInput.value.replace(/\D/g, '');
        if (clean.length === 11 && clean !== this.ultimoCuitConsultado) {
          this.consultarCuitBcra(true);
        }
      });
    }
    if (btnConsultarCuit) {
      btnConsultarCuit.addEventListener('click', () => this.consultarCuitBcra(true, true));
    }

    // Cliente entregador: Cambio de desplegable
    const selectEntregador = document.getElementById('selectEntregador');
    if (selectEntregador) {
      selectEntregador.addEventListener('change', (e) => {
        if (e.target.value === '__NUEVO__') {
          this.abrirModalNuevoClienteRapido();
        }
      });
    }

    // Botón directo "+ Cargar nuevo cliente"
    const btnNuevoCliente = document.getElementById('btnNuevoClienteRapido');
    if (btnNuevoCliente) {
      btnNuevoCliente.addEventListener('click', () => this.abrirModalNuevoClienteRapido());
    }

    // Formulario de creación rápida de cliente
    const formQuickCliente = document.getElementById('formQuickCliente');
    if (formQuickCliente) {
      formQuickCliente.onsubmit = (e) => this.handleGuardarClienteRapido(e);
    }

    // Único listener de envío de formulario para evitar duplicados
    form.onsubmit = (e) => this.handleSubmit(e);

    // Ejecutar cálculo inicial
    this.calcularEnVivo();
  },

  poblarSelectTasas() {
    const tasaSelect = document.getElementById('inputTasa');
    if (!tasaSelect || tasaSelect.options.length > 0) return;

    const opciones = [];
    for (let t = 1; t <= 30; t += 0.5) {
      const label = Number.isInteger(t) ? `${t} %` : `${String(t).replace('.', ',')} %`;
      const selected = t === 5 ? 'selected' : '';
      opciones.push(`<option value="${t}" ${selected}>${label}</option>`);
    }
    tasaSelect.innerHTML = opciones.join('');
  },

  async cargarBancosAdicionalesBcra() {
    const optGroup = document.getElementById('optGroupBancosBcra');
    const selectBanco = document.getElementById('selectBanco');
    if (!optGroup || !selectBanco || optGroup.children.length > 0) return;

    try {
      const entidades = await ConsultasModule.cargarEntidades();
      const codigosExistentes = new Set(
        Array.from(selectBanco.querySelectorAll('option[data-codigo-bcra]'))
          .map(o => parseInt(o.dataset.codigoBcra, 10))
      );

      const extras = entidades.filter(e => !codigosExistentes.has(e.codigoEntidad));
      optGroup.innerHTML = extras
        .map(e => `<option value="${ConsultasModule.escapeHtml(e.denominacion)}" data-codigo-bcra="${e.codigoEntidad}">${ConsultasModule.escapeHtml(e.denominacion)}</option>`)
        .join('');
    } catch (e) {
      console.warn('No se pudieron cargar entidades adicionales del BCRA:', e.message);
    }
  },

  resetBcraStatus() {
    this.ultimoCuitConsultado = null;
    this.ultimoReporteCuit = null;
    this.ultimaConsultaChequeKey = null;
    const badgeCuit = document.getElementById('ingresoCuitBcraBadge');
    const badgeCheque = document.getElementById('ingresoDenunciadoStatus');
    if (badgeCuit) {
      badgeCuit.style.display = 'none';
      badgeCuit.innerHTML = '';
    }
    if (badgeCheque) {
      badgeCheque.style.display = 'none';
      badgeCheque.innerHTML = '';
    }
  },

  programarVerificacionCheque(delay = 500) {
    clearTimeout(this.chequeTimer);
    this.chequeTimer = setTimeout(() => {
      this.verificarChequeDenunciado(false);
    }, delay);
  },

  async verificarChequeDenunciado(esManual = false) {
    const numEl = document.getElementById('inputNumeroCheque');
    const bancoEl = document.getElementById('selectBanco');
    const statusEl = document.getElementById('ingresoDenunciadoStatus');
    if (!numEl || !bancoEl || !statusEl) return;

    const numeroCheque = numEl.value.replace(/\D/g, '');
    const selectedOpt = bancoEl.options[bancoEl.selectedIndex];
    const codigoEntidad = selectedOpt?.dataset?.codigoBcra || '';
    const bancoNombre = bancoEl.value;

    if (!numeroCheque || !bancoNombre || bancoNombre === 'OTRO') {
      if (esManual) {
        if (!numeroCheque) {
          showToast('Ingresá un N° de cheque numérico para verificar.', 'warning');
        } else {
          showToast('Seleccioná un banco de la lista oficial para verificar en BCRA.', 'warning');
        }
      } else {
        statusEl.style.display = 'none';
      }
      return;
    }

    const key = `${codigoEntidad || bancoNombre}:${numeroCheque}`;
    if (!esManual && key === this.ultimaConsultaChequeKey) return;
    this.ultimaConsultaChequeKey = key;

    statusEl.style.display = 'flex';
    statusEl.className = 'bcra-inline-status loading';
    statusEl.innerHTML = '<span>⏳ Verificando en BCRA...</span>';

    try {
      const params = new URLSearchParams({ numeroCheque });
      if (codigoEntidad) params.append('codigoEntidad', codigoEntidad);
      else params.append('banco', bancoNombre);

      const res = await API.get(`/bcra/cheques-denunciados?${params.toString()}`);
      if (!res.servicioDisponible) {
        statusEl.className = 'bcra-inline-status warn';
        statusEl.innerHTML = '<span>⚠️ BCRA sin conexión temporalmente</span>';
        return;
      }

      if (res.denunciado) {
        const causal = res.detalles?.[0]?.causal || 'Denunciado';
        statusEl.className = 'bcra-inline-status danger';
        statusEl.innerHTML = `<span>🚨 <strong>¡DENUNCIADO EN BCRA!</strong> (${ConsultasModule.escapeHtml(causal)})</span>`;
        showToast(`¡ALERTA! El cheque #${numeroCheque} figura DENUNCIADO en el BCRA (${causal}).`, 'error');
      } else {
        statusEl.className = 'bcra-inline-status ok';
        statusEl.innerHTML = '<span>✅ Sin denuncia registrada en BCRA</span>';
      }
    } catch (error) {
      statusEl.className = 'bcra-inline-status warn';
      statusEl.innerHTML = `<span>⚠️ ${ConsultasModule.escapeHtml(error.message)}</span>`;
    }
  },

  async consultarCuitBcra(abrirPopup = true, forzar = false) {
    const cuitInput = document.getElementById('inputCuitEmisor');
    const badgeEl = document.getElementById('ingresoCuitBcraBadge');
    if (!cuitInput) return;

    const cuit = cuitInput.value.replace(/\D/g, '');
    if (!/^\d{11}$/.test(cuit)) {
      if (forzar) {
        showToast('El CUIT del Emisor debe tener exactamente 11 dígitos.', 'error');
        cuitInput.focus();
      }
      return;
    }

    if (!forzar && cuit === this.ultimoCuitConsultado && this.ultimoReporteCuit) {
      if (abrirPopup) this.abrirPopupReporteCuit(this.ultimoReporteCuit);
      return;
    }

    this.ultimoCuitConsultado = cuit;
    if (badgeEl) {
      badgeEl.style.display = 'flex';
      badgeEl.className = 'bcra-inline-status loading';
      badgeEl.innerHTML = '<span>⏳ Consultando BCRA...</span>';
    }

    try {
      const data = await API.get(`/bcra/deudores/${cuit}`);
      this.ultimoReporteCuit = data;

      if (badgeEl) {
        const nivel = data.evaluacion?.nivel || 'LIMPIO';
        let cls = 'ok';
        let txt = '✅ Situación Normal en BCRA';
        if (nivel === 'CRITICO') {
          cls = 'danger';
          txt = '🚨 ALERTA CRÍTICA en BCRA';
        } else if (nivel === 'PRECAUCION') {
          cls = 'warn';
          txt = '⚠️ Precaución: Antecedentes en BCRA';
        } else if (nivel === 'NO_DISPONIBLE') {
          cls = 'warn';
          txt = '⚠️ BCRA no disponible temporalmente';
        }
        badgeEl.className = `bcra-inline-status ${cls}`;
        badgeEl.innerHTML = `
          <span>${txt}</span>
          <button type="button" class="bcra-inline-link" onclick="IngresoModule.abrirPopupReporteCuit(IngresoModule.ultimoReporteCuit)">Ver reporte</button>
        `;
      }

      if (abrirPopup) {
        this.abrirPopupReporteCuit(data);
      }
    } catch (error) {
      if (badgeEl) {
        badgeEl.className = 'bcra-inline-status warn';
        badgeEl.innerHTML = `<span>⚠️ No se pudo consultar BCRA</span>`;
      }
    }
  },

  abrirPopupReporteCuit(data) {
    if (!data) return;
    const modal = document.getElementById('modalReporteBcraCuit');
    const body = document.getElementById('modalReporteBcraCuitBody');
    const subtitulo = document.getElementById('modalBcraCuitSubtitulo');
    const btnUsarDenom = document.getElementById('btnBcraUsarDenominacion');
    if (!modal || !body) return;

    if (subtitulo) {
      subtitulo.textContent = `CUIT ${data.cuitFormateado}${data.denominacion ? ` • ${data.denominacion}` : ''}`;
    }

    body.innerHTML = ConsultasModule.renderReporteDeudoresHTML(data, { compacto: true });

    if (btnUsarDenom) {
      if (data.denominacion) {
        btnUsarDenom.style.display = 'inline-flex';
        btnUsarDenom.onclick = () => {
          const inputEmisor = document.getElementById('inputEmisor');
          if (inputEmisor) inputEmisor.value = data.denominacion;
          modal.classList.remove('show');
          showToast('Razón social copiada al campo Emisor.', 'success');
        };
      } else {
        btnUsarDenom.style.display = 'none';
      }
    }

    modal.classList.add('show');
  },

  async cargarComboClientes(clienteASeleccionar = null) {
    const select = document.getElementById('selectEntregador');
    if (!select) return;

    try {
      const res = await API.get('/clientes');
      this.clientes = res.clientes || [];

      const valorPrevio = clienteASeleccionar || select.value;

      select.innerHTML = `
        <option value="">-- Seleccionar cliente registrado --</option>
        <option value="__NUEVO__" style="color: var(--primary); font-weight: 700;">+ Cargar nuevo cliente...</option>
        ${this.clientes.map(c => `<option value="${c.nombre}">${c.nombre} ${c.cuit ? `(CUIT: ${c.cuit})` : ''}</option>`).join('')}
      `;

      if (valorPrevio && valorPrevio !== '__NUEVO__') {
        select.value = valorPrevio;
      }
    } catch (e) {
      console.error('Error cargando clientes en select:', e);
    }
  },

  abrirModalNuevoClienteRapido() {
    const modal = document.getElementById('modalQuickCliente');
    const form = document.getElementById('formQuickCliente');
    if (!modal) return;
    if (form) form.reset();
    modal.classList.add('show');
    setTimeout(() => {
      document.getElementById('quickClienteNombre')?.focus();
    }, 100);
  },

  async handleGuardarClienteRapido(e) {
    e.preventDefault();
    const nombre = document.getElementById('quickClienteNombre').value.trim();
    const telefono = document.getElementById('quickClienteTelefono')?.value.trim() || '';
    const cuit = document.getElementById('quickClienteCuit')?.value.trim() || '';

    if (!nombre) {
      showToast('El nombre del cliente es obligatorio.', 'error');
      return;
    }

    const btnSubmit = e.target.querySelector('button[type="submit"]');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
      const res = await API.post('/clientes', { nombre, telefono, cuit });
      const clienteCreado = res.cliente;
      showToast(`Cliente "${clienteCreado.nombre}" guardado y seleccionado.`, 'success');

      // Recargar dropdown y dejar seleccionado
      await this.cargarComboClientes(clienteCreado.nombre);
      const select = document.getElementById('selectEntregador');
      if (select) select.value = clienteCreado.nombre;

      // Cerrar modal
      document.getElementById('modalQuickCliente').classList.remove('show');
      document.getElementById('formQuickCliente').reset();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
    }
  },

  resetFechas() {
    const hoy = new Date().toISOString().split('T')[0];
    const fechaRecepInput = document.getElementById('inputFechaRecepcion');
    const fechaCobroInput = document.getElementById('inputFechaCobro');

    if (fechaRecepInput && !fechaRecepInput.value) {
      fechaRecepInput.value = hoy;
    }

    if (fechaCobroInput && !fechaCobroInput.value) {
      const fechaFutura = new Date();
      fechaFutura.setDate(fechaFutura.getDate() + 30);
      fechaCobroInput.value = fechaFutura.toISOString().split('T')[0];
    }
  },

  calcularEnVivo() {
    const importeEl = document.getElementById('inputImporte');
    const tasaEl = document.getElementById('inputTasa');
    const fechaRecepEl = document.getElementById('inputFechaRecepcion');
    const fechaCobroEl = document.getElementById('inputFechaCobro');

    const importe = parseFloat(importeEl?.value) || 0;
    const tasa = parseFloat(tasaEl?.value) || 0;

    // Cálculos
    const interesCobrado = Math.round((importe * (tasa / 100)) * 100) / 100;
    const dineroSaliente = Math.round((importe - interesCobrado) * 100) / 100;

    // Días de plazo
    let diasPlazo = 0;
    if (fechaRecepEl?.value && fechaCobroEl?.value) {
      const f1 = new Date(fechaRecepEl.value);
      const f2 = new Date(fechaCobroEl.value);
      const diffMs = f2.getTime() - f1.getTime();
      diasPlazo = Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    // Renderizar valores en el box reactivo
    const previewImporte = document.getElementById('previewImporte');
    const previewInteres = document.getElementById('previewInteres');
    const previewSaliente = document.getElementById('previewSaliente');
    const previewDias = document.getElementById('previewDias');

    if (previewImporte) previewImporte.textContent = formatARS(importe);
    if (previewInteres) previewInteres.textContent = formatARS(interesCobrado);
    if (previewSaliente) previewSaliente.textContent = formatARS(dineroSaliente);
    if (previewDias) previewDias.textContent = diasPlazo >= 0 ? `${diasPlazo} días` : 'Fecha cobro anterior a recepción';
  },

  async handleSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting) return;

    const selectEntregador = document.getElementById('selectEntregador');
    const entregador = selectEntregador ? selectEntregador.value.trim() : '';

    if (!entregador || entregador === '__NUEVO__') {
      showToast('Debe seleccionar o registrar un cliente entregador.', 'error');
      if (selectEntregador) selectEntregador.focus();
      return;
    }

    this.isSubmitting = true;
    const btnSubmit = document.getElementById('btnSubmitCheque');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Guardando cheque...</span>';
    }

    try {
      const bancoSelect = document.getElementById('selectBanco');
      const bancoOtro = document.getElementById('inputBancoOtro');
      const banco = bancoSelect.value === 'OTRO' ? bancoOtro.value.trim() : bancoSelect.value;

      const cuitRaw = document.getElementById('inputCuitEmisor')?.value || '';
      const cuitDigitos = cuitRaw.replace(/\D/g, '');
      if (!/^\d{11}$/.test(cuitDigitos)) {
        showToast('El CUIT del Emisor es obligatorio y debe tener 11 dígitos.', 'error');
        document.getElementById('inputCuitEmisor')?.focus();
        return;
      }

      const payload = {
        numero: document.getElementById('inputNumeroCheque').value.trim(),
        banco: banco,
        emisor: document.getElementById('inputEmisor').value.trim(),
        cuit_emisor: cuitDigitos,
        entregador: entregador,
        fecha_recepcion: document.getElementById('inputFechaRecepcion').value,
        fecha_cobro: document.getElementById('inputFechaCobro').value,
        importe: parseFloat(document.getElementById('inputImporte').value),
        tasa_interes: parseFloat(document.getElementById('inputTasa').value),
        notas: document.getElementById('inputNotas')?.value.trim() || ''
      };

      const res = await API.post('/cheques', payload);
      showToast(res.mensaje || 'Cheque ingresado correctamente a la Cartera.', 'success');

      // Limpiar formulario y resetear valores
      document.getElementById('formIngresoCheque').reset();
      const tasaSelect = document.getElementById('inputTasa');
      if (tasaSelect) tasaSelect.value = '5';
      this.resetBcraStatus();
      this.resetFechas();
      this.calcularEnVivo();

      // Redirigir a Cartera
      window.location.hash = '#cartera';
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      this.isSubmitting = false;
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> <span>Ingresar Cheque a Cartera</span>';
      }
    }
  }
};
