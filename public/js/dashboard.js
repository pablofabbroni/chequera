// Módulo de Dashboard Financiero y Análisis de Negocio

const DashboardModule = {
  chartEvolucion: null,
  chartProyeccion: null,
  chartBancos: null,
  initialized: false,

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

    if (selectAnio) {
      selectAnio.addEventListener('change', () => this.cargarMetricas());
    }
    if (selectMes) {
      selectMes.addEventListener('change', () => this.cargarMetricas());
    }
  },

  async cargarMetricas() {
    const selectAnio = document.getElementById('dashFiltroAnio');
    const selectMes = document.getElementById('dashFiltroMes');

    const params = new URLSearchParams();
    if (selectAnio && selectAnio.value) params.append('anio', selectAnio.value);
    if (selectMes && selectMes.value) params.append('mes', selectMes.value);

    try {
      const data = await API.get(`/dashboard/metricas?${params.toString()}`);
      this.renderKPIs(data.resumen);
      this.renderAlertas(data.chequesAlerta);
      this.renderGraficos(data);
      this.renderTopTablas(data.topBancos, data.topEntregadores);
    } catch (error) {
      showToast(`Error cargando métricas: ${error.message}`, 'error');
    }
  },

  renderKPIs(resumen) {
    if (!resumen) return;

    // Ganancias Netas
    const kpiGanancias = document.getElementById('kpiGananciasNetas');
    if (kpiGanancias) kpiGanancias.textContent = formatARS(resumen.totalGananciasNetas || 0);

    const kpiTasaPromedio = document.getElementById('kpiTasaPromedio');
    if (kpiTasaPromedio) kpiTasaPromedio.textContent = `${resumen.tasaPromedioPonderada || 0}% tasa prom.`;

    // Cartera Pendiente
    const kpiCartera = document.getElementById('kpiCarteraImporte');
    const kpiCarteraCant = document.getElementById('kpiCarteraCantidad');
    if (kpiCartera) kpiCartera.textContent = formatARS(resumen.carteraPendiente?.importe || 0);
    if (kpiCarteraCant) kpiCarteraCant.textContent = `${resumen.carteraPendiente?.cantidad || 0} cheques por cobrar`;

    // Cobrados
    const kpiCobrados = document.getElementById('kpiCobradosImporte');
    const kpiCobradosCant = document.getElementById('kpiCobradosCantidad');
    if (kpiCobrados) kpiCobrados.textContent = formatARS(resumen.cobrados?.importe || 0);
    if (kpiCobradosCant) kpiCobradosCant.textContent = `${resumen.cobrados?.cantidad || 0} cobrados`;

    // Entregados
    const kpiEntregados = document.getElementById('kpiEntregadosImporte');
    const kpiEntregadosCant = document.getElementById('kpiEntregadosCantidad');
    if (kpiEntregados) kpiEntregados.textContent = formatARS(resumen.entregados?.importe || 0);
    if (kpiEntregadosCant) kpiEntregadosCant.textContent = `${resumen.entregados?.cantidad || 0} entregados`;

    // Rechazados
    const kpiRechazados = document.getElementById('kpiRechazadosImporte');
    const kpiRechazadosCant = document.getElementById('kpiRechazadosCantidad');
    if (kpiRechazados) kpiRechazados.textContent = formatARS(resumen.rechazados?.importe || 0);
    if (kpiRechazadosCant) kpiRechazadosCant.textContent = `${resumen.rechazados?.cantidad || 0} rechazados`;
  },

  renderAlertas(chequesAlerta) {
    const container = document.getElementById('dashboardAlertasContainer');
    const banner = document.getElementById('dashboardUrgentBanner');
    if (!container) return;

    if (!chequesAlerta || chequesAlerta.length === 0) {
      if (banner) banner.style.display = 'none';
      container.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-dim); font-size: 0.9rem;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px; color: var(--accent-emerald);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>Todos los cheques están al día. No hay vencimientos legales urgentes.</div>
        </div>
      `;
      return;
    }

    // Si hay cheques en riesgo legal de 30 días, mostrar banner destacado
    const criticos = chequesAlerta.filter(c => c.metricas?.nivelAlerta === 'POR_VENCER_LEGAL');
    if (banner) {
      if (criticos.length > 0) {
        banner.style.display = 'flex';
        document.getElementById('bannerUrgentCount').textContent = `${criticos.length} cheque(s) a punto de vencer su plazo legal de 30 días`;
      } else {
        banner.style.display = 'none';
      }
    }

    container.innerHTML = chequesAlerta.map(c => {
      const met = c.metricas;
      const esCritico = met.nivelAlerta === 'POR_VENCER_LEGAL';
      return `
        <div style="padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div>
            <div style="font-weight: 600; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span>#${c.numero} - ${c.banco}</span>
              <span class="tag-urgente ${esCritico ? 'critico' : 'aviso'}">
                ${esCritico ? `¡Vence legal en ${met.diasParaVencLegal}d!` : `Cobro en ${met.diasParaCobro}d`}
              </span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
              Emisor: ${c.emisor} | Fecha Cobro: ${formatFecha(c.fecha_cobro)} | Venc. Legal (30d): ${met.fechaVencimientoLegal}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #fff; font-family: 'Outfit', sans-serif;">
              ${formatARS(c.importe)}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="CarteraModule.abrirEntregar(${c.id})" style="margin-top: 4px; font-size: 0.72rem; padding: 2px 8px;">
              Gestionar
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  renderGraficos(data) {
    if (typeof Chart === 'undefined') return;

    // 1. Gráfico de Evolución Mensual
    const canvasEvolucion = document.getElementById('chartEvolucionMensual');
    if (canvasEvolucion) {
      if (this.chartEvolucion) this.chartEvolucion.destroy();

      const labels = (data.evolucionMensual || []).map(d => d.periodo);
      const montos = (data.evolucionMensual || []).map(d => d.total_importe);
      const ganancias = (data.evolucionMensual || []).map(d => d.total_ganancia);

      this.chartEvolucion = new Chart(canvasEvolucion, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Total Cheques Ingresados ($)',
              data: montos,
              backgroundColor: 'rgba(14, 165, 233, 0.5)',
              borderColor: '#0ea5e9',
              borderWidth: 1,
              borderRadius: 6
            },
            {
              label: 'Ganancia Intereses ($)',
              data: ganancias,
              backgroundColor: 'rgba(16, 185, 129, 0.7)',
              borderColor: '#10b981',
              borderWidth: 1,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8' } }
          },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { display: false } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
          }
        }
      });
    }

    // 2. Gráfico de Proyección de Cobros (Cash Flow)
    const canvasProyeccion = document.getElementById('chartProyeccionCobros');
    if (canvasProyeccion) {
      if (this.chartProyeccion) this.chartProyeccion.destroy();

      const labels = (data.proyeccionCobros || []).map(d => d.periodo_cobro);
      const montos = (data.proyeccionCobros || []).map(d => d.total_a_cobrar);

      this.chartProyeccion = new Chart(canvasProyeccion, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Flujo de Cobros Proyectado ($)',
            data: montos,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#10b981',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8' } }
          },
          scales: {
            x: { ticks: { color: '#64748b' }, grid: { display: false } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
          }
        }
      });
    }

    // 3. Gráfico de Distribución por Banco
    const canvasBancos = document.getElementById('chartDistribucionBancos');
    if (canvasBancos && data.topBancos && data.topBancos.length > 0) {
      if (this.chartBancos) this.chartBancos.destroy();

      const labels = data.topBancos.map(b => b.banco);
      const dataValues = data.topBancos.map(b => b.total_importe);

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
              '#ec4899'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
          }
        }
      });
    }
  },

  renderTopTablas(bancos, entregadores) {
    const tbodyBancos = document.getElementById('tablaTopBancosBody');
    if (tbodyBancos && bancos) {
      tbodyBancos.innerHTML = bancos.map(b => `
        <tr>
          <td style="font-weight: 600; color: #fff;">${b.banco}</td>
          <td style="color: var(--text-muted);">${b.cantidad} ch.</td>
          <td style="text-align: right; font-weight: 700; color: #fff;">${formatARS(b.total_importe)}</td>
        </tr>
      `).join('');
    }

    const tbodyEntregadores = document.getElementById('tablaTopEntregadoresBody');
    if (tbodyEntregadores && entregadores) {
      tbodyEntregadores.innerHTML = entregadores.map(e => `
        <tr>
          <td style="font-weight: 600; color: #fff;">${e.entregador}</td>
          <td style="color: var(--text-muted);">${e.cantidad} ch.</td>
          <td style="text-align: right; font-weight: 700; color: var(--accent-emerald);">${formatARS(e.ganancia_generada)}</td>
        </tr>
      `).join('');
    }
  }
};
