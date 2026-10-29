const { getPool } = require('../config/db');
const { calcularMetricasCheque } = require('../services/alertService');

async function obtenerMetricasDashboard(req, res) {
  try {
    const { anio, mes, cliente } = req.query;
    const pool = getPool();

    let filtroFecha = '1=1';
    const params = [];

    if (anio) {
      filtroFecha += ' AND YEAR(fecha_recepcion) = ?';
      params.push(parseInt(anio, 10));
      if (mes) {
        filtroFecha += ' AND MONTH(fecha_recepcion) = ?';
        params.push(parseInt(mes, 10));
      }
    }

    if (cliente && cliente.trim()) {
      filtroFecha += ' AND entregador = ?';
      params.push(cliente.trim());
    }

    // 1. Totales Generales según filtro
    const [totalesRows] = await pool.query(`
      SELECT 
        estado,
        COUNT(*) AS cantidad,
        COALESCE(SUM(importe), 0) AS total_importe,
        COALESCE(SUM(interes_cobrado), 0) AS total_interes,
        COALESCE(SUM(dinero_saliente), 0) AS total_saliente
      FROM cheques
      WHERE ${filtroFecha}
      GROUP BY estado
    `, params);

    const resumenEstados = {
      Pendiente: { cantidad: 0, importe: 0, interes: 0, saliente: 0 },
      Cobrado: { cantidad: 0, importe: 0, interes: 0, saliente: 0 },
      Rechazado: { cantidad: 0, importe: 0, interes: 0, saliente: 0 },
      Entregado: { cantidad: 0, importe: 0, interes: 0, saliente: 0 }
    };

    let totalGlobalCheques = 0;
    let totalGlobalImporte = 0;
    let totalGananciasNetas = 0;
    let totalDineroDesembolsado = 0;

    totalesRows.forEach(row => {
      if (resumenEstados[row.estado]) {
        resumenEstados[row.estado] = {
          cantidad: Number(row.cantidad),
          importe: Number(row.total_importe),
          interes: Number(row.total_interes),
          saliente: Number(row.total_saliente)
        };
      }
      totalGlobalCheques += Number(row.cantidad);
      totalGlobalImporte += Number(row.total_importe);
      totalGananciasNetas += Number(row.total_interes);
      totalDineroDesembolsado += Number(row.total_saliente);
    });

    // Tasa promedio ponderada
    const tasaPromedioPonderada = totalGlobalImporte > 0
      ? Math.round(((totalGananciasNetas / totalGlobalImporte) * 100) * 100) / 100
      : 0;

    // 2. Evolución mensual (últimos 12 meses o meses del año filtrado)
    const [evolucionRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(fecha_recepcion, '%Y-%m') AS periodo,
        COUNT(*) AS cantidad,
        COALESCE(SUM(importe), 0) AS total_importe,
        COALESCE(SUM(interes_cobrado), 0) AS total_ganancia
      FROM cheques
      GROUP BY DATE_FORMAT(fecha_recepcion, '%Y-%m')
      ORDER BY periodo DESC
      LIMIT 12
    `);

    // 3. Proyección de Cobros (Cash Flow futuro de cheques Pendientes)
    let proySql = `
      SELECT 
        DATE_FORMAT(fecha_cobro, '%Y-%m') AS periodo_cobro,
        COUNT(*) AS cantidad,
        COALESCE(SUM(importe), 0) AS total_a_cobrar
      FROM cheques
      WHERE estado = 'Pendiente'
    `;
    const proyParams = [];
    if (cliente && cliente.trim()) {
      proySql += ' AND entregador = ?';
      proyParams.push(cliente.trim());
    }
    proySql += `
      GROUP BY DATE_FORMAT(fecha_cobro, '%Y-%m')
      ORDER BY periodo_cobro ASC
      LIMIT 6
    `;
    const [proyeccionRows] = await pool.query(proySql, proyParams);

    // 4. Distribución por Bancos principales
    const [bancosRows] = await pool.query(`
      SELECT 
        banco,
        COUNT(*) AS cantidad,
        COALESCE(SUM(importe), 0) AS total_importe
      FROM cheques
      WHERE ${filtroFecha}
      GROUP BY banco
      ORDER BY total_importe DESC
      LIMIT 5
    `, params);

    // 5. Top Entregadores / Clientes que descuentan
    const [entregadoresRows] = await pool.query(`
      SELECT 
        entregador,
        COUNT(*) AS cantidad,
        COALESCE(SUM(importe), 0) AS total_importe,
        COALESCE(SUM(interes_cobrado), 0) AS ganancia_generada
      FROM cheques
      GROUP BY entregador
      ORDER BY ganancia_generada DESC
      LIMIT 5
    `);

    // 6. Cheques que requieren atención urgente
    let alertaSql = "SELECT * FROM cheques WHERE estado = 'Pendiente'";
    const alertaParams = [];
    if (cliente && cliente.trim()) {
      alertaSql += " AND entregador = ?";
      alertaParams.push(cliente.trim());
    }
    alertaSql += " ORDER BY fecha_cobro ASC";
    const [pendientes] = await pool.query(alertaSql, alertaParams);

    const chequesAlerta = [];
    for (const ch of pendientes) {
      const met = calcularMetricasCheque(ch);
      if (met.nivelAlerta === 'POR_VENCER_LEGAL' || met.nivelAlerta === 'COBRO_CERCANO' || met.nivelAlerta === 'VENCIDO') {
        chequesAlerta.push({
          ...ch,
          metricas: met
        });
      }
    }

    // 7. Años existentes con cheques en el sistema (dinámico)
    const [aniosRows] = await pool.query(`
      SELECT DISTINCT anio FROM (
        SELECT YEAR(fecha_cobro) AS anio FROM cheques WHERE fecha_cobro IS NOT NULL
        UNION
        SELECT YEAR(fecha_recepcion) AS anio FROM cheques WHERE fecha_recepcion IS NOT NULL
      ) AS t
      ORDER BY anio DESC
    `);
    const aniosDisponibles = aniosRows.map(r => r.anio).filter(Boolean);

    // 8. Clientes disponibles en el sistema (dinámico)
    const [clientesRows] = await pool.query(`
      SELECT DISTINCT TRIM(entregador) AS cliente 
      FROM cheques 
      WHERE entregador IS NOT NULL AND TRIM(entregador) != ''
      UNION
      SELECT DISTINCT TRIM(nombre) AS cliente
      FROM clientes
      WHERE nombre IS NOT NULL AND TRIM(nombre) != ''
      ORDER BY cliente ASC
    `);
    const clientesDisponibles = clientesRows.map(r => r.cliente).filter(Boolean);

    return res.json({
      resumen: {
        totalGlobalCheques,
        totalGlobalImporte,
        totalGananciasNetas, // Ganancias generadas por intereses
        totalDineroDesembolsado,
        tasaPromedioPonderada,
        carteraPendiente: resumenEstados.Pendiente,
        cobrados: resumenEstados.Cobrado,
        rechazados: resumenEstados.Rechazado,
        entregados: resumenEstados.Entregado
      },
      aniosDisponibles,
      clientesDisponibles,
      proyeccionCobros: proyeccionRows,
      topBancos: bancosRows,
      topEntregadores: entregadoresRows,
      chequesAlerta: chequesAlerta.slice(0, 10)
    });
  } catch (error) {
    console.error('[DASHBOARD METRICAS ERROR]', error);
    return res.status(500).json({ error: 'Error al calcular métricas del dashboard.' });
  }
}

module.exports = {
  obtenerMetricasDashboard
};
