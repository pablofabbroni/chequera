// Módulo de Ingreso de Cheques con Cálculos Financieros Reactivos y Gestión Integrada de Clientes

const IngresoModule = {
  initialized: false,
  isSubmitting: false,
  clientes: [],

  async init() {
    this.resetFechas();
    await this.cargarComboClientes();

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
    if (tasaInput) tasaInput.addEventListener('input', () => this.calcularEnVivo());
    if (fechaRecepInput) fechaRecepInput.addEventListener('change', () => this.calcularEnVivo());
    if (fechaCobroInput) fechaCobroInput.addEventListener('change', () => this.calcularEnVivo());

    // Banco selector custom
    const bancoSelect = document.getElementById('selectBanco');
    const bancoOtroInput = document.getElementById('inputBancoOtro');
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
      });
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

      const payload = {
        numero: document.getElementById('inputNumeroCheque').value.trim(),
        banco: banco,
        emisor: document.getElementById('inputEmisor').value.trim(),
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
