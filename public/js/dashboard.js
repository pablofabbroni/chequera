// Módulo de Dashboard Financiero y Análisis de Negocio

const DashboardModule = {
  chartProyeccion: null,
  chartBancos: null,
  initialized: false,
  aniosCargados: false,

  init() {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.cargarMetricas();
  },

  bindEvents() {
    const selectAnio = document.getElementById('dashFiltroAnio');
    const selectMes = document.getElementById('dashFiltroMes');
    const selectCliente = document.getElementById('dashFiltroCliente');

    if (selectAnio) {
      selectAnio.addEventListener('change', () => this.cargarMetricas());
    }
    if (selectMes) {
      selectMes.addEventListener('change', () => this.cargarMetricas());
    }
    if (selectCliente) {
      selectCliente.addEventListener('change', () => this.cargarMetricas());
    }
  },

  async cargarMetricas() {
    const selectAnio = document.getElementById('dashFiltroAnio');
    const selectMes = document.getElementById('dashFiltroMes');
    const selectCliente = document.getElementById('dashFiltroCliente');

    const params = new URLSearchParams();
    if (selectAnio && selectAnio.value) params.append('anio', selectAnio.value);
    if (selectMes && selectMes.value) params.append('mes', selectMes.value);
    if (selectCliente && selectCliente.value) params.append('cliente', selectCliente.value);

    try {
      const data = await API.get(`/dashboard/metricas?${params.toString()}`);
      this.actualizarComboAnios(data.aniosDisponibles);
      this.actualizarComboClientes(data.clientesDisponibles);
      this.renderKPIs(data.resumen);
      this.renderAlertas(data.chequesAlerta);
      this.renderGraficos(data);
      this.renderTopTablas(data.topBancos, data.topEntregadores);
    } catch (error) {
      showToast(`Error cargando métricas: ${error.message}`, 'error');
    }
  },

  actualizarComboAnios(aniosDisponibles = []) {
    const selectAnio = document.getElementById('dashFiltroAnio');
    if (!selectAnio || this.aniosCargados) return;

    const valorActual = selectAnio.value;
    
    if (!aniosDisponibles || aniosDisponibles.length === 0) {
      selectAnio.innerHTML = '<option value="">Todo el historial</option>';
      this.aniosCargados = true;
      return;
    }

    selectAnio.innerHTML = `
      <option value="">Todo el historial</option>
      ${aniosDisponibles.map(a => `<option value="${a}">Año ${a}</option>`).join('')}
    `;

    if (valorActual && aniosDisponibles.includes(parseInt(valorActual, 10))) {
      selectAnio.value = valorActual;
    } else {
      selectAnio.value = aniosDisponibles[0];
    }

    this.aniosCargados = true;
  },

  actualizarComboClientes(clientesDisponibles = []) {
    const selectCliente = document.getElementById('dashFiltroCliente');
    if (!selectCliente || !clientesDisponibles) return;

    const valorActual = selectCliente.value;
    selectCliente.innerHTML = `
      <option value="">Todos los clientes</option>
      ${clientesDisponibles.map(c => `<option value="${c}">${c}</option>`).join('')}
    `;
    if (valorActual) {
      selectCliente.value = valorActual;
    }
  },

  renderKPIs(resumen) {
    if (!resumen) return;

    // Ganancia Neta
    const kpiGanancias = document.getElementById('kpiGananciasNetas');
    if (kpiGanancias) kpiGanancias.textContent = formatARS(resumen.totalGananciasNetas || 0);

    // Cartera Pendiente
    const kpiCartera = document.getElementById('kpiCarteraImporte');
    const kpiCarteraCant = document.getElementById('kpiCarteraCantidad');
    if (kpiCartera) kpiCartera.textContent = formatARS(resumen.carteraPendiente?.importe || 0);
    if (kpiCarteraCant) kpiCarteraCant.textContent = `${resumen.carteraPendiente?.cantidad || 0} cheques por cobrar`;

    // Cobrados
    const kpiCobrados = document.getElementById('kpiCobradosImporte');
    const kpiCobradosCant = document.getElementById('kpiCobradosCantidad');
    if (kpiCobrados) kpiCobrados.textContent = formatARS(resumen.cobrados?.importe || 0);
    if (kpiCobradosCant) kpiCobradosCant.textContent = `${resumen.cobrados?.cantidad || 0} cobrados con éxito`;

    // Entregados
    const kpiEntregados = document.getElementById('kpiEntregadosImporte');
    const kpiEntregadosCant = document.getElementById('kpiEntregadosCantidad');
    if (kpiEntregados) kpiEntregados.textContent = formatARS(resumen.entregados?.importe || 0);
    if (kpiEntregadosCant) kpiEntregadosCant.textContent = `${resumen.entregados?.cantidad || 0} cheques transferidos`;

    // Rechazados
    const kpiRechazados = document.getElementById('kpiRechazadosImporte');
    const kpiRechazadosCant = document.getElementById('kpiRechazadosCantidad');
    if (kpiRechazados) kpiRechazados.textContent = formatARS(resumen.rechazados?.importe || 0);
    if (kpiRechazadosCant) kpiRechazadosCant.textContent = `${resumen.rechazados?.cantidad || 0} cheques con rebote`;
  },

  renderAlertas(chequesAlerta) {
    const tableBody = document.getElementById('dashboardAlertasTableBody');
    const vacioEl = document.getElementById('dashboardAlertasVacio');
    const banner = document.getElementById('dashboardUrgentBanner');

    if (!chequesAlerta || chequesAlerta.length === 0) {
      if (banner) banner.style.display = 'none';
      if (tableBody) tableBody.innerHTML = '';
      if (vacioEl) vacioEl.style.display = 'block';
      return;
    }

    if (vacioEl) vacioEl.style.display = 'none';

    const criticos = chequesAlerta.filter(c => c.metricas?.nivelAlerta === 'POR_VENCER_LEGAL');
    if (banner) {
      if (criticos.length > 0) {
        banner.style.display = 'flex';
        document.getElementById('bannerUrgentCount').textContent = `${criticos.length} cheque(s) a punto de vencer su plazo legal de 30 días`;
      } else {
        banner.style.display = 'none';
      }
    }

    if (tableBody) {
      tableBody.innerHTML = chequesAlerta.map(c => {
        const met = c.metricas || {};
        const esCritico = met.nivelAlerta === 'POR_VENCER_LEGAL';

        let badgeTag = '';
        if (esCritico) {
          badgeTag = `<span class="tag-urgente critico">⚠️ ¡Vence legal en ${met.diasParaVencLegal}d!</span>`;
        } else if (met.nivelAlerta === 'COBRO_CERCANO' || met.nivelAlerta === 'LISTO_COBRO') {
          badgeTag = `<span class="tag-urgente aviso">📅 Cobro en ${met.diasParaCobro}d</span>`;
        } else if (met.nivelAlerta === 'VENCIDO') {
          badgeTag = `<span class="tag-urgente critico">⛔ Vencido Legal</span>`;
        }

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff;">#${c.numero}</div>
              <div style="font-size: 0.8rem; color: var(--primary); font-weight: 600;">${c.banco}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #fff;">${c.emisor}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">Entregó: ${c.entregador}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #fff;">${formatFecha(c.fecha_cobro)}</div>
            </td>
            <td>
              <div style="color: var(--text-dim); font-size: 0.82rem;">${met.fechaVencimientoLegal || '-'}</div>
            </td>
            <td>
              <div style="font-weight: 700; color: #fff; font-family: 'Outfit', sans-serif;">
                ${formatARS(c.importe)}
              </div>
            </td>
            <td>
              ${badgeTag}
            </td>
          </tr>
        `;
      }).join('');
    }
  },

  renderGraficos(data) {
    if (typeof Chart === 'undefined') return;

    // 1. Gráfico de Flujo de Cobros Proyectado (Cash Flow)
    const canvasProyeccion = document.getElementById('chartProyeccionCobros');
    if (canvasProyeccion) {
      if (this.chartProyeccion) this.chartProyeccion.destroy();

      const labels = (data.proyeccionCobros || []).map(d => d.periodo_cobro);
      const montos = (data.proyeccionCobros || []).map(d => Number(d.total_a_cobrar));

      this.chartProyeccion = new Chart(canvasProyeccion, {
        type: 'line',
        data: {
          labels: labels.length > 0 ? labels : ['Sin cobros proyectados'],
          datasets: [{
            label: 'Total a Cobrar ($)',
            data: montos.length > 0 ? montos : [0],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#fff',
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8' } },
            tooltip: {
              callbacks: {
                label: (ctx) => `Proyección a cobrar: ${formatARS(ctx.raw)}`
              }
            }
          },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { display: false } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
          }
        }
      });
    }

    // 2. Gráfico de Distribución por Banco
    const canvasBancos = document.getElementById('chartDistribucionBancos');
    if (canvasBancos && data.topBancos && data.topBancos.length > 0) {
      if (this.chartBancos) this.chartBancos.destroy();

      const labels = data.topBancos.map(b => b.banco);
      const dataValues = data.topBancos.map(b => Number(b.total_importe));

      this.chartBancos = new Chart(canvasBancos, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: dataValues,
            backgroundColor: [
              '#0ea5e9',
              '#10b981',
              '#6366f1',
              '#f59e0b',
              '#ec4899',
              '#8b5cf6'
            ],
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${formatARS(ctx.raw)}`
              }
            }
          }
        }
      });
    }
  },

  renderTopTablas(bancos, entregadores) {
    const tbodyEntregadores = document.getElementById('tablaTopEntregadoresBody');
    if (tbodyEntregadores && entregadores) {
      if (entregadores.length === 0) {
        tbodyEntregadores.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 20px;">Sin registros de clientes</td></tr>`;
        return;
      }

      tbodyEntregadores.innerHTML = entregadores.map(e => `
        <tr>
          <td style="font-weight: 600; color: #fff;">
            ${e.entregador}
          </td>
          <td style="text-align: center; color: var(--text-muted); font-weight: 600;">
            ${e.cantidad} cheques
          </td>
          <td style="text-align: right; font-weight: 600; color: #fff; font-family: 'Outfit', sans-serif;">
            ${formatARS(e.total_importe || 0)}
          </td>
          <td style="text-align: right; font-weight: 700; color: var(--accent-emerald); font-family: 'Outfit', sans-serif;">
            +${formatARS(e.ganancia_generada)}
          </td>
        </tr>
      `).join('');
    }
  }
};
