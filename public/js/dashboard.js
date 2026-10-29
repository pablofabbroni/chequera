// Módulo de Dashboard Financiero y Análisis Interactivo de Negocio

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
    const selectEstado = document.getElementById('dashFiltroEstado');

    if (selectAnio) {
      selectAnio.addEventListener('change', () => this.cargarMetricas());
    }
    if (selectMes) {
      selectMes.addEventListener('change', () => this.cargarMetricas());
    }
    if (selectEstado) {
      selectEstado.addEventListener('change', (e) => {
        if (e.target.value) {
          App.irACarteraConFiltro(e.target.value);
        }
      });
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
      this.actualizarComboAnios(data.aniosDisponibles);
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
    
    // Si no hay años registrados aún, mostrar solo opción general
    if (!aniosDisponibles || aniosDisponibles.length === 0) {
      selectAnio.innerHTML = '<option value="">Todo el historial</option>';
      this.aniosCargados = true;
      return;
    }

    selectAnio.innerHTML = `
      <option value="">Todo el historial</option>
      ${aniosDisponibles.map(a => `<option value="${a}">Año ${a}</option>`).join('')}
    `;

    // Si había un valor seleccionado y existe en la lista, conservarlo
    if (valorActual && aniosDisponibles.includes(parseInt(valorActual, 10))) {
      selectAnio.value = valorActual;
    } else {
      // Por defecto seleccionar el año más reciente con datos
      selectAnio.value = aniosDisponibles[0];
    }

    this.aniosCargados = true;
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
    if (kpiCarteraCant) kpiCarteraCant.textContent = `${resumen.carteraPendiente?.cantidad || 0} cheques por cobrar ↗`;

    // Cobrados
    const kpiCobrados = document.getElementById('kpiCobradosImporte');
    const kpiCobradosCant = document.getElementById('kpiCobradosCantidad');
    if (kpiCobrados) kpiCobrados.textContent = formatARS(resumen.cobrados?.importe || 0);
    if (kpiCobradosCant) kpiCobradosCant.textContent = `${resumen.cobrados?.cantidad || 0} cobrados ↗`;

    // Entregados
    const kpiEntregados = document.getElementById('kpiEntregadosImporte');
    const kpiEntregadosCant = document.getElementById('kpiEntregadosCantidad');
    if (kpiEntregados) kpiEntregados.textContent = formatARS(resumen.entregados?.importe || 0);
    if (kpiEntregadosCant) kpiEntregadosCant.textContent = `${resumen.entregados?.cantidad || 0} transferidos ↗`;

    // Rechazados
    const kpiRechazados = document.getElementById('kpiRechazadosImporte');
    const kpiRechazadosCant = document.getElementById('kpiRechazadosCantidad');
    if (kpiRechazados) kpiRechazados.textContent = formatARS(resumen.rechazados?.importe || 0);
    if (kpiRechazadosCant) kpiRechazadosCant.textContent = `${resumen.rechazados?.cantidad || 0} rechazados ↗`;
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
          <div>Todos los cheques están al día. No hay alertas urgentes pendientes.</div>
        </div>
      `;
      return;
    }

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
      const met = c.metricas || {};
      const esCritico = met.nivelAlerta === 'POR_VENCER_LEGAL';
      return `
        <div style="padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <div>
            <div style="font-weight: 600; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span>#${c.numero} - ${c.banco}</span>
              <span class="tag-urgente ${esCritico ? 'critico' : 'aviso'}">
                ${esCritico ? `¡Vence legal en ${met.diasParaVencLegal}d!` : `Cobro en ${met.diasParaCobro}d`}
              </span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
              Emisor: ${c.emisor} | Cobro: ${formatFecha(c.fecha_cobro)} | Venc. Legal (30d): ${met.fechaVencimientoLegal || '-'}
            </div>
          </div>
          <div style="text-align: right; display: flex; align-items: center; gap: 10px; margin-left: auto;">
            <div style="font-weight: 700; color: #fff; font-family: 'Outfit', sans-serif;">
              ${formatARS(c.importe)}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="DashboardModule.gestionarChequeAlerta('${c.numero}')" style="font-size: 0.75rem; padding: 5px 12px; font-weight: 600; border-color: rgba(14, 165, 233, 0.4); color: var(--primary);">
              Gestionar ↗
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  gestionarChequeAlerta(numeroCheque) {
    window.location.hash = '#cartera';
    setTimeout(() => {
      const search = document.getElementById('searchCartera');
      if (search) {
        search.value = numeroCheque;
        search.dispatchEvent(new Event('input'));
      }
    }, 150);
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
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#10b981',
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (evt, elements) => {
            if (elements && elements.length > 0) {
              const index = elements[0].index;
              const periodo = labels[index];
              if (periodo) {
                // Filtrar Cartera por el período seleccionado
                window.location.hash = '#cartera';
                setTimeout(() => {
                  const search = document.getElementById('searchCartera');
                  if (search) {
                    search.value = periodo;
                    search.dispatchEvent(new Event('input'));
                  }
                }, 150);
              }
            }
          },
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

    // 2. Gráfico Interactivo de Distribución por Banco
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
          onClick: (evt, elements) => {
            if (elements && elements.length > 0) {
              const index = elements[0].index;
              const bancoSeleccionado = labels[index];
              if (bancoSeleccionado) {
                // Filtrar Cartera por el banco seleccionado al hacer clic en el gráfico
                window.location.hash = '#cartera';
                setTimeout(() => {
                  const search = document.getElementById('searchCartera');
                  if (search) {
                    search.value = bancoSeleccionado;
                    search.dispatchEvent(new Event('input'));
                  }
                }, 150);
              }
            }
          },
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${formatARS(ctx.raw)} (Clic para ver cheques)`
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
      tbodyEntregadores.innerHTML = entregadores.map(e => `
        <tr style="cursor: pointer;" onclick="DashboardModule.gestionarChequeAlerta('${e.entregador.replace(/'/g, "\\'")}')" title="Ver cheques de ${e.entregador}">
          <td style="font-weight: 600; color: #fff;">
            ${e.entregador} <span style="font-size: 0.72rem; color: var(--primary);">↗</span>
          </td>
          <td style="color: var(--text-muted);">${e.cantidad} ch.</td>
          <td style="text-align: right; font-weight: 700; color: var(--accent-emerald);">${formatARS(e.ganancia_generada)}</td>
        </tr>
      `).join('');
    }
  }
};
